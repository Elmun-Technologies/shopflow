import { Module } from "@nestjs/common";
import { PaymentsAdminController } from "./payments-admin.controller.js";
import { PaymentsAdminService } from "./payments-admin.service.js";
import { PaymentsService } from "./payments.service.js";
import { ClickWebhookController } from "./click-webhook.controller.js";
import { PaymeWebhookController } from "./payme-webhook.controller.js";

@Module({
  controllers: [
    PaymentsAdminController,
    ClickWebhookController,
    PaymeWebhookController,
  ],
  providers: [PaymentsAdminService, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
