import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { pushCustomerToSD } from "../lib/salesdoctor-push.js";
import { logAuditFor } from "../lib/audit.js";
import { enrollBotSequences } from "../lib/bot-sequence-worker.js";

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
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: items.map((c) => ({ ...c, telegramUserId: c.telegramUserId?.toString() ?? null })),
    };
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
    const created = await app.prisma.customer.create({
      data: { ...data, email: data.email || null, tenantId: req.session.tenantId },
    });
    await logAuditFor(app.prisma, req.session, {
      action: "CREATE", resourceType: "customer", resourceId: created.id,
      summary: `Mijoz yaratildi: ${created.name}`,
    });
    pushCustomerToSD(app.prisma, req.session.tenantId, created.id)
      .catch((err) => app.log.warn({ err, customerId: created.id }, "SD push failed"));
    enrollBotSequences(app.prisma, req.session.tenantId, created.id, "NEW_CUSTOMER")
      .catch((err) => app.log.warn({ err, customerId: created.id }, "NEW_CUSTOMER enroll failed"));
    return created;
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = customerSchema.partial().parse(req.body);
    const c = await app.prisma.customer.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!c) return reply.code(404).send({ error: "Not found" });
    // Defense-in-depth: update where ham tenantId bilan filter
    const affected = await app.prisma.customer.updateMany({
      where: { id, tenantId: req.session.tenantId },
      data: { ...data, email: data.email || undefined },
    });
    if (affected.count === 0) return reply.code(404).send({ error: "Not found" });
    const updated = await app.prisma.customer.findFirstOrThrow({
      where: { id, tenantId: req.session.tenantId },
    });
    await logAuditFor(app.prisma, req.session, {
      action: "UPDATE", resourceType: "customer", resourceId: id,
      summary: `Mijoz tahrirlandi: ${updated.name}`,
    });
    pushCustomerToSD(app.prisma, req.session.tenantId, id)
      .catch((err) => app.log.warn({ err, customerId: id }, "SD push failed"));
    return updated;
  });

  app.delete("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const c = await app.prisma.customer.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!c) return reply.code(404).send({ error: "Not found" });
    await app.prisma.customer.deleteMany({ where: { id, tenantId: req.session.tenantId } });
    await logAuditFor(app.prisma, req.session, {
      action: "DELETE", resourceType: "customer", resourceId: id,
      summary: `Mijoz o'chirildi: ${c.name}`,
    });
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

    // Avval har bir mijoz + uning BARCHA buyurtmalari graph'i xotiraga yuklanardi.
    // Endi SQL'da har mijoz uchun ixcham agregat (count/sum/max) — LEFT JOIN bilan
    // buyurtmasiz mijozlar ham qoladi. Bucketing (classify) JS'da bajariladi.
    const data = await app.prisma.$queryRaw<
      {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
        createdAt: Date;
        orderCount: bigint;
        totalSpent: Prisma.Decimal | null;
        lastOrderAt: Date | null;
      }[]
    >`
      SELECT c."id", c."name", c."phone", c."email", c."createdAt",
             COUNT(o."id") AS "orderCount",
             SUM(o."total") AS "totalSpent",
             MAX(o."createdAt") AS "lastOrderAt"
      FROM "Customer" c
      LEFT JOIN "Order" o
        ON o."customerId" = c."id"
       AND o."tenantId" = ${tenantId}
       AND o."status" IN ('COMPLETED'::"OrderStatus", 'PROCESSING'::"OrderStatus", 'PENDING'::"OrderStatus")
      WHERE c."tenantId" = ${tenantId}
      GROUP BY c."id", c."name", c."phone", c."email", c."createdAt"
    `;

    type Segment = "champion" | "loyal" | "new" | "atRisk" | "lost" | "hibernating" | "nobody";

    const classify = (orderCount: number, daysSinceLast: number | null, daysSinceJoin: number): Segment => {
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
      const orderCount = Number(c.orderCount);
      const totalSpent = Number(c.totalSpent ?? 0);
      const lastOrderTs = c.lastOrderAt ? c.lastOrderAt.getTime() : null;
      const daysSinceLast = lastOrderTs !== null ? Math.floor((now - lastOrderTs) / DAY) : null;
      const daysSinceJoin = Math.floor((now - c.createdAt.getTime()) / DAY);
      const segment = classify(orderCount, daysSinceLast, daysSinceJoin);
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
