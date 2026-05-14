import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosError, AxiosInstance } from "axios";
import Redis from "ioredis";
import { PrismaProvider } from "../prisma.provider.js";
import { WorkerSecretCipher } from "./secret-cipher.js";
import { WorkerConfigService } from "../config/worker-config.service.js";

const BASE_URL = "https://api.moysklad.ru/api/remap/1.2";
const MAX_RETRIES = 4;

/**
 * Worker-side MoySklad client. Mirrors apps/api's MoyskladClient with the same
 * rate-limit budget keyed off Redis (so api + worker share the same bucket).
 */
@Injectable()
export class WorkerMoyskladClient {
  private readonly logger = new Logger(WorkerMoyskladClient.name);
  private readonly http: AxiosInstance;
  private readonly redis: Redis;
  private readonly tokens = new Map<string, { token: string; expiresAt: number }>();

  private readonly rlCapacity = 45;
  private readonly rlWindowMs = 3_000;

  constructor(
    private readonly prisma: PrismaProvider,
    private readonly cipher: WorkerSecretCipher,
    private readonly config: WorkerConfigService,
  ) {
    this.http = axios.create({ baseURL: BASE_URL, timeout: 60_000 });
    this.redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    this.redis.connect().catch((e) => this.logger.error("Redis connect", e));
  }

  async get<T>(tenantId: string, path: string, params?: Record<string, unknown>): Promise<T> {
    return this.request<T>(tenantId, "GET", path, undefined, params);
  }
  async post<T>(tenantId: string, path: string, body: unknown): Promise<T> {
    return this.request<T>(tenantId, "POST", path, body);
  }
  async put<T>(tenantId: string, path: string, body: unknown): Promise<T> {
    return this.request<T>(tenantId, "PUT", path, body);
  }

  private async request<T>(
    tenantId: string,
    method: "GET" | "POST" | "PUT",
    path: string,
    body?: unknown,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.getToken(tenantId);
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.rateLimit(tenantId);
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
        if (!shouldRetry(err) || attempt === MAX_RETRIES) break;
        const delay = retryDelay(err, attempt);
        this.logger.warn(`MoySklad ${method} ${path} retry in ${delay}ms`);
        await sleep(delay);
      }
    }
    throw lastErr;
  }

  private async getToken(tenantId: string): Promise<string> {
    const cached = this.tokens.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.token;
    const acc = await this.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (!acc?.encryptedToken) throw new Error(`MoySklad not connected for tenant ${tenantId}`);
    const token = this.cipher.decrypt(acc.encryptedToken);
    this.tokens.set(tenantId, { token, expiresAt: Date.now() + 60_000 });
    return token;
  }

  private async rateLimit(tenantId: string, maxWaitMs = 15_000) {
    const key = `msrl:${tenantId}`;
    const deadline = Date.now() + maxWaitMs;
    while (true) {
      const count = await this.redis.incr(key);
      if (count === 1) await this.redis.pexpire(key, this.rlWindowMs);
      if (count <= this.rlCapacity) return;
      if (Date.now() >= deadline) throw new Error(`Rate limit exceeded for tenant ${tenantId}`);
      await sleep(150 + Math.random() * 200);
    }
  }
}

function shouldRetry(err: unknown): boolean {
  if (!(err instanceof AxiosError)) return false;
  const s = err.response?.status ?? 0;
  return s === 429 || s >= 500 || err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ECONNABORTED";
}

function retryDelay(err: unknown, attempt: number): number {
  if (err instanceof AxiosError) {
    const retryAfter = err.response?.headers?.["retry-after"];
    if (retryAfter) {
      const ms = Number(retryAfter) * 1000;
      if (Number.isFinite(ms) && ms > 0) return ms;
    }
  }
  return 250 * 2 ** attempt + Math.floor(Math.random() * 250);
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
