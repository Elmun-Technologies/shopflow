export { PrismaClient, Prisma } from "@prisma/client";
export type {
  Tenant,
  TenantSettings,
  User,
  RefreshToken,
  MoyskladAccount,
  Category,
  UnitOfMeasure,
  Warehouse,
  PriceType,
  Product,
  Variant,
  Stock,
  ProductPrice,
  Customer,
  Order,
  OrderItem,
  Payment,
  TelegramBot,
  TelegramUser,
  StorefrontSite,
  WebhookEvent,
  SyncJob,
  IkpuCode,
} from "@prisma/client";

export {
  createTenantScopedClient,
  TenantContextRequiredError,
  TENANT_SCOPED_MODELS,
} from "./tenant-context.js";
export type { TenantContext } from "./tenant-context.js";
