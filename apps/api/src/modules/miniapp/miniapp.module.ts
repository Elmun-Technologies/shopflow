import { Module } from "@nestjs/common";
import { MiniappController } from "./miniapp.controller.js";
import { MiniappService } from "./miniapp.service.js";

@Module({
  controllers: [MiniappController],
  providers: [MiniappService],
})
export class MiniappModule {}
