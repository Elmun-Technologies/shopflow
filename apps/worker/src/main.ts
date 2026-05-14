import "reflect-metadata";
import { initSentry, captureException } from "@shopflow/observability";
initSentry({ service: "worker" });

import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerModule } from "./worker.module.js";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: false,
  });
  app.enableShutdownHooks();
  Logger.log("Worker started", "Bootstrap");

  // BullMQ workers don't pass through NestJS exception filters, so attach
  // process-level handlers as a safety net.
  process.on("unhandledRejection", (err) => {
    Logger.error(`Unhandled rejection: ${String(err)}`, undefined, "Worker");
    captureException(err);
  });
  process.on("uncaughtException", (err) => {
    Logger.error(`Uncaught exception: ${err.message}`, err.stack, "Worker");
    captureException(err);
  });
}

bootstrap().catch((err) => {
  captureException(err);
  console.error("Worker bootstrap failed:", err);
  process.exit(1);
});
