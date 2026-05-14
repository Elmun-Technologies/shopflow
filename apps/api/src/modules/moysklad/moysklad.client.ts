import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosError, AxiosInstance } from "axios";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SecretCipherService } from "../../common/crypto/secret-cipher.service.js";
import { MoyskladRateLimiter } from "./moysklad.rate-limiter.js";
import type {
  MoyskladCounterparty,
  MoyskladCustomerOrder,
  MoyskladListResponse,
  MoyskladPriceType,
  MoyskladProduct,
  MoyskladProductFolder,
  MoyskladStockRow,
  MoyskladStore,
  MoyskladVariant,
  MoyskladWebhookSubscription,
} from "./moysklad.types.js";

const BASE_URL = "https://api.moysklad.ru/api/remap/1.2";
const MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 250;

interface MoyskladConnectionInfo {
  ok: boolean;
  accountUuid?: string;
  accountName?: string;
  error?: string;
}

/**
 * Tenant-aware HTTP client for the MoySklad REST API.
 *
 * For each tenant, the per-tenant access token is read from `MoyskladAccount`
 * (decrypted via SecretCipherService) and attached as a Bearer header.
 * Every outbound call is gated through `MoyskladRateLimiter` and retried on
 * 5xx / 429 / network failures with exponential backoff.
 */
@Injectable()
export class MoyskladClient {
  private readonly logger = new Logger(MoyskladClient.name);
  private readonly http: AxiosInstance;
  private readonly tokenCache = new Map<string, { token: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipherService,
    private readonly rateLimiter: MoyskladRateLimiter,
  ) {
    this.http = axios.create({
      baseURL: BASE_URL,
      timeout: 30_000,
      headers: { "Accept-Encoding": "gzip", "Content-Type": "application/json" },
    });
  }

  // ---------- High-level helpers ----------

