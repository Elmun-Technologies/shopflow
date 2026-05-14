import {
  Module,
  Controller,
  Get,
  Post,
  Query,
  Param,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service.js";
import { QueueProducerService } from "../../queue/queue-producer.service.js";
import { CurrentUser, Roles, type AuthUser } from "../../common/auth/auth.decorators.js";

@Injectable()
class SyncService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly queue: QueueProducerService,
  ) {}

  recentJobs(limit: number) {
    return this.db.client.syncJob.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    });
  }

  recentEvents(limit: number, onlyFailed: boolean) {
    return this.db.client.webhookEvent.findMany({
      where: onlyFailed ? { error: { not: null } } : undefined,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
      select: {
        id: true,
        source: true,
        entityType: true,
        action: true,
        idempotencyKey: true,
        entityMoyskladId: true,
        attempts: true,
        processedAt: true,
        error: true,
        createdAt: true,
      },
    });
  }

  async retryEvent(tenantId: string, eventId: string) {
    const event = await this.db.client.webhookEvent.findUnique({
      where: { id: eventId } as never,
    });
    if (!event) throw new NotFoundException("Webhook event not found");

    // Reset state so the processor picks it up as new.
    await this.db.client.webhookEvent.update({
      where: { id: eventId } as never,
      data: { processedAt: null, error: null, attempts: { increment: 1 } },
    });
    await this.queue.enqueueWebhookEventRetry({ tenantId, webhookEventId: eventId });
    return { queued: true, attempt: event.attempts + 1 };
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
  events(@Query("limit") limit?: string, @Query("onlyFailed") onlyFailed?: string) {
    return this.sync.recentEvents(limit ? Number(limit) : 100, onlyFailed === "true");
  }

  @Post("events/:id/retry")
  @Roles("OWNER", "MANAGER")
  retry(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.sync.retryEvent(user.tenantId, id);
  }
}

@Module({ controllers: [SyncController], providers: [SyncService] })
export class SyncModule {}
