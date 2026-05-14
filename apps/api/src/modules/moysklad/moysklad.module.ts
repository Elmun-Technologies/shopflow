import { Module, Global } from "@nestjs/common";
import { MoyskladClient } from "./moysklad.client.js";
import { MoyskladRateLimiter } from "./moysklad.rate-limiter.js";
import { MoyskladMappers } from "./moysklad.mappers.js";
import { MoyskladWebhookSubscriber } from "./moysklad.webhook-subscriber.js";
import { SecretCipherService } from "../../common/crypto/secret-cipher.service.js";

@Global()
@Module({
  providers: [
    MoyskladClient,
    MoyskladRateLimiter,
    MoyskladMappers,
    MoyskladWebhookSubscriber,
    SecretCipherService,
  ],
  exports: [MoyskladClient, MoyskladMappers, MoyskladWebhookSubscriber, SecretCipherService],
})
export class MoyskladModule {}
