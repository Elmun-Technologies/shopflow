import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SecretCipherService } from "../../common/crypto/secret-cipher.service.js";
import { MoyskladClient } from "../moysklad/moysklad.client.js";
import { QueueProducerService } from "../../queue/queue-producer.service.js";

@Injectable()
export class MoyskladIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipherService,
    private readonly client: MoyskladClient,
    private readonly queue: QueueProducerService,
  ) {}

  async getStatus(tenantId: string) {
    const acc = await this.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (!acc) {
      return { tenantId, status: "DISCONNECTED" as const, webhookSubscriptionIds: [] };
    }
    return {
      tenantId,
      status: acc.status,
      accountUuid: acc.accountUuid,
      connectedAt: acc.connectedAt?.toISOString() ?? null,
      lastWebhookAt: acc.lastWebhookAt?.toISOString() ?? null,
      lastSyncAt: acc.lastSyncAt?.toISOString() ?? null,
      lastError: acc.lastError,
      webhookSubscriptionIds: acc.webhookSubscriptionIds,
    };
  }

  async connect(tenantId: string, token: string) {
    const test = await this.client.testConnection(token);
    if (!test.ok) {
      throw new BadRequestException(test.error ?? "Failed to validate MoySklad token");
    }

    const encryptedToken = this.cipher.encrypt(token);

    const account = await this.prisma.moyskladAccount.upsert({
      where: { tenantId },
      create: {
        tenantId,
        encryptedToken,
        accountUuid: test.accountUuid ?? null,
        status: "CONNECTING",
        connectedAt: new Date(),
      },
      update: {
        encryptedToken,
        accountUuid: test.accountUuid ?? null,
        status: "CONNECTING",
        connectedAt: new Date(),
        lastError: null,
      },
    });

    const syncJob = await this.prisma.syncJob.create({
      data: { tenantId, type: "INITIAL_IMPORT", status: "QUEUED" },
    });
    await this.queue.enqueueInitialImport({ tenantId, syncJobId: syncJob.id });
    await this.queue.enqueueSubscribeWebhooks({ tenantId });

    return { account: { status: account.status, accountUuid: account.accountUuid }, syncJobId: syncJob.id };
  }

  async disconnect(tenantId: string) {
    const acc = await this.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (!acc) throw new NotFoundException("MoySklad not connected");
    await this.prisma.moyskladAccount.delete({ where: { tenantId } });
    return { ok: true };
  }

  async triggerResync(tenantId: string) {
    const acc = await this.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (!acc) throw new NotFoundException("MoySklad not connected");
    const syncJob = await this.prisma.syncJob.create({
      data: { tenantId, type: "INCREMENTAL_SYNC", status: "QUEUED" },
    });
    await this.queue.enqueueIncrementalSync({ tenantId });
    return { syncJobId: syncJob.id };
  }
}
