import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SecretCipherService } from "../../common/crypto/secret-cipher.service.js";

const PROVIDERS = ["CLICK", "PAYME"] as const;
type Provider = (typeof PROVIDERS)[number];

@Injectable()
export class PaymentsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipherService,
  ) {}

  async listForTenant(tenantId: string) {
    const rows = await this.prisma.paymentProviderConfig.findMany({
      where: { tenantId },
    });
    return PROVIDERS.map((provider) => {
      const cfg = rows.find((r) => r.provider === provider);
      return {
        provider,
        enabled: cfg?.enabled ?? false,
        configured: !!cfg?.encryptedSecret,
        publicConfig: cfg?.publicConfig ?? {},
        lastEventAt: cfg?.lastEventAt?.toISOString() ?? null,
        lastError: cfg?.lastError ?? null,
      };
    });
  }

  async upsert(
    tenantId: string,
    provider: Provider,
    dto: { enabled: boolean; publicConfig: Record<string, unknown>; secret?: string },
  ) {
    const data: Record<string, unknown> = {
      enabled: dto.enabled,
      publicConfig: dto.publicConfig as never,
    };
    if (dto.secret) data.encryptedSecret = this.cipher.encrypt(dto.secret);

    return this.prisma.paymentProviderConfig.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      create: {
        tenantId,
        provider,
        enabled: dto.enabled,
        publicConfig: dto.publicConfig as never,
        encryptedSecret: dto.secret ? this.cipher.encrypt(dto.secret) : null,
      },
      update: data as never,
    });
  }

  async disable(tenantId: string, provider: Provider) {
    const cfg = await this.prisma.paymentProviderConfig.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!cfg) throw new NotFoundException("Provider not configured");
    return this.prisma.paymentProviderConfig.update({
      where: { id: cfg.id },
      data: { enabled: false },
    });
  }
}
