import { Body, Controller, HttpCode, Param, Post } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { MiniappService } from "./miniapp.service.js";
import { Public } from "../../common/auth/auth.decorators.js";

class VerifyDto {
  @IsString() @MinLength(1) initData!: string;
}

@Controller("miniapp")
export class MiniappController {
  constructor(private readonly miniapp: MiniappService) {}

  @Public()
  @HttpCode(200)
  @Post(":tenantSlug/auth/verify")
  verify(@Param("tenantSlug") tenantSlug: string, @Body() dto: VerifyDto) {
    return this.miniapp.verify(tenantSlug, dto.initData);
  }
}
