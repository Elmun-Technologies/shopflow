import {
  Module,
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  Param,
  NotFoundException,
  BadRequestException,
  Injectable,
  ConflictException,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, Matches, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { JwtService } from "@nestjs/jwt";
import { randomInt } from "node:crypto";
import type { Request } from "express";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { QueueProducerService } from "../../queue/queue-producer.service.js";
import { AppConfigService } from "../../config/app-config.service.js";
import { Public, Roles, CurrentUser, type AuthUser } from "../../common/auth/auth.decorators.js";
import { SmsOtpService } from "./sms-otp.service.js";

/**
 * Public APIs for the customer-facing surfaces (Mini App, Next.js storefront,
 * catalog) PLUS admin-side endpoints for managing the StorefrontSite row.
 *
 * Tenant resolution:
 *  - Public endpoints: Host-based (TenantContextMiddleware reads from req.headers.host
 *    and looks up StorefrontSite.subdomain / customDomain).
 *  - Admin endpoints: JWT (Authorization: Bearer …) → tenantId from claims.
 */
@Injectable()
class StorefrontService {
  constructor(private readonly db: TenantPrismaService) {}

  listProducts(q: { page?: number; perPage?: number; search?: string; categoryId?: string }) {
    const page = q.page ?? 1;
    const perPage = Math.min(q.perPage ?? 30, 100);
    const where = {
      archived: false,
      status: "ACTIVE" as const,
      stockTotal: { gt: 0 },
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
    };
    return this.db.client.product.findMany({
      where,
      orderBy: { sold: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        priceKopecks: true,
        salePriceKopecks: true,
        stockTotal: true,
        unit: true,
        image: true,
        categoryId: true,
        category: { select: { name: true, slug: true } },
      },
    });
  }

  async getProduct(slug: string) {
    const product = await this.db.client.product.findFirst({
      where: { slug } as never,
      include: { variants: true, category: true },
    });
    if (!product) throw new NotFoundException();
    return product;
  }

  listCategories() {
    return this.db.client.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, icon: true, color: true },
    });
  }

  async getCurrentSite() {
    const site = await this.db.client.storefrontSite.findFirst();
    if (!site) throw new NotFoundException("Storefront site not initialized");
    return site;
  }
}

/**
 * Handles order creation and lookup from public surfaces (Mini App, Next.js
 * storefront, catalog). The current tenant is taken from the CLS-resolved
 * tenant context (set via Host header or initData-derived JWT).
 */
