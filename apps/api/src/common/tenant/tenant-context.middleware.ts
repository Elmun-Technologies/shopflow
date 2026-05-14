import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { ClsService } from "nestjs-cls";
import { JwtService } from "@nestjs/jwt";
import { TENANT_CONTEXT_CLS_KEY } from "../../prisma/tenant-prisma.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AppConfigService } from "../../config/app-config.service.js";
import type { TenantContext } from "@shopflow/db/tenant-context";

interface AccessPayload {
  sub: string;
  tenantId: string;
  role: string;
}

/**
 * Resolves the tenant for the current request from (in priority order):
 *  1. JWT in `Authorization: Bearer …` (admin SPA, miniapp after initData exchange)
 *  2. `:tenantId` URL param on `/webhooks/*` and `/tg/*` routes
 *  3. Host header against `Tenant.slug` or `customDomain` (storefront)
 *
 * The result is stored in CLS and consumed by `TenantPrismaService`.
 * Public/health/auth routes simply continue without a context.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(
    private readonly cls: ClsService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    let ctx: TenantContext | null = null;

    const authHeader = req.headers["authorization"];
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const payload = await this.jwt.verifyAsync<AccessPayload>(token, {
          secret: this.config.jwtAccessSecret,
        });
        if (payload?.tenantId) {
          ctx = { tenantId: payload.tenantId };
          (req as Request & { auth?: AccessPayload }).auth = payload;
        }
      } catch {
        // Falls through to other resolution strategies; JwtAuthGuard will reject if needed.
      }
    }

    if (!ctx) {
      const params = req.params as Record<string, string | undefined> | undefined;
      const urlTenant = params?.tenantId;
      if (urlTenant) {
        ctx = { tenantId: urlTenant };
      }
    }

    if (!ctx) {
      const host = (req.headers["host"] ?? "").toString().split(":")[0];
      if (host && !this.isInternalHost(host)) {
        const tenant = await this.prisma.tenant.findFirst({
          where: {
            OR: [{ customDomain: host }, { slug: this.subdomainOf(host) ?? "__none__" }],
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (tenant) {
          ctx = { tenantId: tenant.id };
        }
      }
    }

    if (ctx) {
      this.cls.set(TENANT_CONTEXT_CLS_KEY, ctx);
    }

    next();
  }

  private subdomainOf(host: string): string | null {
    const parts = host.split(".");
    if (parts.length < 3) return null;
    return parts[0] ?? null;
  }

  private isInternalHost(host: string): boolean {
    return host === "localhost" || host.startsWith("127.") || host === "api.shopflow.uz" || host === "admin.shopflow.uz";
  }
}
