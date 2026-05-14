import { Module, Controller, Get, Query, Injectable } from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service.js";
import { Roles } from "../../common/auth/auth.decorators.js";

@Injectable()
class SyncService {
  constructor(private readonly db: TenantPrismaService) {}

  recentJobs(limit: number) {
    return this.db.client.syncJob.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });
  }

  recentEvents(limit: number) {
    return this.db.client.webhookEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
      select: {
        id: true, source: true, entityType: true, action: true,
        processedAt: true, error: true, createdAt: true,
      },
    });
  }
}

@Controller("sync")
@Roles("OWNER", "MANAGER", "OPERATOR", "READONLY")
class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get("jobs")
  jobs(@Query("limit") limit?: string) {
    return this.sync.recentJobs(limit ? Number(limit) : 50);
  }

  @Get("events")
  events(@Query("limit") limit?: string) {
    return this.sync.recentEvents(limit ? Number(limit) : 100);
  }
}

@Module({ controllers: [SyncController], providers: [SyncService] })
export class SyncModule {}
