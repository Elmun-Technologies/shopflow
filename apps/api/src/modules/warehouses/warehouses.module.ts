import { Module, Controller, Get, Injectable } from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service.js";
import { Roles } from "../../common/auth/auth.decorators.js";

@Injectable()
class WarehousesService {
  constructor(private readonly db: TenantPrismaService) {}
  list() {
    return this.db.client.warehouse.findMany({ orderBy: { name: "asc" } });
  }
}

@Controller("warehouses")
@Roles("OWNER", "MANAGER", "OPERATOR", "READONLY")
class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}
  @Get()
  list() {
    return this.warehouses.list();
  }
}

@Module({ controllers: [WarehousesController], providers: [WarehousesService] })
export class WarehousesModule {}
