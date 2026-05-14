import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import {
  QUEUES,
  type IncrementalSyncJob,
  type InitialImportJob,
  type OrderStatusNotificationJob,
  type OrderToMoyskladJob,
  type ProcessMoyskladEventJob,
  type ProductUpdateToMoyskladJob,
} from "./queues.js";

@Injectable()
export class QueueProducerService {
  constructor(
    @InjectQueue(QUEUES.MOYSKLAD_SYNC) private readonly moyskladSync: Queue,
    @InjectQueue(QUEUES.OUTBOUND_SYNC) private readonly outbound: Queue,
    @InjectQueue(QUEUES.WEBHOOKS) private readonly webhooks: Queue,
    @InjectQueue(QUEUES.TELEGRAM_NOTIFICATIONS) private readonly telegram: Queue,
  ) {}

  enqueueInitialImport(payload: InitialImportJob) {
    return this.moyskladSync.add("initial-import", payload, { jobId: `init:${payload.tenantId}:${payload.syncJobId}` });
  }

  enqueueIncrementalSync(payload: IncrementalSyncJob) {
    return this.moyskladSync.add("incremental-sync", payload, { jobId: `inc:${payload.tenantId}:${payload.entity ?? "all"}` });
  }

  enqueueSubscribeWebhooks(payload: { tenantId: string }) {
    return this.moyskladSync.add("subscribe-webhooks", payload, { jobId: `sub:${payload.tenantId}` });
  }

  enqueueOrderToMoysklad(payload: OrderToMoyskladJob) {
    return this.outbound.add("order-to-moysklad", payload, { jobId: `o2ms:${payload.orderId}` });
  }

  enqueueProductUpdateToMoysklad(payload: ProductUpdateToMoyskladJob) {
    return this.outbound.add("product-update-to-moysklad", payload);
  }

  enqueueProcessMoyskladEvent(payload: ProcessMoyskladEventJob) {
    return this.webhooks.add("process-moysklad-event", payload, { jobId: `ev:${payload.webhookEventId}` });
  }

  enqueueOrderStatusNotification(payload: OrderStatusNotificationJob) {
    return this.telegram.add("order-status-changed", payload);
  }
}
