import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PrismaProvider } from "../prisma.provider.js";
import { WorkerMoyskladClient } from "../moysklad/moysklad.client.js";

interface JobData {
  tenantId: string;
  entity?: string;
}

/**
 * Reconciles changes that happened since the last successful sync. Driven by
 * each entity's `updatedFrom` cursor stored on MoyskladAccount.cursors. Used as
 * the fallback for missed webhooks.
 */
@Injectable()
@Processor("moysklad-sync", { concurrency: 4 })
export class IncrementalSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(IncrementalSyncProcessor.name);

  constructor(private readonly prisma: PrismaProvider, private readonly ms: WorkerMoyskladClient) {
    super();
  }

  async process(job: Job<JobData>): Promise<void> {
    if (job.name !== "incremental-sync") return;
    const { tenantId, entity = "all" } = job.data;

    const acc = await this.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (!acc || acc.status === "DISCONNECTED") return;
    const cursors = (acc.cursors as Record<string, string> | null) ?? {};

    const entities = entity === "all"
      ? ["product", "variant", "productfolder", "customerorder", "counterparty"]
      : [entity];

    for (const ent of entities) {
      const since = cursors[ent];
      const latest = await this.pullSince(tenantId, ent, since);
      if (latest) cursors[ent] = latest;
    }

    await this.prisma.moyskladAccount.update({
      where: { tenantId },
      data: { cursors: cursors as never, lastSyncAt: new Date() },
    });
  }

  /**
   * Fetches changed rows for an entity, returning the new high-water mark.
   * The actual upsert reuses the same handlers as webhook processing (kept inline
   * here for brevity — a future refactor can extract a shared `EntityUpserter`).
   */
  private async pullSince(tenantId: string, entity: string, updatedFrom?: string): Promise<string | null> {
    const params: Record<string, unknown> = { limit: 100 };
    if (updatedFrom) params.updatedFrom = updatedFrom;
    try {
      const res = await this.ms.get<{ rows: Array<Record<string, unknown>> }>(
        tenantId,
        `/entity/${entity}`,
        params,
      );
      if (!res.rows?.length) return null;
      let maxUpdated = updatedFrom ?? null;
      for (const row of res.rows) {
        const u = row.updated ? String(row.updated) : null;
        if (u && (!maxUpdated || u > maxUpdated)) maxUpdated = u;
        // Delegate to webhook event processor by inserting a synthetic event.
        await this.prisma.webhookEvent.create({
          data: {
            tenantId,
            source: "MOYSKLAD",
            entityType: entity,
            action: "UPDATE",
            payload: row as never,
          },
        });
      }
      return maxUpdated;
    } catch (err) {
      this.logger.warn(`Incremental sync ${entity} failed for tenant=${tenantId}: ${String(err)}`);
      return updatedFrom ?? null;
    }
  }
}
