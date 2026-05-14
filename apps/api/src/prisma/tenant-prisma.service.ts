import { Injectable } from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { createTenantScopedClient, type TenantContext } from "@shopflow/db/tenant-context";
import { PrismaService } from "./prisma.service.js";

export const TENANT_CONTEXT_CLS_KEY = "tenantContext";

/**
 * Returns a Prisma client that automatically filters every query by the tenant
 * stored in the request-scoped CLS context. Throws if no context is set.
 *
 * Use `runWithTenant(tenantId, fn)` from system code (workers, schedulers).
 */
@Injectable()
export class TenantPrismaService {
  readonly client: ReturnType<typeof createTenantScopedClient>;

  constructor(private readonly prisma: PrismaService, private readonly cls: ClsService) {
    this.client = createTenantScopedClient(this.prisma, () => {
      return this.cls.get<TenantContext | undefined>(TENANT_CONTEXT_CLS_KEY) ?? null;
    });
  }

  /** Run a callback with an explicit tenant context (workers, jobs, tests). */
  async runWithTenant<T>(tenantId: string, fn: () => Promise<T>, bypass = false): Promise<T> {
    return this.cls.runWith({ [TENANT_CONTEXT_CLS_KEY]: { tenantId, bypass } as TenantContext } as never, fn);
  }

  /** Escape hatch — use only for system tables (Tenant, IkpuCode) or admin tooling. */
  get raw(): PrismaService {
    return this.prisma;
  }
}
