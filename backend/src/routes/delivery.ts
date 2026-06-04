// Yetkazib berish — zonalar, usullar va buyurtma yetkazish
// Admin: CRUD + kuryer tayinlash
// Storefront: mavjud usullarni ko'rish

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logAudit } from "../lib/audit.js";

const zoneSchema = z.object({
  name: z.string().min(1).max(80),
  regions: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  position: z.number().int().nonnegative().default(0),
});

const methodSchema = z.object({
  zoneId: z.string().optional().nullable(),
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional().nullable(),
  type: z.enum(["FREE", "FLAT_RATE", "BY_WEIGHT", "BY_DISTANCE"]).default("FLAT_RATE"),
  price: z.number().nonnegative().default(0),
  freeAbove: z.number().nonnegative().optional().nullable(),
  minDays: z.number().int().positive().default(1),
  maxDays: z.number().int().positive().default(3),
  active: z.boolean().default(true),
  position: z.number().int().nonnegative().default(0),
});

const deliveryOrderSchema = z.object({
  methodId: z.string().optional().nullable(),
  courierName: z.string().max(80).optional().nullable(),
  courierPhone: z.string().max(40).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  trackingCode: z.string().max(100).optional().nullable(),
  price: z.number().nonnegative().default(0),
});

export const deliveryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // ─── Zonalar ────────────────────────────────────────────────────────────────
  app.get("/zones", async (req) => {
    return app.prisma.deliveryZone.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: {
        methods: {
          where: { active: true },
          orderBy: { position: "asc" },
          select: { id: true, name: true, price: true, type: true, minDays: true, maxDays: true },
        },
      },
    });
  });

  app.post("/zones", async (req, reply) => {
    const data = zoneSchema.parse(req.body);
    const zone = await app.prisma.deliveryZone.create({
      data: { tenantId: req.session.tenantId, ...data },
    });
    return reply.code(201).send(zone);
  });

  app.patch<{ Params: { id: string } }>("/zones/:id", async (req, reply) => {
    const data = zoneSchema.partial().parse(req.body);
    const existing = await app.prisma.deliveryZone.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Zona topilmadi" });
    const affected = await app.prisma.deliveryZone.updateMany({
      where: { id: req.params.id, tenantId: req.session.tenantId },
      data,
    });
    if (affected.count === 0) return reply.code(404).send({ error: "Zona topilmadi" });
    return app.prisma.deliveryZone.findFirstOrThrow({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
  });

  app.delete<{ Params: { id: string } }>("/zones/:id", {
    preHandler: [app.requireRole("OWNER", "ADMIN")],
  }, async (req, reply) => {
    const existing = await app.prisma.deliveryZone.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Zona topilmadi" });
    await app.prisma.deliveryZone.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  // ─── Usullar ────────────────────────────────────────────────────────────────
  app.get("/methods", async (req) => {
    const methods = await app.prisma.deliveryMethod.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: {
        zone: { select: { id: true, name: true } },
        _count: { select: { deliveryOrders: true } },
      },
    });
    return methods.map((m) => ({
      ...m,
      price: Number(m.price),
      freeAbove: m.freeAbove ? Number(m.freeAbove) : null,
      usageCount: m._count.deliveryOrders,
      _count: undefined,
    }));
  });

  app.post("/methods", async (req, reply) => {
    const data = methodSchema.parse(req.body);
    if (data.zoneId) {
      const zone = await app.prisma.deliveryZone.findFirst({
        where: { id: data.zoneId, tenantId: req.session.tenantId },
      });
      if (!zone) return reply.code(400).send({ error: "Zona topilmadi" });
    }
    const method = await app.prisma.deliveryMethod.create({
      data: { tenantId: req.session.tenantId, ...data },
    });
    return reply.code(201).send({ ...method, price: Number(method.price) });
  });

  app.patch<{ Params: { id: string } }>("/methods/:id", async (req, reply) => {
    const data = methodSchema.partial().parse(req.body);
    const existing = await app.prisma.deliveryMethod.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Usul topilmadi" });
    const updated = await app.prisma.deliveryMethod.update({
      where: { id: req.params.id }, data,
    });
    return { ...updated, price: Number(updated.price) };
  });

  app.delete<{ Params: { id: string } }>("/methods/:id", {
    preHandler: [app.requireRole("OWNER", "ADMIN")],
  }, async (req, reply) => {
    const existing = await app.prisma.deliveryMethod.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Usul topilmadi" });
    await app.prisma.deliveryMethod.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  // ─── Yetkazib berish buyurtmalari ─────────────────────────────────────────
  app.get("/orders", async (req) => {
    const q = z.object({
      status: z.enum(["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED", "RETURNED"]).optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
    }).parse(req.query);

    const where = {
      tenantId: req.session.tenantId,
      ...(q.status ? { status: q.status } : {}),
    };

    const [orders, total] = await Promise.all([
      app.prisma.deliveryOrder.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              code: true, total: true, currency: true, status: true,
              customer: { select: { id: true, name: true, phone: true } },
              shippingAddress: true,
            },
          },
          method: { select: { id: true, name: true, type: true } },
        },
      }),
      app.prisma.deliveryOrder.count({ where }),
    ]);

    return {
      items: orders.map((d) => ({ ...d, price: Number(d.price) })),
      total,
      page: q.page,
      pageSize: q.pageSize,
      pages: Math.ceil(total / q.pageSize),
    };
  });

  // Buyurtmaga yetkazib berish yaratish / tayinlash
  app.post<{ Params: { orderId: string } }>("/orders/:orderId", async (req, reply) => {
    const data = deliveryOrderSchema.parse(req.body);
    const tenantId = req.session.tenantId;

    const order = await app.prisma.order.findFirst({
      where: { id: req.params.orderId, tenantId },
    });
    if (!order) return reply.code(404).send({ error: "Buyurtma topilmadi" });

    const existing = await app.prisma.deliveryOrder.findUnique({
      where: { orderId: req.params.orderId },
    });
    if (existing) return reply.code(409).send({ error: "Bu buyurtmaga yetkazib berish allaqachon yaratilgan" });

    const delivery = await app.prisma.deliveryOrder.create({
      data: {
        tenantId,
        orderId: req.params.orderId,
        methodId: data.methodId ?? null,
        courierName: data.courierName ?? null,
        courierPhone: data.courierPhone ?? null,
        notes: data.notes ?? null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        trackingCode: data.trackingCode ?? null,
        price: data.price,
        currency: order.currency,
      },
    });
    return reply.code(201).send({ ...delivery, price: Number(delivery.price) });
  });

  // Yetkazib berish holatini yangilash
  app.patch<{ Params: { id: string } }>("/orders/:id/status", async (req, reply) => {
    const { status, notes } = z.object({
      status: z.enum(["PENDING", "ASSIGNED", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "FAILED", "RETURNED"]),
      notes: z.string().max(500).optional(),
    }).parse(req.body);

    const delivery = await app.prisma.deliveryOrder.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    if (!delivery) return reply.code(404).send({ error: "Topilmadi" });

    const now = new Date();
    const updated = await app.prisma.deliveryOrder.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(notes && { notes }),
        ...(status === "PICKED_UP" && { pickedUpAt: now }),
        ...(status === "DELIVERED" && { deliveredAt: now }),
        ...(status === "FAILED" && { failedAt: now }),
      },
    });

    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      action: `delivery_${status.toLowerCase()}`,
      resourceType: "DeliveryOrder",
      resourceId: delivery.id,
      summary: `Yetkazib berish holati: ${status}`,
    });

    return { ...updated, price: Number(updated.price) };
  });

  // Stats
  app.get("/stats", async (req) => {
    const tenantId = req.session.tenantId;
    const [byStatus, total] = await Promise.all([
      app.prisma.deliveryOrder.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: true,
      }),
      app.prisma.deliveryOrder.count({ where: { tenantId } }),
    ]);
    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    };
  });
};
