import { Body, Controller, HttpCode, Logger, NotFoundException, Param, Post } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { QueueProducerService } from "../../queue/queue-producer.service.js";
import { Public } from "../../common/auth/auth.decorators.js";
import type { MoyskladWebhookPayload } from "../moysklad/moysklad.types.js";

/**
 * Endpoint MoySklad calls for every subscribed event. We don't process inline —
 * we just persist a WebhookEvent row and enqueue background work, returning 200
 * within milliseconds so MoySklad doesn't retry.
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
    for (const event of events) {
      const entityType = inferEntityType(event.meta?.type ?? "");
      const created = await this.prisma.webhookEvent.create({
        data: {
          tenantId,
          source: "MOYSKLAD",
          entityType,
          action: event.action,
          payload: event as never,
        },
      });
      await this.queue.enqueueProcessMoyskladEvent({ tenantId, webhookEventId: created.id });
    }

    return { received: events.length };
  }
}

function inferEntityType(metaType: string): string {
  // MoySklad meta.type values look like `product`, `customerorder`, `productfolder`, …
  return metaType.toLowerCase();
}
