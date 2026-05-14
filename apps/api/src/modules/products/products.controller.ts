import { Controller, Get, Param, Query } from "@nestjs/common";
import { ProductsService } from "./products.service.js";
import { Roles } from "../../common/auth/auth.decorators.js";

@Controller("products")
@Roles("OWNER", "MANAGER", "OPERATOR", "READONLY")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    return this.products.list({
      page: query.page ? Number(query.page) : 1,
      perPage: query.perPage ? Number(query.perPage) : 50,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder === "desc" ? "desc" : "asc",
      categoryId: query.categoryId,
      warehouseId: query.warehouseId,
      status: query.status,
      inStock: query.inStock === "true",
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.products.findById(id);
  }
}
