import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller.js";
import { MoyskladIntegrationService } from "./moysklad-integration.service.js";
import { TelegramIntegrationService } from "./telegram-integration.service.js";

@Module({
  controllers: [IntegrationsController],
  providers: [MoyskladIntegrationService, TelegramIntegrationService],
  exports: [MoyskladIntegrationService, TelegramIntegrationService],
})
export class IntegrationsModule {}