@Injectable()
class StorefrontOrdersService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly raw: PrismaService,
    private readonly queue: QueueProducerService,
  ) {}

  async create(
    tenantId: string,
    channel: "TELEGRAM" | "WEBSITE" | "MINIAPP",
    dto: {
      customerId?: string;
      customerName: string;
      customerPhone?: string;
      customerEmail?: string;
      shippingAddress?: string;
      shippingMethod?: string;
      notes?: string;
      items: Array<{ productId: string; variantId?: string; quantity: number }>;
    },
  ) {
    if (!dto.items?.length) throw new BadRequestException("Order has no items");

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.db.client.product.findMany({
      where: { id: { in: productIds }, archived: false } as never,
    });
    if (products.length !== new Set(productIds).size) {
      throw new BadRequestException("One or more products not found");
    }

    let total = 0;
    let count = 0;
    const lineItems = dto.items.map((line) => {
      const p = products.find((x) => x.id === line.productId)!;
      const priceKopecks = p.salePriceKopecks ?? p.priceKopecks;
      if (line.quantity < 1) throw new BadRequestException(`Invalid quantity for ${p.id}`);
      total += priceKopecks * line.quantity;
      count += line.quantity;
      return {
        productId: p.id,
        variantId: line.variantId ?? null,
        productName: p.name,
        sku: p.sku,
        quantity: line.quantity,
        priceKopecks,
        vatPercent: p.vatPercent,
      };
    });

    // Customer: prefer the one in JWT/initData; otherwise create-or-link via phone.
    let customerId = dto.customerId ?? null;
    if (!customerId && dto.customerPhone) {
      const existing = await this.db.client.customer.findFirst({
        where: { phone: dto.customerPhone } as never,
      });
      if (existing) customerId = existing.id;
    }
    if (!customerId) {
      const created = await this.db.client.customer.create({
        data: {
          name: dto.customerName,
          phone: dto.customerPhone ?? null,
          email: dto.customerEmail ?? null,
        } as never,
      });
      customerId = created.id;
    }

    const prefix = channel === "TELEGRAM" ? "TG" : channel === "MINIAPP" ? "MA" : "WB";
    const number = `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomInt(1000, 9999)}`;

    const order = await this.db.client.order.create({
      data: {
        number,
        channel: channel as never,
        customerId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone ?? null,
        customerEmail: dto.customerEmail ?? null,
        shippingMethod: dto.shippingMethod ?? null,
        shippingAddress: dto.shippingAddress ?? null,
        notes: dto.notes ?? null,
        itemsCount: count,
        totalKopecks: total,
        items: { create: lineItems },
      } as never,
      include: { items: true },
    });

    await this.queue.enqueueOrderToMoysklad({ tenantId, orderId: order.id });

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalKopecks: order.totalKopecks,
      itemsCount: order.itemsCount,
      items: order.items,
      createdAt: order.createdAt,
    };
  }

  async getById(id: string, ownerCustomerId?: string) {
    const order = await this.db.client.order.findUnique({
      where: { id } as never,
      include: { items: true, payments: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (ownerCustomerId && order.customerId !== ownerCustomerId) {
      // Don't leak across customers within the same tenant.
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  async listForCustomer(customerId: string) {
    return this.db.client.order.findMany({
      where: { customerId } as never,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        totalKopecks: true,
        itemsCount: true,
        createdAt: true,
      },
    });
  }
}

@Injectable()
class StorefrontAdminService {
  constructor(private readonly db: TenantPrismaService, private readonly raw: PrismaService) {}

  async getMine(tenantId: string) {
    const site = await this.db.client.storefrontSite.findUnique({ where: { tenantId } } as never);
    if (!site) {
      // Create a default site lazily for tenants that don't have one yet.
      const tenant = await this.raw.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, name: true } });
      if (!tenant) throw new NotFoundException("Tenant not found");
      return this.raw.storefrontSite.create({
        data: {
          tenantId,
          subdomain: tenant.slug,
          title: tenant.name,
          theme: { primaryColor: "#10b981", accentColor: "#3b82f6" },
          published: false,
          catalogOnly: false,
        },
      });
    }
    return site;
  }

  async update(
    tenantId: string,
    dto: {
      subdomain?: string;
      customDomain?: string | null;
      title?: string;
      description?: string | null;
      theme?: Record<string, unknown>;
      featuredProductIds?: string[];
      published?: boolean;
      catalogOnly?: boolean;
    },
  ) {
    if (dto.subdomain) {
      const conflict = await this.raw.storefrontSite.findFirst({
        where: { subdomain: dto.subdomain, NOT: { tenantId } },
      });
      if (conflict) throw new ConflictException("Subdomain is already taken");
    }
    if (dto.customDomain) {
      const conflict = await this.raw.storefrontSite.findFirst({
        where: { customDomain: dto.customDomain, NOT: { tenantId } },
      });
      if (conflict) throw new ConflictException("Custom domain is already taken");
    }
    await this.getMine(tenantId); // ensure exists
    return this.raw.storefrontSite.update({
      where: { tenantId },
      data: {
        ...(dto.subdomain !== undefined ? { subdomain: dto.subdomain } : {}),
        ...(dto.customDomain !== undefined ? { customDomain: dto.customDomain } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.theme !== undefined ? { theme: dto.theme as never } : {}),
        ...(dto.featuredProductIds !== undefined ? { featuredProductIds: dto.featuredProductIds } : {}),
        ...(dto.published !== undefined ? { published: dto.published } : {}),
        ...(dto.catalogOnly !== undefined ? { catalogOnly: dto.catalogOnly } : {}),
      },
    });
  }
}

class UpdateStorefrontDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/, {
    message: "subdomain must be 2-30 chars, lowercase letters, digits, hyphens",
  })
  subdomain?: string;

  @IsOptional()
  @IsString()
  customDomain?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  theme?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featuredProductIds?: string[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  catalogOnly?: boolean;
}

class StorefrontOrderItemDto {
  @IsString() productId!: string;
  @IsOptional() @IsString() variantId?: string;
  @IsInt() @Min(1) quantity!: number;
}

class CreateStorefrontOrderDto {
  @IsString() @MinLength(1) @MaxLength(120) customerName!: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsString() customerEmail?: string;
  @IsOptional() @IsString() @MaxLength(500) shippingAddress?: string;
  @IsOptional() @IsString() shippingMethod?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StorefrontOrderItemDto)
  items!: StorefrontOrderItemDto[];
}

interface StorefrontJwt {
  sub: string;
  tenantId: string;
  role: "STOREFRONT";
  chatId?: string;
}

async function readStorefrontJwt(
  req: Request,
  jwt: JwtService,
  config: AppConfigService,
): Promise<StorefrontJwt | null> {
  const auth = req.headers["authorization"];
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return null;
  try {
    return await jwt.verifyAsync<StorefrontJwt>(auth.slice(7), { secret: config.jwtAccessSecret });
  } catch {
    return null;
  }
}

