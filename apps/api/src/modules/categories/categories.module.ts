import { Module, Controller, Get, Injectable } from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service.js";
import { Roles } from "../../common/auth/auth.decorators.js";

@Injectable()
class CategoriesService {
  constructor(private readonly db: TenantPrismaService) {}
  list() {
    return this.db.client.category.findMany({ orderBy: { name: "asc" } });
  }
}

@Controller("categories")
@Roles("OWNER", "MANAGER", "OPERATOR", "READONLY")
class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}
  @Get()
  list() {
    return this.categories.list();
  }
}

@Module({ controllers: [CategoriesController], providers: [CategoriesService] })
export class CategoriesModule {}
