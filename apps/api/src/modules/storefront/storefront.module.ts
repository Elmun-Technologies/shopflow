import {
  Module,
  Controller,
  Get,
  Put,
  Body,
  Query,
  Param,
  NotFoundException,
  Injectable,
  ConflictException,
} from "@nestjs/common";
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength, Matches } from "class-validator";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { Public, Roles, CurrentUser, type AuthUser } from "../../common/auth/auth.decorators.js";

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

@Controller("storefront")
class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

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

@Module({
  controllers: [StorefrontController, StorefrontAdminController],
  providers: [StorefrontService, StorefrontAdminService],
})
export class StorefrontModule {}
