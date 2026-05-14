import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { AppConfigService } from "./config/app-config.service.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
  });
  app.setGlobalPrefix("api", { exclude: ["health", "webhooks/(.*)", "tg/(.*)"] });

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
