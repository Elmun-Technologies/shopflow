import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerModule } from "./worker.module.js";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: false,
  });
  app.enableShutdownHooks();
  Logger.log("Worker started", "Bootstrap");
}

bootstrap().catch((err) => {
  console.error("Worker bootstrap failed:", err);
  process.exit(1);
});
