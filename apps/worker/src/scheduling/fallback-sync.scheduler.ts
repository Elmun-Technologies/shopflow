import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { PrismaProvider } from "../prisma.provider.js";

/**
 * Every 10 minutes, enqueue an incremental sync for every CONNECTED tenant.
 * This protects us from missed webhooks (MoySklad outage, network drop, etc.).
 */
@Injectable()
export class FallbackSyncScheduler {
  private readonly logger = new Logger(FallbackSyncScheduler.name);

  constructor(
    private readonly prisma: PrismaProvider,
    @InjectQueue("moysklad-sync") private readonly queue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async fallbackSync(): Promise<void> {
    const accounts = await this.prisma.moyskladAccount.findMany({
      where: { status: "CONNECTED" },
      select: { tenantId: true },
    });
    for (const acc of accounts) {
      await this.queue.add(
        "incremental-sync",
        { tenantId: acc.tenantId },
        { jobId: `fb:${acc.tenantId}:${Math.floor(Date.now() / 600_000)}` },
      );
    }
    if (accounts.length) {
      this.logger.log(`Scheduled fallback sync for ${accounts.length} tenants`);
    }
  }
}
