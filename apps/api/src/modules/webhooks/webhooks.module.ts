import { Module } from "@nestjs/common";
import { MoyskladWebhookController } from "./moysklad-webhook.controller.js";
import { TelegramWebhookController } from "./telegram-webhook.controller.js";

@Module({
  controllers: [MoyskladWebhookController, TelegramWebhookController],
})
export class WebhooksModule {}
