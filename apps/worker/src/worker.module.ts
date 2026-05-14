import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { BullModule } from "@nestjs/bullmq";

import { WorkerConfigService } from "./config/worker-config.service.js";
import { PrismaProvider } from "./prisma.provider.js";
import { MoyskladModule } from "./moysklad/moysklad.module.js";

import { InitialImportProcessor } from "./processors/initial-import.processor.js";
import { IncrementalSyncProcessor } from "./processors/incremental-sync.processor.js";
import { WebhookEventProcessor } from "./processors/webhook-event.processor.js";
import { SubscribeWebhooksProcessor } from "./processors/subscribe-webhooks.processor.js";
import { OutboundOrderProcessor } from "./processors/outbound-order.processor.js";
import { ReconcileProcessor } from "./processors/reconcile.processor.js";
import { OrderStatusNotificationProcessor } from "./processors/order-status-notification.processor.js";
import { FallbackSyncScheduler } from "./scheduling/fallback-sync.scheduler.js";

const QUEUE_NAMES = [
  "moysklad-sync",
  "outbound-sync",
  "webhooks",
  "telegram-notifications",
  "scheduled",
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: parseRedisUrl(process.env.REDIS_URL ?? "redis://localhost:6379"),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 24 * 3600 },
        },
      }),
    }),
    BullModule.registerQueue(...QUEUE_NAMES.map((name) => ({ name }))),
    MoyskladModule,
  ],
  providers: [
    WorkerConfigService,
    PrismaProvider,
    InitialImportProcessor,
    IncrementalSyncProcessor,
    WebhookEventProcessor,
    SubscribeWebhooksProcessor,
    OutboundOrderProcessor,
    ReconcileProcessor,
    OrderStatusNotificationProcessor,
    FallbackSyncScheduler,
  ],
})
export class WorkerModule {}

function parseRedisUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    username: u.username || undefined,
    db: u.pathname ? Number(u.pathname.replace("/", "")) || 0 : 0,
  };
}
