import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PrismaProvider } from "../prisma.provider.js";
import { WorkerMoyskladClient } from "../moysklad/moysklad.client.js";
import { WorkerConfigService } from "../config/worker-config.service.js";

const REQUIRED: Array<{ entityType: string; action: "CREATE" | "UPDATE" | "DELETE" }> = [
  { entityType: "product", action: "CREATE" },
  { entityType: "product", action: "UPDATE" },
  { entityType: "product", action: "DELETE" },
  { entityType: "variant", action: "CREATE" },
  { entityType: "variant", action: "UPDATE" },
  { entityType: "variant", action: "DELETE" },
  { entityType: "productfolder", action: "CREATE" },
  { entityType: "productfolder", action: "UPDATE" },
  { entityType: "productfolder", action: "DELETE" },
  { entityType: "customerorder", action: "UPDATE" },
  { entityType: "demand", action: "CREATE" },
  { entityType: "counterparty", action: "CREATE" },
  { entityType: "counterparty", action: "UPDATE" },
];

interface ExistingWebhook {
  id: string;
  entityType: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  url: string;
}

@Injectable()
@Processor("moysklad-sync", { concurrency: 1 })
export class SubscribeWebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(SubscribeWebhooksProcessor.name);

  constructor(
    private readonly prisma: PrismaProvider,
    private readonly ms: WorkerMoyskladClient,
    private readonly config: WorkerConfigService,
  ) {
    super();
  }

  async process(job: Job<{ tenantId: string }>): Promise<void> {
    if (job.name !== "subscribe-webhooks") return;
    const { tenantId } = job.data;
    const url = `${this.config.publicApiUrl}/webhooks/moysklad/${tenantId}`;

    const res = await this.ms.get<{ rows: ExistingWebhook[] }>(tenantId, "/entity/webhook", { limit: 1000 });
    const ours = (res.rows ?? []).filter((r) => r.url === url);

    const keep: string[] = [];
    for (const req of REQUIRED) {
      const found = ours.find((r) => r.entityType === req.entityType && r.action === req.action);
      if (found) {
        keep.push(found.id);
      } else {
        try {
          const created = await this.ms.post<{ id: string }>(tenantId, "/entity/webhook", {
            ...req,
            url,
            method: "POST",
            enabled: true,
          });
          keep.push(created.id);
        } catch (err) {
          this.logger.error(`Failed to create webhook ${req.entityType}.${req.action}: ${String(err)}`);
        }
      }
    }

    await this.prisma.moyskladAccount.update({
      where: { tenantId },
      data: { webhookSubscriptionIds: keep },
    });
  }
}
