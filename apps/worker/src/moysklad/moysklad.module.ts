import { Module } from "@nestjs/common";
import { WorkerMoyskladClient } from "./moysklad.client.js";
import { WorkerSecretCipher } from "./secret-cipher.js";

@Module({
  providers: [WorkerMoyskladClient, WorkerSecretCipher],
  exports: [WorkerMoyskladClient, WorkerSecretCipher],
})
export class MoyskladModule {}
