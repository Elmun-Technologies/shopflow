import { PrismaClient } from "@prisma/client";
import { decryptSecret } from "./secret-cipher.js";
import { acquireMoyskladSlot } from "./moysklad-rate-limiter.js";
import type {
  MoyskladCounterparty,
  MoyskladCustomerOrder,
  MoyskladListResponse,
  MoyskladProduct,
  MoyskladProductFolder,
  MoyskladStockRow,
  MoyskladTokenTestResult,
  MoyskladWebhookSubscription,
} from "./moysklad-types.js";

const BASE_URL = "https://api.moysklad.ru/api/remap/1.2";
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 250;
const TIMEOUT_MS = 30_000;

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

export class MoyskladHttpError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = "MoyskladHttpError";
  }
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

async function getTenantToken(prisma: PrismaClient, tenantId: string): Promise<string> {
  const cached = tokenCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const account = await prisma.moyskladAccount.findUnique({ where: { tenantId } });
  if (!account?.encryptedToken) {
    throw new MoyskladHttpError(`MoySklad ulanmagan: tenant=${tenantId}`, 401);
  }
  const token = decryptSecret(account.encryptedToken);
  tokenCache.set(tenantId, { token, expiresAt: Date.now() + 60_000 });
  return token;
}

export function clearMoyskladTokenCache(tenantId?: string) {
  if (tenantId) tokenCache.delete(tenantId);
  else tokenCache.clear();
}

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function shouldRetry(status: number, err: unknown): boolean {
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  if (err instanceof Error && /ECONNRESET|ETIMEDOUT|abort|fetch failed/i.test(err.message)) return true;
  return false;
}

function retryDelay(attempt: number, retryAfter?: string | null): number {
  if (retryAfter) {
    const ms = Number(retryAfter) * 1000;
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  return RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 250);
}

async function tenantRequest<T>(
  prisma: PrismaClient,
  tenantId: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const token = await getTenantToken(prisma, tenantId);
  const method = opts.method ?? "GET";
  const url = buildUrl(path, opts.query);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await acquireMoyskladSlot(tenantId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Accept-Encoding": "gzip",
          ...(opts.body ? { "Content-Type": "application/json" } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text().catch(() => undefined);
      }

      if (shouldRetry(res.status, null) && attempt < MAX_RETRIES) {
        const delay = retryDelay(attempt, res.headers.get("retry-after"));
        await sleep(delay);
        continue;
      }
      throw new MoyskladHttpError(`MoySklad ${method} ${path} → ${res.status}`, res.status, body);
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err instanceof MoyskladHttpError) throw err;
      if (!shouldRetry(0, err) || attempt === MAX_RETRIES) break;
      await sleep(retryDelay(attempt));
    }
  }
  throw lastErr ?? new Error("MoySklad so'rov muvaffaqiyatsiz");
}

/** Token amal qilishini tekshirish — DB'ga yozishdan oldin chaqiriladi. */
export async function testMoyskladToken(token: string): Promise<MoyskladTokenTestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${BASE_URL}/context/employee`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { errors?: Array<{ error?: string }> };
      return { ok: false, error: body.errors?.[0]?.error ?? `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { name?: string; accountId?: string };
    return { ok: true, accountUuid: data.accountId, accountName: data.name };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------- READ helpers ----------

export function listMoyskladProducts(
  prisma: PrismaClient,
  tenantId: string,
  params: { limit?: number; offset?: number; updatedFrom?: string } = {},
) {
  return tenantRequest<MoyskladListResponse<MoyskladProduct>>(prisma, tenantId, "/entity/product", {
    query: { limit: 1000, ...params },
  });
}

export function listMoyskladProductFolders(prisma: PrismaClient, tenantId: string) {
  return tenantRequest<MoyskladListResponse<MoyskladProductFolder>>(prisma, tenantId, "/entity/productfolder", {
    query: { limit: 1000 },
  });
}

export function listMoyskladCounterparties(
  prisma: PrismaClient,
  tenantId: string,
  params: { limit?: number; offset?: number; updatedFrom?: string } = {},
) {
  return tenantRequest<MoyskladListResponse<MoyskladCounterparty>>(prisma, tenantId, "/entity/counterparty", {
    query: { limit: 1000, ...params },
  });
}

export function listMoyskladCustomerOrders(
  prisma: PrismaClient,
  tenantId: string,
  params: { limit?: number; offset?: number; updatedFrom?: string } = {},
) {
  return tenantRequest<MoyskladListResponse<MoyskladCustomerOrder>>(prisma, tenantId, "/entity/customerorder", {
    query: { limit: 1000, ...params },
  });
}

export function listMoyskladStock(
  prisma: PrismaClient,
  tenantId: string,
  params: { limit?: number; offset?: number } = {},
) {
  return tenantRequest<{ rows: MoyskladStockRow[] }>(prisma, tenantId, "/report/stock/all/current", {
    query: { limit: 1000, groupBy: "variant", ...params },
  });
}

// ---------- WEBHOOK helpers ----------

export function listMoyskladWebhooks(prisma: PrismaClient, tenantId: string) {
  return tenantRequest<MoyskladListResponse<MoyskladWebhookSubscription>>(prisma, tenantId, "/entity/webhook", {
    query: { limit: 1000 },
  });
}

export function createMoyskladWebhook(
  prisma: PrismaClient,
  tenantId: string,
  payload: { entityType: string; url: string; action: "CREATE" | "UPDATE" | "DELETE" },
) {
  return tenantRequest<MoyskladWebhookSubscription>(prisma, tenantId, "/entity/webhook", {
    method: "POST",
    body: { ...payload, method: "POST", enabled: true },
  });
}

export function deleteMoyskladWebhook(prisma: PrismaClient, tenantId: string, id: string) {
  return tenantRequest<void>(prisma, tenantId, `/entity/webhook/${id}`, { method: "DELETE" });
}

// ---------- WRITE helpers ----------

export function createMoyskladCustomerOrder(
  prisma: PrismaClient,
  tenantId: string,
  payload: Record<string, unknown>,
) {
  return tenantRequest<MoyskladCustomerOrder>(prisma, tenantId, "/entity/customerorder", {
    method: "POST",
    body: payload,
  });
}
