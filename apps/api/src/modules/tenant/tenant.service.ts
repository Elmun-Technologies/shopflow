import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant;
  }

  update(tenantId: string, dto: { name?: string; customDomain?: string | null }) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
    });
  }

  async getSettings(tenantId: string) {
    const settings = await this.prisma.tenantSettings.findUnique({ where: { tenantId } });
    if (!settings) throw new NotFoundException("Tenant settings not initialized");
    return settings;
  }

  updateSettings(
    tenantId: string,
    dto: Partial<{ currency: string; timezone: string; language: string; defaultWarehouseId: string | null; defaultPriceTypeId: string | null }>,
  ) {
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...dto } as never,
      update: dto,
    });
  }
}
