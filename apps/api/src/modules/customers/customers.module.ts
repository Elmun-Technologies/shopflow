import { Module } from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service.js";
import { Controller, Get, Query, Param, NotFoundException, Injectable } from "@nestjs/common";
import { Roles } from "../../common/auth/auth.decorators.js";

@Injectable()
class CustomersService {
  constructor(private readonly db: TenantPrismaService) {}

  async list(q: { page?: number; perPage?: number; search?: string }) {
    const page = q.page ?? 1;
    const perPage = Math.min(q.perPage ?? 50, 200);
    const where = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" as const } },
            { phone: { contains: q.search } },
            { email: { contains: q.search, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      this.db.client.customer.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
      this.db.client.customer.count({ where }),
    ]);
    return { data, total, page, perPage };
  }

  async findById(id: string) {
    const c = await this.db.client.customer.findUnique({ where: { id } as never });
    if (!c) throw new NotFoundException("Customer not found");
    return c;
  }
}

@Controller("customers")
@Roles("OWNER", "MANAGER", "OPERATOR", "READONLY")
class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query() q: Record<string, string>) {
    return this.customers.list({
      page: q.page ? Number(q.page) : undefined,
      perPage: q.perPage ? Number(q.perPage) : undefined,
      search: q.search,
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.customers.findById(id);
  }
}

@Module({ controllers: [CustomersController], providers: [CustomersService] })
export class CustomersModule {}
