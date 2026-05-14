import { Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";
import { AppConfigService } from "../../config/app-config.service.js";

/**
 * Per-tenant token-bucket rate limiter for MoySklad API.
 *
 * MoySklad documented limits:
 *  - 45 requests per 3 second window (burst)
 *  - 5 requests per second (sustained)
 *
 * We use the burst limit as the primary bucket since it's the strict one.
 * Implementation: GCRA via a single Redis script for atomicity.
 */
@Injectable()
export class MoyskladRateLimiter {
  private readonly logger = new Logger(MoyskladRateLimiter.name);
  private readonly redis: Redis;

  private readonly capacity = 45;
  private readonly windowMs = 3_000;

  constructor(config: AppConfigService) {
    this.redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
    this.redis.connect().catch((err) => this.logger.error("Redis connect failed", err));
  }

  /**
   * Resolves when a request is allowed. Waits if necessary (up to `maxWaitMs`).
   * Throws if the request still cannot be served.
   */
  async acquire(tenantId: string, maxWaitMs = 15_000): Promise<void> {
    const deadline = Date.now() + maxWaitMs;
    const key = `msrl:${tenantId}`;

    while (true) {
      const allowed = await this.tryConsume(key);
      if (allowed) return;
      if (Date.now() >= deadline) {
        throw new Error(`MoySklad rate limit: could not acquire slot for tenant=${tenantId}`);
      }
      await sleep(150 + Math.random() * 250);
    }
  }

  private async tryConsume(key: string): Promise<boolean> {
    // Sliding window counter using INCR + PEXPIRE.
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.pexpire(key, this.windowMs);
    }
    return count <= this.capacity;
  }
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
