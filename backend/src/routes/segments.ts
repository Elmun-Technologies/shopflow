// Customer segments — mijozlarni guruhlash (marketing kampaniyalar, rassilka uchun)
//
// Ikki turdagi a'zolik:
// - AUTOMATIC: conditions JSON asosida Customer'larga query qilinadi
// - MANUAL: admin qo'lda mijozlarni qo'shadi (SegmentMember)

import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { logAudit } from "../lib/audit.js";

const segmentTypeEnum = z.enum(["AUTOMATIC", "MANUAL", "SMART"]);

// Condition: { field, operator, value, value2? }
const conditionSchema = z.object({
  id: z.string().optional(),
  field: z.enum(["status", "totalSpent", "totalOrders", "platform", "region", "lastOrderDate", "registeredAt"]),
  operator: z.enum(["equals", "not_equals", "greater_than", "less_than", "between", "contains", "in_list"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  value2: z.union([z.string(), z.number()]).optional(),
});

const upsertSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  type: segmentTypeEnum.optional(),
  active: z.boolean().optional(),
  conditions: z.array(conditionSchema).optional(),
  tags: z.array(z.string().max(40)).optional(),
});

// Build a Prisma `where` clause from segment conditions for AUTOMATIC segments.
// Cheklov: hozircha bitta condition (oddiy holatlar). Murakkab AND/OR — keyingi PR.
type CondInput = z.infer<typeof conditionSchema>;
function conditionsToWhere(conditions: CondInput[], tenantId: string): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = { tenantId };
  for (const c of conditions) {
    if (c.field === "totalSpent" || c.field === "totalOrders") {
      // Aggregate query — bu yerda oddiy condition'lar uchun fallback (oxiri taxminiy).
      // Real holatda agregat orqali alohida hisoblanishi kerak — bu MVP scoping.
      continue;
    }
    if (c.field === "lastOrderDate" || c.field === "registeredAt") {
      const field = c.field === "registeredAt" ? "createdAt" : "updatedAt";
      const v = typeof c.value === "string" ? new Date(c.value) : null;
      if (v && c.operator === "greater_than") (where as Record<string, unknown>)[field] = { gte: v };
      if (v && c.operator === "less_than") (where as Record<string, unknown>)[field] = { lte: v };
      continue;
    }
    if (c.field === "region") {
      if (c.operator === "equals" && typeof c.value === "string") {
        where.location = { contains: c.value, mode: "insensitive" };
      }
      continue;
    }
    if (c.field === "platform") {
      // Mijozning birinchi orderi'dagi channel.type orqali — taxminiy
      continue;
    }
  }
  return where;
}

// Memberlar sonini hisoblash — AUTOMATIC uchun query, MANUAL uchun SegmentMember count
async function computeMemberCount(
  prisma: import("@prisma/client").PrismaClient,
  segmentId: string,
  type: "AUTOMATIC" | "MANUAL" | "SMART",
  conditions: CondInput[],
  tenantId: string,
): Promise<number> {
  if (type === "MANUAL") {
    return prisma.segmentMember.count({ where: { segmentId, tenantId } });
  }
  if (type === "AUTOMATIC" || type === "SMART") {
    if (conditions.length === 0) return 0;
    const where = conditionsToWhere(conditions, tenantId);
    return prisma.customer.count({ where });
  }
  return 0;
}

