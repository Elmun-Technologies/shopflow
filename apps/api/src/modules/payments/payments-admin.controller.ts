import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MinLength } from "class-validator";
import { PaymentsAdminService } from "./payments-admin.service.js";
import { PaymentsService } from "./payments.service.js";
import { CurrentUser, Public, Roles, type AuthUser } from "../../common/auth/auth.decorators.js";

const PROVIDERS = ["CLICK", "PAYME"] as const;
type ProviderName = (typeof PROVIDERS)[number];

class UpsertProviderDto {
  @IsBoolean() enabled!: boolean;
  @IsObject() publicConfig!: Record<string, unknown>;
  @IsOptional() @IsString() @MinLength(8) secret?: string;
}

class ProviderParam {
  @IsIn(PROVIDERS as unknown as string[]) provider!: ProviderName;
}

@Controller("integrations/payments")
@Roles("OWNER", "MANAGER")
export class PaymentsAdminController {
  constructor(
    private readonly admin: PaymentsAdminService,
    private readonly payments: PaymentsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.admin.listForTenant(user.tenantId);
  }

  @Post(":provider")
  @Roles("OWNER")
  upsert(
    @CurrentUser() user: AuthUser,
    @Param() p: ProviderParam,
    @Body() dto: UpsertProviderDto,
  ) {
    return this.admin.upsert(user.tenantId, p.provider, dto);
  }

  @Delete(":provider")
  @Roles("OWNER")
  disable(@CurrentUser() user: AuthUser, @Param() p: ProviderParam) {
    return this.admin.disable(user.tenantId, p.provider);
  }

  /**
   * Public endpoint — the storefront and Mini App ask for payment links
   * for a specific order. Auth-less: order id is unguessable (uuid v4).
   */
  @Public()
  @Get("/links/:orderId")
  links(@Param("orderId") orderId: string) {
    return this.payments.buildPaymentLinks(orderId);
  }
}
