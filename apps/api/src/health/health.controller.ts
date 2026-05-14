import { Controller, Get, Header } from "@nestjs/common";
import { Redis } from "ioredis";
import { renderMetrics } from "@shopflow/observability";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppConfigService } from "../config/app-config.service.js";
import { Public } from "../common/auth/auth.decorators.js";

/**
 * Health and observability endpoints.
 *
 *   GET /health  — JSON status of DB and Redis. Used by NGINX / load balancer
 *                  upstream checks.
 *   GET /metrics — Prometheus exposition format. Scraped by Prometheus.
 */
@Controller()
export class HealthController {
  private readonly redis: Redis;

  constructor(private readonly prisma: PrismaService, config: AppConfigService) {
    this.redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
    this.redis.connect().catch(() => undefined);
  }

  @Public()
  @Get("health")
  async check() {
    const [db, redis] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const status = db === "ok" && redis === "ok" ? "ok" : "degraded";
    return { status, db, redis, time: new Date().toISOString() };
  }

  @Public()
  @Get("metrics")
  @Header("content-type", "text/plain; version=0.0.4; charset=utf-8")
  metrics() {
    return renderMetrics();
  }

  private async checkDb(): Promise<"ok" | "error"> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "ok";
    } catch {
      return "error";
    }
  }

  private async checkRedis(): Promise<"ok" | "error"> {
    try {
      const pong = await this.redis.ping();
      return pong === "PONG" ? "ok" : "error";
    } catch {
      return "error";
    }
  }
}
