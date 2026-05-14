import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { AppConfigService } from "../../config/app-config.service.js";

/**
 * Redis-backed sliding-window rate limiter used by public-facing endpoints
 * (storefront orders, webhook receivers). NestJS's ThrottlerGuard already
 * covers the JWT-protected admin routes per IP, but it's in-memory per
 * instance — Redis-backed lets multiple api replicas share the same budget.
 */
@Injectable()
export class RedisRateLimitService {
  private readonly logger = new Logger(RedisRateLimitService.name);
  private readonly redis: Redis;

  constructor(config: AppConfigService) {
    this.redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
    this.redis.connect().catch((err) => this.logger.error("Redis connect", err));
  }

  /**
   * Returns true if the request is allowed. `key` should already include any
   * scoping (e.g. `storefront:<ip>` or `webhook:<tenantId>`). `limit` is the
   * max requests in `windowMs`.
   */
  async allow(key: string, limit: number, windowMs: number): Promise<boolean> {
    const fullKey = `rl:${key}`;
    const count = await this.redis.incr(fullKey);
    if (count === 1) await this.redis.pexpire(fullKey, windowMs);
    return count <= limit;
  }
}
