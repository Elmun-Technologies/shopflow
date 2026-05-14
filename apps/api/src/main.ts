// Sentry MUST be initialized before any other import that may throw, so that
// startup-phase errors are captured. It is a no-op if SENTRY_DSN is unset.
import "reflect-metadata";
import { initSentry } from "@shopflow/observability";
initSentry({ service: "api" });

import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { AppConfigService } from "./config/app-config.service.js";
import { metricsMiddleware } from "./common/observability/metrics.middleware.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(metricsMiddleware);
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });
  app.setGlobalPrefix("api", { exclude: ["health", "metrics", "webhooks/(.*)", "tg/(.*)"] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  await app.listen(config.port, "0.0.0.0");
  Logger.log(`ShopFlow API listening on http://localhost:${config.port}`, "Bootstrap");
}

bootstrap().catch((err) => {
  console.error("Fatal bootstrap error:", err);
  process.exit(1);
});
