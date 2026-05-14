import { PrismaClient, Prisma } from "@prisma/client";

export interface TenantContext {
  tenantId: string;
  /** When true, Prisma queries on tenant-scoped models will be skipped (for system jobs that intentionally cross tenants). */
  bypass?: boolean;
}

export class TenantContextRequiredError extends Error {
  constructor(model: string, operation: string) {
    super(
      `TenantContextRequiredError: query to "${model}.${operation}" attempted without tenant context. ` +
        `Wrap the call in tenantPrisma.$transaction or use the request-scoped client.`,
    );
    this.name = "TenantContextRequiredError";
  }
}

/**
 * Every model below carries a `tenantId` column and must be filtered by tenant.
 * If you add a new tenant-scoped model to schema.prisma, add it here too.
 */
export const TENANT_SCOPED_MODELS = new Set([
  "TenantSettings",
  "User",
  "RefreshToken",
  "MoyskladAccount",
  "Category",
  "UnitOfMeasure",
  "Warehouse",
  "PriceType",
  "Product",
  "Variant",
  "Stock",
  "ProductPrice",
  "Customer",
  "Order",
  "OrderItem",
  "Payment",
  "TelegramBot",
  "TelegramUser",
  "StorefrontSite",
  "WebhookEvent",
  "SyncJob",
]);

const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

const WRITE_BATCH_OPERATIONS = new Set([
  "updateMany",
  "deleteMany",
]);

const WRITE_SINGLE_OPERATIONS = new Set([
  "update",
  "delete",
  "upsert",
]);

const CREATE_OPERATIONS = new Set(["create", "createMany"]);

/**
 * Wraps a PrismaClient with a tenant-scoping extension.
 *
 * - Read/update/delete queries on tenant-scoped models get `where: { tenantId, ... }`.
 * - Create/createMany inject `data: { tenantId, ... }`.
 * - Calls without a `TenantContext` throw `TenantContextRequiredError`.
 *
 * Use `ctx.bypass = true` for trusted system code that must cross tenants
 * (e.g. boot-time loading of all enabled TelegramBots, scheduled reconcile jobs).
 */
export function createTenantScopedClient(
  base: PrismaClient,
  getContext: () => TenantContext | null,
) {
  return base.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }
          const ctx = getContext();
          if (!ctx) {
            throw new TenantContextRequiredError(model, operation);
          }
          if (ctx.bypass) {
            return query(args);
          }
          const tenantId = ctx.tenantId;

          if (CREATE_OPERATIONS.has(operation)) {
            const a = args as { data: Record<string, unknown> | Record<string, unknown>[] };
            if (Array.isArray(a.data)) {
              a.data = a.data.map((row) => ({ ...row, tenantId }));
            } else {
              a.data = { ...a.data, tenantId };
            }
            return query(args);
          }

          if (
            READ_OPERATIONS.has(operation) ||
            WRITE_BATCH_OPERATIONS.has(operation) ||
            WRITE_SINGLE_OPERATIONS.has(operation)
          ) {
            const a = args as { where?: Record<string, unknown> };
            a.where = { ...(a.where ?? {}), tenantId };
            return query(args);
          }

          return query(args);
        },
      },
    },
  });
}

export type TenantScopedClient = ReturnType<typeof createTenantScopedClient>;

export { Prisma };
