import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AppConfigService } from "../config/app-config.service.js";
import { QUEUES } from "./queues.js";
import { QueueProducerService } from "./queue-producer.service.js";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: parseRedisUrl(config.redisUrl),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 24 * 3600 },
        },
      }),
    }),
    BullModule.registerQueue(...Object.values(QUEUES).map((name) => ({ name }))),
  ],
  providers: [QueueProducerService],
  exports: [BullModule, QueueProducerService],
})
export class QueueModule {}

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
