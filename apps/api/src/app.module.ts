import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { ClsModule } from "nestjs-cls";

import { AppConfigModule } from "./config/app-config.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { HealthModule } from "./health/health.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { TenantModule } from "./modules/tenant/tenant.module.js";
import { ProductsModule } from "./modules/products/products.module.js";
import { OrdersModule } from "./modules/orders/orders.module.js";
import { CustomersModule } from "./modules/customers/customers.module.js";
import { CategoriesModule } from "./modules/categories/categories.module.js";
import { WarehousesModule } from "./modules/warehouses/warehouses.module.js";
import { IntegrationsModule } from "./modules/integrations/integrations.module.js";
import { MoyskladModule } from "./modules/moysklad/moysklad.module.js";
import { TelegramModule } from "./modules/telegram/telegram.module.js";
import { StorefrontModule } from "./modules/storefront/storefront.module.js";
import { MiniappModule } from "./modules/miniapp/miniapp.module.js";
import { SyncModule } from "./modules/sync/sync.module.js";
import { WebhooksModule } from "./modules/webhooks/webhooks.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { TenantContextMiddleware } from "./common/tenant/tenant-context.middleware.js";
import { JwtAuthGuard } from "./common/auth/jwt-auth.guard.js";
import { RolesGuard } from "./common/auth/roles.guard.js";
import { MiddlewareConsumer, NestModule } from "@nestjs/common";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),

    PrismaModule,
    QueueModule,

    HealthModule,
    AuthModule,
    TenantModule,
    CategoriesModule,
    WarehousesModule,
    ProductsModule,
    OrdersModule,
    CustomersModule,
    IntegrationsModule,
    MoyskladModule,
    TelegramModule,
    StorefrontModule,
    MiniappModule,
    SyncModule,
    WebhooksModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes("*");
  }
}
