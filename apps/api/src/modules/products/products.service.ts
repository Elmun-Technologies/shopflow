import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service.js";
import type { ProductListQuery } from "@shopflow/shared-types";

@Injectable()
export class ProductsService {
  constructor(private readonly db: TenantPrismaService) {}

  async list(q: ProductListQuery) {
    const page = q.page ?? 1;
    const perPage = Math.min(q.perPage ?? 50, 200);

    const where = {
      archived: false,
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { sku: { contains: q.search, mode: "insensitive" as const } },
              { barcode: { contains: q.search } },
            ],
          }
        : {}),
      ...(q.inStock ? { stockTotal: { gt: 0 } } : {}),
    };

    const [data, total] = await Promise.all([
      this.db.client.product.findMany({
        where,
        orderBy: q.sortBy
          ? { [q.sortBy]: q.sortOrder ?? "asc" }
          : { updatedAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.db.client.product.count({ where }),
    ]);

    return { data, total, page, perPage };
  }

  async findById(id: string) {
    const product = await this.db.client.product.findUnique({
      where: { id } as never,
      include: { variants: true, prices: true, stocks: { include: { warehouse: true } } },
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }
}
