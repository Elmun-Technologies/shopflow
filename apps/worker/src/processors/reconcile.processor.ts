import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import type { Job, Queue } from "bullmq";
import { PrismaProvider } from "../prisma.provider.js";
import { WorkerMoyskladClient } from "../moysklad/moysklad.client.js";

interface JobData {
  tenantId: string;
  syncJobId: string;
}

interface DriftStat {
  entity: string;
  local: number;
  remote: number;
  drift: number;
  willReimport: boolean;
}

/**
 * Reconciliation job — compares row counts between ShopFlow and MoySklad.
 * For any entity where drift exceeds 1% (or 5 absolute, whichever is greater),
 * we trigger an entity-specific resync.
 *
 * This is the safety net for missed webhooks or partial sync failures.
 */
@Injectable()
@Processor("moysklad-sync", { concurrency: 1 })
export class ReconcileProcessor extends WorkerHost {
  private readonly logger = new Logger(ReconcileProcessor.name);

  constructor(
    private readonly prisma: PrismaProvider,
    private readonly ms: WorkerMoyskladClient,
    @InjectQueue("moysklad-sync") private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job<JobData>): Promise<void> {
    if (job.name !== "reconcile") return;
    const { tenantId, syncJobId } = job.data;

    await this.prisma.syncJob.update({
      where: { id: syncJobId },
      data: { status: "RUNNING", startedAt: new Date(), progress: 0 },
    });

    const stats: DriftStat[] = [];
    try {
      stats.push(await this.checkEntity(tenantId, "product"));
      stats.push(await this.checkEntity(tenantId, "variant"));
      stats.push(await this.checkEntity(tenantId, "productfolder"));
      stats.push(await this.checkEntity(tenantId, "counterparty"));

      for (const s of stats) {
        if (s.willReimport) {
          await this.queue.add(
            "incremental-sync",
            { tenantId, entity: s.entity },
            { jobId: `inc:${tenantId}:${s.entity}:reconcile:${Date.now()}` },
          );
        }
      }

      await this.prisma.syncJob.update({
        where: { id: syncJobId },
        data: {
          status: "DONE",
          progress: 100,
          finishedAt: new Date(),
          stats: stats.reduce((acc, s) => ({ ...acc, [s.entity]: s.drift }), {}) as never,
        },
      });
      this.logger.log(`Reconcile done tenant=${tenantId}: ${JSON.stringify(stats)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.syncJob.update({
        where: { id: syncJobId },
        data: { status: "FAILED", error: message, finishedAt: new Date() },
      });
      throw err;
    }
  }

  private async checkEntity(tenantId: string, entity: string): Promise<DriftStat> {
    const remote = await this.remoteCount(tenantId, entity);
    const local = await this.localCount(tenantId, entity);
    const drift = Math.abs(remote - local);
    const threshold = Math.max(5, Math.floor(remote * 0.01));
    return { entity, local, remote, drift, willReimport: drift > threshold };
  }

  private async remoteCount(tenantId: string, entity: string): Promise<number> {
    const path = entity === "productfolder" ? "/entity/productfolder" : `/entity/${entity}`;
    const res = await this.ms.get<{ meta: { size: number } }>(tenantId, path, { limit: 1 });
    return res.meta?.size ?? 0;
  }

  private async localCount(tenantId: string, entity: string): Promise<number> {
    switch (entity) {
      case "product":
        return this.prisma.product.count({ where: { tenantId, moyskladId: { not: null } } });
      case "variant":
        return this.prisma.variant.count({ where: { tenantId, moyskladId: { not: null } } });
      case "productfolder":
        return this.prisma.category.count({ where: { tenantId, moyskladId: { not: null } } });
      case "counterparty":
        return this.prisma.customer.count({ where: { tenantId, moyskladId: { not: null } } });
      default:
        return 0;
    }
  }
}
