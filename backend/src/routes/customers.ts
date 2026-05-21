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
};
