import { Body, Controller, Get, Patch } from "@nestjs/common";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { TenantService } from "./tenant.service.js";
import { CurrentUser, Roles, type AuthUser } from "../../common/auth/auth.decorators.js";

class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  customDomain?: string | null;
}

class UpdateSettingsDto {
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() defaultWarehouseId?: string | null;
  @IsOptional() @IsString() defaultPriceTypeId?: string | null;
}

@Controller("tenant")
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.tenant.findById(user.tenantId);
  }

  @Patch("me")
  @Roles("OWNER")
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateTenantDto) {
    return this.tenant.update(user.tenantId, dto);
  }

  @Get("settings")
  settings(@CurrentUser() user: AuthUser) {
    return this.tenant.getSettings(user.tenantId);
  }

  @Patch("settings")
  @Roles("OWNER", "MANAGER")
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.tenant.updateSettings(user.tenantId, dto);
  }
}
