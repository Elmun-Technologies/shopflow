import { Module, Controller, Get, Query, Param, NotFoundException, Injectable } from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service.js";
import { Public } from "../../common/auth/auth.decorators.js";

/**
 * Public APIs for the customer-facing surfaces: Telegram Mini App,
 * the storefront Next.js site, and the catalog. Tenant is resolved by
 * TenantContextMiddleware from the request host (or :tenantId param for the
 * Mini App after initData exchange). No auth required — endpoints only expose
 * published catalog data.
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
}

@Controller("storefront")
class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

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

@Module({ controllers: [StorefrontController], providers: [StorefrontService] })
export class StorefrontModule {}
