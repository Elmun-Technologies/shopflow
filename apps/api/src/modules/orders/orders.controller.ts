import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { OrdersService } from "./orders.service.js";
import { CurrentUser, Roles, type AuthUser } from "../../common/auth/auth.decorators.js";
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested, ArrayMinSize, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

class CreateOrderItemDto {
  @IsString() productId!: string;
  @IsOptional() @IsString() variantId?: string;
  @IsInt() @Min(1) quantity!: number;
}

class CreateOrderDto {
  @IsString() customerName!: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsString() customerEmail?: string;
  @IsOptional() @IsString() warehouseId?: string;
  @IsOptional() @IsString() shippingMethod?: string;
  @IsOptional() @IsString() shippingAddress?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

@Controller("orders")
@Roles("OWNER", "MANAGER", "OPERATOR", "READONLY")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.orders.list({
      page: query.page ? Number(query.page) : 1,
      perPage: query.perPage ? Number(query.perPage) : 50,
      search: query.search,
      status: query.status,
      paymentStatus: query.paymentStatus,
      channel: query.channel,
      customerId: query.customerId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.orders.findById(id);
  }

  @Post()
  @Roles("OWNER", "MANAGER", "OPERATOR")
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create("ADMIN", user.tenantId, dto);
  }
}
