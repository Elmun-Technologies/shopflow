import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { nextOrderCode } from "../lib/codes.js";

const statusEnum = z.enum(["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"]);

const itemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const createOrderSchema = z.object({
  customerId: z.string().optional(),
  channelId: z.string().optional(),
  status: statusEnum.optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(itemSchema).min(1),
  currency: z.string().optional(),
});

const listQuerySchema = z.object({
  status: statusEnum.optional(),
  channelId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const q = listQuerySchema.parse(req.query);
    const where = {
      tenantId: req.session.tenantId,
      ...(q.status && { status: q.status }),
      ...(q.channelId && { channelId: q.channelId }),
      ...(q.search && {
        OR: [
          { code: { contains: q.search, mode: "insensitive" as const } },
          { customer: { name: { contains: q.search, mode: "insensitive" as const } } },
        ],
      }),
    };
    const [total, items] = await Promise.all([
      app.prisma.order.count({ where }),
      app.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          channel: { select: { id: true, type: true, name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, items };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const order = await app.prisma.order.findFirst({
      where: { id, tenantId: req.session.tenantId },
      include: {
        customer: true,
        channel: true,
        items: { include: { product: true } },
      },
    });
    if (!order) return reply.code(404).send({ error: "Not found" });
    return order;
  });

  app.post("/", async (req) => {
    const data = createOrderSchema.parse(req.body);
    const code = await nextOrderCode(app.prisma, req.session.tenantId);
    const total = data.items.reduce((s, i) => s + i.qty * i.price, 0);

    return app.prisma.order.create({
      data: {
        tenantId: req.session.tenantId,
        code,
        status: data.status ?? "PENDING",
        total,
        currency: data.currency ?? "UZS",
        notes: data.notes,
        customerId: data.customerId,
        channelId: data.channelId,
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            qty: i.qty,
            price: i.price,
          })),
        },
      },
      include: { items: true },
    });
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = z
      .object({
        status: statusEnum.optional(),
        notes: z.string().optional(),
        assigneeId: z.string().optional(),
      })
      .parse(req.body);
    const order = await app.prisma.order.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!order) return reply.code(404).send({ error: "Not found" });
    return app.prisma.order.update({ where: { id }, data });
  });
};
