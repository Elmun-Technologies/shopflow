import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  location: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

const listQuery = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const q = listQuery.parse(req.query);
    const where = {
      tenantId: req.session.tenantId,
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: "insensitive" as const } },
          { email: { contains: q.search, mode: "insensitive" as const } },
          { phone: { contains: q.search } },
        ],
      }),
    };
    const [total, items] = await Promise.all([
      app.prisma.customer.count({ where }),
      app.prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, items };
  });

  /** GET /:id — mijoz to'liq ma'lumot + buyurtma tarixi + statistika */
  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const tenantId = req.session.tenantId;
    const customer = await app.prisma.customer.findFirst({
      where: { id, tenantId },
    });
    if (!customer) return reply.code(404).send({ error: "Mijoz topilmadi" });

    const [orderAgg, orders] = await Promise.all([
      app.prisma.order.aggregate({
        where: { tenantId, customerId: id, status: { in: ["COMPLETED", "PROCESSING", "PENDING"] } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      app.prisma.order.findMany({
        where: { tenantId, customerId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          items: { include: { product: { select: { name: true } } } },
        },
      }),
    ]);

    return {
      customer: {
        ...customer,
        telegramUserId: customer.telegramUserId?.toString() ?? null,
      },
      stats: {
        totalSpent: Number(orderAgg._sum.total ?? 0),
        orderCount: orderAgg._count._all,
      },
      orders: orders.map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        total: Number(o.total),
        currency: o.currency,
        createdAt: o.createdAt,
        itemCount: o.items.reduce((s, i) => s + i.qty, 0),
      })),
    };
  });

  app.post("/", async (req) => {
    const data = customerSchema.parse(req.body);
    return app.prisma.customer.create({
      data: { ...data, email: data.email || null, tenantId: req.session.tenantId },
    });
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = customerSchema.partial().parse(req.body);
    const c = await app.prisma.customer.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!c) return reply.code(404).send({ error: "Not found" });
    return app.prisma.customer.update({
      where: { id },
      data: { ...data, email: data.email || undefined },
    });
  });

  app.delete("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const c = await app.prisma.customer.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!c) return reply.code(404).send({ error: "Not found" });
    await app.prisma.customer.delete({ where: { id } });
    return { ok: true };
  });

  /**
   * RFM analysis — Recency, Frequency, Monetary.
   * Har bir mijozni segmentga ajratadi: champion / loyal / new / atRisk / lost / hibernating.
   * Marketing rassilka uchun: "Xavf ostidagilarga -20% taklif" kabi.
   */
  app.get("/rfm", async (req) => {
    const tenantId = req.session.tenantId;
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // Bitta query — barcha mijoz + buyurtma agregati
    const data = await app.prisma.customer.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        orders: {
          where: { status: { in: ["COMPLETED", "PROCESSING", "PENDING"] } },
          select: { total: true, createdAt: true },
        },
      },
    });

    type Segment = "champion" | "loyal" | "new" | "atRisk" | "lost" | "hibernating" | "nobody";

    const classify = (orderCount: number, totalSpent: number, daysSinceLast: number | null, daysSinceJoin: number): Segment => {
      if (orderCount === 0) return "nobody";
      // Champions — recent + frequent
      if (daysSinceLast !== null && daysSinceLast <= 30 && orderCount >= 5) return "champion";
      // Loyal — recent + 3+ orders
      if (daysSinceLast !== null && daysSinceLast <= 90 && orderCount >= 3) return "loyal";
      // New — birinchi buyurtma so'nggi 30 kunda
      if (daysSinceLast !== null && daysSinceLast <= 30 && orderCount <= 2 && daysSinceJoin <= 30) return "new";
      // Lost — 180+ kun yo'q
      if (daysSinceLast !== null && daysSinceLast > 180) return "lost";
      // Hibernating — 1 ta buyurtma, 90+ kun yo'q
      if (orderCount === 1 && daysSinceLast !== null && daysSinceLast > 90) return "hibernating";
      // At risk — 60-180 kun ichida ko'rinmagan, lekin 2+ buyurtma
      if (daysSinceLast !== null && daysSinceLast > 60 && orderCount >= 2) return "atRisk";
      return "loyal";
    };

    const customers = data.map((c) => {
      const orderCount = c.orders.length;
      const totalSpent = c.orders.reduce((s, o) => s + Number(o.total), 0);
      const lastOrderTs = c.orders.length > 0
        ? Math.max(...c.orders.map((o) => o.createdAt.getTime()))
        : null;
      const daysSinceLast = lastOrderTs !== null ? Math.floor((now - lastOrderTs) / DAY) : null;
      const daysSinceJoin = Math.floor((now - c.createdAt.getTime()) / DAY);
      const segment = classify(orderCount, totalSpent, daysSinceLast, daysSinceJoin);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        orderCount,
        totalSpent,
        daysSinceLast,
        segment,
      };
    });

    // Statistika — segment hisoblari
    const counts: Record<Segment, number> = {
      champion: 0, loyal: 0, new: 0, atRisk: 0, lost: 0, hibernating: 0, nobody: 0,
    };
    for (const c of customers) counts[c.segment]++;

    return { customers, counts, total: customers.length };
  });
};
