import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { TenantPrismaService } from "../../prisma/tenant-prisma.service.js";
import { QueueProducerService } from "../../queue/queue-producer.service.js";
import type { CreateOrderRequest, OrderChannel, OrderListQuery } from "@shopflow/shared-types";
import { randomInt } from "node:crypto";

@Injectable()
export class OrdersService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly queue: QueueProducerService,
  ) {}

  async list(q: OrderListQuery) {
    const page = q.page ?? 1;
    const perPage = Math.min(q.perPage ?? 50, 200);

    const where = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.paymentStatus ? { paymentStatus: q.paymentStatus as never } : {}),
      ...(q.channel ? { channel: q.channel as never } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search, mode: "insensitive" as const } },
              { customerName: { contains: q.search, mode: "insensitive" as const } },
              { customerPhone: { contains: q.search } },
            ],
          }
        : {}),
      ...(q.dateFrom || q.dateTo
        ? {
            createdAt: {
              ...(q.dateFrom ? { gte: new Date(q.dateFrom) } : {}),
              ...(q.dateTo ? { lte: new Date(q.dateTo) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.db.client.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { items: true },
      }),
      this.db.client.order.count({ where }),
    ]);

    return { data, total, page, perPage };
  }

  async findById(id: string) {
    const order = await this.db.client.order.findUnique({
      where: { id } as never,
      include: { items: true, payments: true, customer: true, warehouse: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  /**
   * Create a new order from any channel. Computes line totals from current product
   * prices (server-side, never trusting the client), then enqueues outbound sync to MoySklad.
   */
  async create(channel: OrderChannel, tenantId: string, dto: CreateOrderRequest) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException("Order must contain at least one item");
    }

    const productIds = dto.items.map((i) => i.productId);
    const products = await this.db.client.product.findMany({
      where: { id: { in: productIds } } as never,
    });

    let total = 0;
    let itemsCount = 0;
    const lineItems = dto.items.map((line) => {
      const p = products.find((x) => x.id === line.productId);
      if (!p) throw new BadRequestException(`Product ${line.productId} not found`);
      const priceKopecks = p.salePriceKopecks ?? p.priceKopecks;
      total += priceKopecks * line.quantity;
      itemsCount += line.quantity;
      return {
        productId: p.id,
        variantId: line.variantId ?? null,
        productName: p.name,
        sku: p.sku,
        quantity: line.quantity,
        priceKopecks,
        vatPercent: p.vatPercent,
      };
    });

    const number = `ORD-${Date.now().toString(36).toUpperCase()}-${randomInt(1000, 9999)}`;

    const order = await this.db.client.order.create({
      data: {
        number,
        channel: channel as never,
        customerId: dto.customerId ?? null,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone ?? null,
        customerEmail: dto.customerEmail ?? null,
        warehouseId: dto.warehouseId ?? null,
        shippingMethod: dto.shippingMethod ?? null,
        shippingAddress: dto.shippingAddress ?? null,
        notes: dto.notes ?? null,
        itemsCount,
        totalKopecks: total,
        items: { create: lineItems },
      },
      include: { items: true },
    });

    await this.queue.enqueueOrderToMoysklad({ tenantId, orderId: order.id });
    return order;
  }
}
