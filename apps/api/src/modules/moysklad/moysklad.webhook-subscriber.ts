import { Injectable, Logger } from "@nestjs/common";
import { MoyskladClient } from "./moysklad.client.js";
import { AppConfigService } from "../../config/app-config.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";

/**
 * The set of MoySklad entity/action pairs we subscribe to. Adding a new pair
 * here and re-running `syncSubscriptions(tenantId)` is enough to wire it up.
 */
const REQUIRED_SUBSCRIPTIONS: Array<{ entityType: string; action: "CREATE" | "UPDATE" | "DELETE" }> = [
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

@Injectable()
export class MoyskladWebhookSubscriber {
  private readonly logger = new Logger(MoyskladWebhookSubscriber.name);

  constructor(
    private readonly client: MoyskladClient,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /** Ensure all required webhooks exist for this tenant, removing stale ones. */
  async syncSubscriptions(tenantId: string): Promise<string[]> {
    const url = `${this.config.publicApiUrl}/webhooks/moysklad/${tenantId}`;
    const existing = await this.client.listWebhooks(tenantId);
    const ours = existing.rows.filter((row) => row.url === url);

    const keep: string[] = [];

    for (const required of REQUIRED_SUBSCRIPTIONS) {
      const match = ours.find((r) => r.entityType === required.entityType && r.action === required.action);
      if (match) {
        keep.push(match.id);
      } else {
        try {
          const created = await this.client.createWebhook(tenantId, { ...required, url });
          keep.push(created.id);
          this.logger.log(`Webhook ${required.entityType}.${required.action} created for tenant=${tenantId}`);
        } catch (err) {
          this.logger.error(`Failed to create webhook ${required.entityType}.${required.action}: ${String(err)}`);
        }
      }
    }

    // Remove duplicates / unknown actions that point at us.
    for (const row of ours) {
      if (!keep.includes(row.id)) {
        await this.client.deleteWebhook(tenantId, row.id).catch(() => undefined);
      }
    }

    await this.prisma.moyskladAccount.update({
      where: { tenantId },
      data: { webhookSubscriptionIds: keep },
    });

    return keep;
  }
}