@Controller("storefront")
class StorefrontController {
  constructor(
    private readonly storefront: StorefrontService,
    private readonly orders: StorefrontOrdersService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get("site")
  publicSite() {
    return this.storefront.getCurrentSite();
  }

  @Public()
  @Get("products")
  list(@Query() q: Record<string, string>) {
    return this.storefront.listProducts({
      page: q.page ? Number(q.page) : 1,
      perPage: q.perPage ? Number(q.perPage) : 30,
      search: q.search,
      categoryId: q.categoryId,
    });
  }

  @Public()
  @Get("products/:slug")
  get(@Param("slug") slug: string) {
    return this.storefront.getProduct(slug);
  }

  @Public()
  @Get("categories")
  cats() {
    return this.storefront.listCategories();
  }

  /**
   * Create an order from the public surface. Requires a tenant in CLS
   * context (set by host header or Mini App JWT). If a STOREFRONT JWT is
   * present, customer is auto-resolved from `sub`; otherwise we create or
   * link a Customer by phone.
   */
  @Public()
  @Post("orders")
  async createOrder(@Req() req: Request, @Body() dto: CreateStorefrontOrderDto) {
    const tenantId = await this.requireTenant(req);
    const jwt = await readStorefrontJwt(req, this.jwt, this.config);
    const channel = jwt?.chatId ? "MINIAPP" : "WEBSITE";
    return this.orders.create(tenantId, channel, {
      customerId: jwt?.sub,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail,
      shippingAddress: dto.shippingAddress,
      shippingMethod: dto.shippingMethod,
      notes: dto.notes,
      items: dto.items,
    });
  }

  /**
   * Order status check. If called with a STOREFRONT JWT, returns only the
   * caller's own orders. Otherwise (e.g. order tracking link in email),
   * authentication-less access is allowed by id since we never return PII
   * beyond what the customer already submitted.
   */
  @Public()
  @Get("orders/:id")
  async getOrder(@Req() req: Request, @Param("id") id: string) {
    await this.requireTenant(req);
    const jwt = await readStorefrontJwt(req, this.jwt, this.config);
    return this.orders.getById(id, jwt?.sub);
  }

  /** Returns the authenticated customer's order history. Mini App only. */
  @Public()
  @Get("orders")
  async myOrders(@Req() req: Request) {
    await this.requireTenant(req);
    const jwt = await readStorefrontJwt(req, this.jwt, this.config);
    if (!jwt) throw new UnauthorizedException();
    return this.orders.listForCustomer(jwt.sub);
  }

  private async requireTenant(req: Request): Promise<string> {
    const jwt = await readStorefrontJwt(req, this.jwt, this.config);
    if (jwt?.tenantId) return jwt.tenantId;
    // Tenant might have been resolved from Host already by TenantContextMiddleware.
    const authedTenant = (req as Request & { auth?: { tenantId?: string } }).auth?.tenantId;
    if (authedTenant) return authedTenant;
    // Last-resort: re-resolve from Host via the storefront site lookup.
    throw new BadRequestException("Tenant could not be resolved");
  }
}

@Controller("storefront-admin")
@Roles("OWNER", "MANAGER", "OPERATOR", "READONLY")
class StorefrontAdminController {
  constructor(private readonly admin: StorefrontAdminService) {}

  @Get("site")
  get(@CurrentUser() user: AuthUser) {
    return this.admin.getMine(user.tenantId);
  }

  @Put("site")
  @Roles("OWNER", "MANAGER")
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateStorefrontDto) {
    return this.admin.update(user.tenantId, dto);
  }
}

class OtpRequestDto {
  @IsString() @MinLength(3) tenantSlug!: string;
  @IsString() @MinLength(9) phone!: string;
}

class OtpVerifyDto {
  @IsString() @MinLength(3) tenantSlug!: string;
  @IsString() @MinLength(9) phone!: string;
  @IsString() @MinLength(4) code!: string;
}

@Controller("storefront/auth")
class StorefrontAuthController {
  constructor(private readonly otp: SmsOtpService) {}

  @Public()
  @Post("request-otp")
  request(@Body() dto: OtpRequestDto) {
    return this.otp.requestOtp(dto.tenantSlug, dto.phone);
  }

  @Public()
  @Post("verify-otp")
  verify(@Body() dto: OtpVerifyDto) {
    return this.otp.verifyOtp(dto.tenantSlug, dto.phone, dto.code);
  }
}

@Module({
  controllers: [StorefrontController, StorefrontAdminController, StorefrontAuthController],
  providers: [StorefrontService, StorefrontAdminService, StorefrontOrdersService, SmsOtpService],
})
export class StorefrontModule {}
