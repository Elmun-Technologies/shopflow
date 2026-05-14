import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PrismaProvider } from "../prisma.provider.js";
import { WorkerMoyskladClient } from "../moysklad/moysklad.client.js";

interface JobData {
  tenantId: string;
  orderId: string;
}

/**
 * Pushes a ShopFlow Order to MoySklad as a `customerorder`. We resolve the
 * counterparty (creating one if needed), then POST positions referencing each
 * product/variant by their MoySklad meta. After success, store the returned
 * MoySklad id on the local Order row.
 */
@Injectable()
@Processor("outbound-sync", { concurrency: 4 })
export class OutboundOrderProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboundOrderProcessor.name);

  constructor(private readonly prisma: PrismaProvider, private readonly ms: WorkerMoyskladClient) {
    super();
  }

  async process(job: Job<JobData>): Promise<void> {
    if (job.name !== "order-to-moysklad") return;
    const { tenantId, orderId } = job.data;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true, variant: true } }, warehouse: true, customer: true },
    });
    if (!order || order.moyskladId) return;

    const acc = await this.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (!acc || acc.status !== "CONNECTED") {
      this.logger.warn(`Skip outbound order ${orderId}: MoySklad not connected`);
      return;
    }

    const agent = await this.resolveCounterparty(tenantId, order);
    const store = order.warehouse?.moyskladId
      ? { meta: this.meta(`store/${order.warehouse.moyskladId}`) }
      : await this.resolveDefaultStore(tenantId);

    const positions = order.items.map((item) => {
      const assortType = item.variant?.moyskladId ? "variant" : "product";
      const assortId = item.variant?.moyskladId ?? item.product.moyskladId;
      if (!assortId) {
        throw new Error(`Cannot push order ${orderId}: item ${item.id} has no MoySklad id`);
      }
      return {
        quantity: item.quantity,
        price: item.priceKopecks,
        vat: item.vatPercent,
        assortment: { meta: this.meta(`${assortType}/${assortId}`) },
      };
    });

    const payload: Record<string, unknown> = {
      name: order.number,
      moment: order.createdAt.toISOString().slice(0, 19).replace("T", " "),
      agent: agent ? { meta: this.meta(`counterparty/${agent.moyskladId}`) } : undefined,
      store,
      positions,
      description: this.buildDescription(order),
    };

    try {
      const created = await this.ms.post<{ id: string; name: string }>(tenantId, "/entity/customerorder", payload);
      await this.prisma.order.update({
        where: { id: orderId },
        data: { moyskladId: created.id, syncedAt: new Date() },
      });
      this.logger.log(`Order ${orderId} pushed to MoySklad as ${created.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to push order ${orderId}: ${message}`);
      throw err;
    }
  }

  private async resolveCounterparty(tenantId: string, order: { customerName: string; customerPhone: string | null; customerEmail: string | null; customerId: string | null }) {
    if (order.customerId) {
      const c = await this.prisma.customer.findUnique({ where: { id: order.customerId } });
      if (c?.moyskladId) return c;
    }

    if (order.customerPhone) {
      const existing = await this.prisma.customer.findFirst({
        where: { tenantId, phone: order.customerPhone },
      });
      if (existing?.moyskladId) return existing;
    }

    // Create a new counterparty in MoySklad.
    const created = await this.ms.post<{ id: string; name: string }>(tenantId, "/entity/counterparty", {
      name: order.customerName,
      phone: order.customerPhone ?? undefined,
      email: order.customerEmail ?? undefined,
      tags: ["shopflow"],
    });
    const local = await this.prisma.customer.create({
      data: {
        tenantId,
        moyskladId: created.id,
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        syncedAt: new Date(),
      },
    });
    return local;
  }

  private async resolveDefaultStore(tenantId: string) {
    const w = await this.prisma.warehouse.findFirst({ where: { tenantId, moyskladId: { not: null } } });
    if (!w?.moyskladId) throw new Error("No MoySklad warehouse available");
    return { meta: this.meta(`store/${w.moyskladId}`) };
  }

  private meta(suffix: string) {
    return {
      href: `https://api.moysklad.ru/api/remap/1.2/entity/${suffix}`,
      type: suffix.split("/")[0],
      mediaType: "application/json",
    };
  }

  private buildDescription(order: { channel: string; customerPhone: string | null; shippingAddress: string | null; notes: string | null }): string {
    const lines = [`ShopFlow channel: ${order.channel}`];
    if (order.customerPhone) lines.push(`Phone: ${order.customerPhone}`);
    if (order.shippingAddress) lines.push(`Address: ${order.shippingAddress}`);
    if (order.notes) lines.push(`Note: ${order.notes}`);
    return lines.join("\n");
  }
}
