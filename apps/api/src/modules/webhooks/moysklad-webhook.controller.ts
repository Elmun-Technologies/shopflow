import { Body, Controller, HttpCode, Logger, NotFoundException, Param, Post } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { QueueProducerService } from "../../queue/queue-producer.service.js";
import { Public } from "../../common/auth/auth.decorators.js";
import type { MoyskladWebhookPayload } from "../moysklad/moysklad.types.js";

/**
 * Endpoint MoySklad calls for every subscribed event. We don't process inline —
 * we just persist a WebhookEvent row and enqueue background work, returning 200
 * within milliseconds so MoySklad doesn't retry.
 *
 * Idempotency: MoySklad may redeliver the same event after a brief network
 * blip. We compute a stable key from `auditContext.uid + event.meta.href +
 * action` and use it as a unique constraint on WebhookEvent — duplicates are
 * silently ignored.
 */
@Controller("webhooks/moysklad")
export class MoyskladWebhookController {
  private readonly logger = new Logger(MoyskladWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueProducerService,
  ) {}

  @Public()
  @HttpCode(200)
  @Post(":tenantId")
  async receive(@Param("tenantId") tenantId: string, @Body() payload: MoyskladWebhookPayload) {
    const account = await this.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (!account) throw new NotFoundException();

    await this.prisma.moyskladAccount.update({
      where: { tenantId },
      data: { lastWebhookAt: new Date() },
    });

    const events = payload?.events ?? [];
    const auditUid = payload?.auditContext?.uid ?? null;

    let stored = 0;
    let duplicates = 0;

    for (const event of events) {
      const entityType = inferEntityType(event.meta?.type ?? "");
      const entityHref = event.meta?.href ?? null;
      const idempotencyKey = buildIdempotencyKey(auditUid, entityHref, event.action);
      const entityMoyskladId = entityHref?.match(/[0-9a-f-]{36}$/i)?.[0] ?? null;

      try {
        const created = await this.prisma.webhookEvent.create({
          data: {
            tenantId,
            source: "MOYSKLAD",
            entityType,
            action: event.action,
            idempotencyKey,
            entityHref,
            entityMoyskladId,
            payload: event as never,
          },
        });
        await this.queue.enqueueProcessMoyskladEvent({ tenantId, webhookEventId: created.id });
        stored++;
      } catch (err) {
        if (isUniqueViolation(err)) {
          duplicates++;
          continue;
        }
        throw err;
      }
    }

    if (duplicates > 0) {
      this.logger.debug(`Tenant=${tenantId}: dropped ${duplicates} duplicate webhook events`);
    }

    return { received: events.length, stored, duplicates };
  }
}

function inferEntityType(metaType: string): string {
  // MoySklad meta.type values look like `product`, `customerorder`, `productfolder`, …
  return metaType.toLowerCase();
}

function buildIdempotencyKey(
  auditUid: string | null,
  entityHref: string | null,
  action: string,
): string | null {
  if (!auditUid || !entityHref) return null;
  return `${auditUid}|${entityHref}|${action}`;
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: string }).code;
  return code === "P2002";
}
