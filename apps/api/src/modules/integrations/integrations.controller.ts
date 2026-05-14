import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { IsIn, IsString, MinLength } from "class-validator";
import { MoyskladIntegrationService } from "./moysklad-integration.service.js";
import { TelegramIntegrationService } from "./telegram-integration.service.js";
import { CurrentUser, Roles, type AuthUser } from "../../common/auth/auth.decorators.js";

class TokenDto {
  @IsString() @MinLength(8) token!: string;
}

const RESYNC_ENTITIES = ["product", "variant", "productfolder", "customerorder", "counterparty", "stock"] as const;
type ResyncEntity = (typeof RESYNC_ENTITIES)[number];

class ResyncEntityParam {
  @IsString() @IsIn(RESYNC_ENTITIES as unknown as string[]) entity!: ResyncEntity;
}

@Controller("integrations")
@Roles("OWNER", "MANAGER")
export class IntegrationsController {
  constructor(
    private readonly moysklad: MoyskladIntegrationService,
    private readonly telegram: TelegramIntegrationService,
  ) {}

  @Get("moysklad")
  msStatus(@CurrentUser() user: AuthUser) {
    return this.moysklad.getStatus(user.tenantId);
  }

  @Post("moysklad")
  @Roles("OWNER")
  msConnect(@CurrentUser() user: AuthUser, @Body() dto: TokenDto) {
    return this.moysklad.connect(user.tenantId, dto.token);
  }

  @Post("moysklad/resync")
  msResync(@CurrentUser() user: AuthUser) {
    return this.moysklad.triggerResync(user.tenantId);
  }

  @Post("moysklad/resync/:entity")
  msResyncEntity(@CurrentUser() user: AuthUser, @Param() p: ResyncEntityParam) {
    return this.moysklad.triggerResync(user.tenantId, p.entity);
  }

  @Post("moysklad/reconcile")
  msReconcile(@CurrentUser() user: AuthUser) {
    return this.moysklad.reconcile(user.tenantId);
  }

  @Delete("moysklad")
  @Roles("OWNER")
  msDisconnect(@CurrentUser() user: AuthUser) {
    return this.moysklad.disconnect(user.tenantId);
  }

  @Get("telegram")
  tgStatus(@CurrentUser() user: AuthUser) {
    return this.telegram.getStatus(user.tenantId);
  }

  @Post("telegram")
  @Roles("OWNER")
  tgConnect(@CurrentUser() user: AuthUser, @Body() dto: TokenDto) {
    return this.telegram.connect(user.tenantId, dto.token);
  }

  @Delete("telegram")
  @Roles("OWNER")
  tgDisconnect(@CurrentUser() user: AuthUser) {
    return this.telegram.disconnect(user.tenantId);
  }
}