  async testConnection(token: string): Promise<MoyskladConnectionInfo> {
    try {
      const res = await axios.get(`${BASE_URL}/context/employee`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15_000,
      });
      const data = res.data as { id?: string; name?: string; accountId?: string };
      return { ok: true, accountUuid: data.accountId, accountName: data.name };
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.errors?.[0]?.error ?? err.message : String(err);
      return { ok: false, error: msg };
    }
  }

  // ---------- Read methods ----------

  listProducts(tenantId: string, params: { limit?: number; offset?: number; updatedFrom?: string } = {}) {
    return this.get<MoyskladListResponse<MoyskladProduct>>(tenantId, "/entity/product", { limit: 1000, ...params });
  }

  listVariants(tenantId: string, params: { limit?: number; offset?: number; updatedFrom?: string } = {}) {
    return this.get<MoyskladListResponse<MoyskladVariant>>(tenantId, "/entity/variant", { limit: 1000, ...params });
  }

  listProductFolders(tenantId: string, params: { limit?: number; offset?: number } = {}) {
    return this.get<MoyskladListResponse<MoyskladProductFolder>>(tenantId, "/entity/productfolder", {
      limit: 1000,
      ...params,
    });
  }

  listStores(tenantId: string) {
    return this.get<MoyskladListResponse<MoyskladStore>>(tenantId, "/entity/store", { limit: 1000 });
  }

  listPriceTypes(tenantId: string) {
    return this.get<{ rows: MoyskladPriceType[] }>(tenantId, "/context/companysettings/pricetype", {});
  }

  listCounterparties(tenantId: string, params: { limit?: number; offset?: number; updatedFrom?: string } = {}) {
    return this.get<MoyskladListResponse<MoyskladCounterparty>>(tenantId, "/entity/counterparty", {
      limit: 1000,
      ...params,
    });
  }

  listCustomerOrders(tenantId: string, params: { limit?: number; offset?: number; updatedFrom?: string } = {}) {
    return this.get<MoyskladListResponse<MoyskladCustomerOrder>>(tenantId, "/entity/customerorder", {
      limit: 1000,
      ...params,
    });
  }

  /** Aggregated stock per assortment (product/variant) and store. */
  listStockAll(tenantId: string, params: { limit?: number; offset?: number; storeId?: string } = {}) {
    return this.get<{ rows: MoyskladStockRow[] }>(tenantId, "/report/stock/all/current", {
      limit: 1000,
      groupBy: "variant",
      ...params,
    });
  }

  // ---------- Webhook subscriptions ----------

  async listWebhooks(tenantId: string) {
    return this.get<MoyskladListResponse<MoyskladWebhookSubscription>>(tenantId, "/entity/webhook", { limit: 1000 });
  }

  async createWebhook(
    tenantId: string,
    payload: { entityType: string; url: string; action: "CREATE" | "UPDATE" | "DELETE" },
  ) {
    return this.post<MoyskladWebhookSubscription, typeof payload>(tenantId, "/entity/webhook", {
      ...payload,
      method: "POST",
      enabled: true,
    } as never);
  }

  async deleteWebhook(tenantId: string, id: string) {
    return this.del(tenantId, `/entity/webhook/${id}`);
  }

  // ---------- Write methods ----------

  createCustomerOrder(tenantId: string, payload: Record<string, unknown>) {
    return this.post<MoyskladCustomerOrder, Record<string, unknown>>(tenantId, "/entity/customerorder", payload);
  }

  updateProduct(tenantId: string, id: string, payload: Record<string, unknown>) {
    return this.put<MoyskladProduct, Record<string, unknown>>(tenantId, `/entity/product/${id}`, payload);
  }

  upsertCounterparty(tenantId: string, payload: Record<string, unknown>) {
    return this.post<MoyskladCounterparty, Record<string, unknown>>(tenantId, "/entity/counterparty", payload);
  }

  // ---------- Internals ----------

  private async get<T>(tenantId: string, path: string, params: Record<string, unknown>): Promise<T> {
    return this.request<T>(tenantId, "GET", path, undefined, params);
  }
  private async post<T, B>(tenantId: string, path: string, body: B): Promise<T> {
    return this.request<T>(tenantId, "POST", path, body);
  }
  private async put<T, B>(tenantId: string, path: string, body: B): Promise<T> {
    return this.request<T>(tenantId, "PUT", path, body);
  }
  private async del(tenantId: string, path: string): Promise<void> {
    await this.request<void>(tenantId, "DELETE", path);
  }

  private async request<T>(
    tenantId: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.getToken(tenantId);

    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.rateLimiter.acquire(tenantId);
      try {
        const res = await this.http.request<T>({
          method,
          url: path,
          data: body,
          params,
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.data;
      } catch (err) {
        lastErr = err;
        if (!shouldRetry(err) || attempt === MAX_RETRIES) {
          break;
        }
        const delay = retryDelay(err, attempt);
        this.logger.warn(`MoySklad ${method} ${path} failed (attempt ${attempt + 1}); retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
    throw lastErr;
  }

  private async getToken(tenantId: string): Promise<string> {
    const cached = this.tokenCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.token;

    const account = await this.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (!account?.encryptedToken) {
      throw new Error(`MoySklad not connected for tenant ${tenantId}`);
    }
    const token = this.cipher.decrypt(account.encryptedToken);
    this.tokenCache.set(tenantId, { token, expiresAt: Date.now() + 60_000 });
    return token;
  }
}

function shouldRetry(err: unknown): boolean {
  if (!(err instanceof AxiosError)) return false;
  const status = err.response?.status ?? 0;
  if (status === 429) return true;
  if (status >= 500) return true;
  if (err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") return true;
  return false;
}

function retryDelay(err: unknown, attempt: number): number {
  if (err instanceof AxiosError) {
    const retryAfter = err.response?.headers?.["retry-after"];
    if (retryAfter) {
      const ms = Number(retryAfter) * 1000;
      if (Number.isFinite(ms) && ms > 0) return ms;
    }
  }
  return RETRY_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 250);
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