export const segmentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // Ro'yxat — yengil response (member count cache'dan)
  app.get("/", async (req) => {
    const items = await app.prisma.customerSegment.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: { createdAt: "desc" },
    });
    return {
      items: items.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        type: s.type,
        active: s.active,
        conditions: s.conditions,
        tags: s.tags,
        memberCount: s.cachedCount,
        cachedCountAt: s.cachedCountAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    };
  });

  // Bitta segment + a'zolar
  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const s = await app.prisma.customerSegment.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!s) return reply.code(404).send({ error: "Not found" });
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      type: s.type,
      active: s.active,
      conditions: s.conditions,
      tags: s.tags,
      memberCount: s.cachedCount,
      cachedCountAt: s.cachedCountAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  });

  // A'zolar ro'yxati (paginated, mijoz fielderni qaytaradi)
  const memberQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(50),
  });
  app.get("/:id/members", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const q = memberQuerySchema.parse(req.query);
    const seg = await app.prisma.customerSegment.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!seg) return reply.code(404).send({ error: "Not found" });

    if (seg.type === "MANUAL") {
      const [total, members] = await Promise.all([
        app.prisma.segmentMember.count({ where: { segmentId: id, tenantId: req.session.tenantId } }),
        app.prisma.segmentMember.findMany({
          where: { segmentId: id, tenantId: req.session.tenantId },
          include: {
            // SegmentMember has customerId, fetch via Customer separately
          },
          orderBy: { addedAt: "desc" },
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
        }),
      ]);
      const customers = await app.prisma.customer.findMany({
        where: {
          id: { in: members.map((m) => m.customerId) },
          tenantId: req.session.tenantId,
        },
        select: { id: true, name: true, phone: true, email: true, telegramUserId: true, createdAt: true },
      });
      return {
        total,
        page: q.page,
        items: customers.map((c) => ({
          ...c,
          telegramUserId: c.telegramUserId?.toString() ?? null,
        })),
      };
    }

    // AUTOMATIC / SMART
    const conditions = (seg.conditions as unknown as CondInput[]) ?? [];
    if (conditions.length === 0) return { total: 0, page: q.page, items: [] };
    const where = conditionsToWhere(conditions, req.session.tenantId);
    const [total, items] = await Promise.all([
      app.prisma.customer.count({ where }),
      app.prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true, email: true, telegramUserId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      total,
      page: q.page,
      items: items.map((c) => ({ ...c, telegramUserId: c.telegramUserId?.toString() ?? null })),
    };
  });

  // Yangi segment yaratish
  app.post("/", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req) => {
    const data = upsertSchema.parse(req.body);
    const created = await app.prisma.customerSegment.create({
      data: {
        tenantId: req.session.tenantId,
        name: data.name,
        description: data.description ?? "",
        type: data.type ?? "MANUAL",
        active: data.active ?? true,
        conditions: (data.conditions ?? []) as never,
        tags: data.tags ?? [],
      },
    });
    // Birinchi marta count hisoblaymiz
    const count = await computeMemberCount(
      app.prisma,
      created.id,
      created.type,
      (data.conditions ?? []) as CondInput[],
      req.session.tenantId,
    );
    await app.prisma.customerSegment.update({
      where: { id: created.id },
      data: { cachedCount: count, cachedCountAt: new Date() },
    });

    const actor = await app.prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { name: true },
    });
    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "CREATE",
      resourceType: "segment",
      resourceId: created.id,
      summary: `Segment yaratildi: ${created.name} (${count} a'zo)`,
    });
    return { id: created.id, memberCount: count };
  });

  app.patch("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = upsertSchema.partial().parse(req.body);
    const seg = await app.prisma.customerSegment.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!seg) return reply.code(404).send({ error: "Not found" });
    const updated = await app.prisma.customerSegment.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.conditions !== undefined && { conditions: data.conditions as never }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
    });
    // Conditions o'zgargan bo'lsa, count'ni qayta hisoblaymiz
    if (data.conditions !== undefined || data.type !== undefined) {
      const count = await computeMemberCount(
        app.prisma,
        updated.id,
        updated.type,
        (updated.conditions as unknown as CondInput[]) ?? [],
        req.session.tenantId,
      );
      await app.prisma.customerSegment.update({
        where: { id },
        data: { cachedCount: count, cachedCountAt: new Date() },
      });
    }

    const actor = await app.prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { name: true },
    });
    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "UPDATE",
      resourceType: "segment",
      resourceId: id,
      summary: `Segment yangilandi: ${updated.name}`,
    });
    return { id: updated.id };
  });

  app.delete("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const seg = await app.prisma.customerSegment.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!seg) return reply.code(404).send({ error: "Not found" });
    await app.prisma.customerSegment.delete({ where: { id } });

    const actor = await app.prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { name: true },
    });
    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "DELETE",
      resourceType: "segment",
      resourceId: id,
      summary: `Segment o'chirildi: ${seg.name}`,
    });
    return { ok: true };
  });

  // Member'larni qo'lda boshqarish (MANUAL segmentlar uchun)
  app.post(
    "/:id/members",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const data = z.object({ customerIds: z.array(z.string()).min(1).max(500) }).parse(req.body);
      const seg = await app.prisma.customerSegment.findFirst({
        where: { id, tenantId: req.session.tenantId },
        select: { id: true, type: true },
      });
      if (!seg) return reply.code(404).send({ error: "Not found" });
      if (seg.type !== "MANUAL") {
        return reply.code(400).send({ error: "Faqat MANUAL segmentlarga qo'lda qo'shish mumkin" });
      }
      // Customers tenant'ga tegishliligini tekshirish
      const owned = await app.prisma.customer.findMany({
        where: { id: { in: data.customerIds }, tenantId: req.session.tenantId },
        select: { id: true },
      });
      const ownedIds = owned.map((c) => c.id);
      if (ownedIds.length === 0) return { added: 0 };
      // skipDuplicates orqali idempotent
      const result = await app.prisma.segmentMember.createMany({
        data: ownedIds.map((cid) => ({
          segmentId: id,
          customerId: cid,
          tenantId: req.session.tenantId,
        })),
        skipDuplicates: true,
      });
      // Cache'ni yangilaymiz
      const count = await app.prisma.segmentMember.count({
        where: { segmentId: id, tenantId: req.session.tenantId },
      });
      await app.prisma.customerSegment.update({
        where: { id },
        data: { cachedCount: count, cachedCountAt: new Date() },
      });
      return { added: result.count, memberCount: count };
    },
  );

  app.delete("/:id/members/:customerId", async (req, reply) => {
    const params = z.object({ id: z.string(), customerId: z.string() }).parse(req.params);
    const seg = await app.prisma.customerSegment.findFirst({
      where: { id: params.id, tenantId: req.session.tenantId },
      select: { id: true },
    });
    if (!seg) return reply.code(404).send({ error: "Not found" });
    await app.prisma.segmentMember.deleteMany({
      where: { segmentId: params.id, customerId: params.customerId, tenantId: req.session.tenantId },
    });
    const count = await app.prisma.segmentMember.count({
      where: { segmentId: params.id, tenantId: req.session.tenantId },
    });
    await app.prisma.customerSegment.update({
      where: { id: params.id },
      data: { cachedCount: count, cachedCountAt: new Date() },
    });
    return { ok: true, memberCount: count };
  });

  // Segment'ga rassilka — Telegram orqali a'zolarga xabar yuborish
  app.post(
    "/:id/broadcast",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const data = z.object({ text: z.string().min(1).max(2000) }).parse(req.body);
      const seg = await app.prisma.customerSegment.findFirst({
        where: { id, tenantId: req.session.tenantId },
      });
      if (!seg) return reply.code(404).send({ error: "Not found" });

      // Topish: segment a'zolari + Telegram ID'lari
      let customerIds: string[] = [];
      if (seg.type === "MANUAL") {
        const members = await app.prisma.segmentMember.findMany({
          where: { segmentId: id, tenantId: req.session.tenantId },
          select: { customerId: true },
        });
        customerIds = members.map((m) => m.customerId);
      } else {
        const where = conditionsToWhere((seg.conditions as unknown as CondInput[]) ?? [], req.session.tenantId);
        const customers = await app.prisma.customer.findMany({
          where: { ...where, telegramUserId: { not: null }, notifyPromotions: true },
          select: { id: true },
          take: 1000,
        });
        customerIds = customers.map((c) => c.id);
      }
      if (customerIds.length === 0) return { sent: 0, skipped: 0 };

      // Telegram orqali tenant bot tokeni bilan yuborish — async, kutmaymiz
      // Bu yerda oddiy implementation, kelajakda queue'ga o'tkazish kerak
      const { notifyCustomer } = await import("../lib/telegram-notify.js");
      let sent = 0;
      let skipped = 0;
      for (const cid of customerIds) {
        const result = await notifyCustomer(app.prisma, req.session.tenantId, cid, data.text);
        if (result.sent) sent++;
        else skipped++;
      }

      const actor = await app.prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { name: true },
      });
      await logAudit({
        prisma: app.prisma,
        tenantId: req.session.tenantId,
        actorId: req.session.userId,
        actorName: actor?.name ?? null,
        action: "BROADCAST",
        resourceType: "segment",
        resourceId: id,
        summary: `Rassilka: "${seg.name}" — ${sent} ta yuborildi, ${skipped} ta o'tkazib yuborildi`,
      });

      return reply.send({ sent, skipped, total: customerIds.length });
    },
  );
};
