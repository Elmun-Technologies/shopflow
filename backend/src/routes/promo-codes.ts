// Promo kodlar — admin CRUD + storefront tekshiruvi
// Admin: GET/POST/PATCH/DELETE /api/promo-codes
// Storefront: POST /api/storefront/:slug/promo/validate

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const promoSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/, "Faqat katta harflar, raqamlar, _ va -"),
  description: z.string().max(200).optional(),
  discountType: z.enum(["PERCENT", "FIXED"]).default("PERCENT"),
  discountValue: z.number().positive().max(100),
  maxDiscount: z.number().positive().optional().nullable(),
  minOrderAmount: z.number().nonnegative().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  perUserLimit: z.number().int().positive().default(1),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  active: z.boolean().default(true),
});

export const promoCodeRoutes: FastifyPluginAsync = async (app) => {
  // ─── Admin CRUD ──────────────────────────────────────────────────────────────
  app.register(async (admin) => {
    admin.addHook("preHandler", admin.authenticate);

    // Barcha promo kodlar
    admin.get("/", async (req) => {
      const tenantId = req.session.tenantId;
      const codes = await app.prisma.promoCode.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { usages: true } } },
      });
      return codes.map((c) => ({
        ...c,
        discountValue: Number(c.discountValue),
        maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
        minOrderAmount: c.minOrderAmount ? Number(c.minOrderAmount) : null,
        usageCount: c._count.usages,
        _count: undefined,
      }));
    });

    // Bitta promo kod detali
    admin.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
      const code = await app.prisma.promoCode.findFirst({
        where: { id: req.params.id, tenantId: req.session.tenantId },
        include: {
          _count: { select: { usages: true } },
          usages: {
            take: 20,
            orderBy: { usedAt: "desc" },
            include: {
              customer: { select: { id: true, name: true, phone: true } },
              order: { select: { id: true, code: true, total: true } },
            },
          },
        },
      });
      if (!code) return reply.code(404).send({ error: "Topilmadi" });
      return { ...code, discountValue: Number(code.discountValue) };
    });

    // Yangi promo kod
    admin.post("/", async (req, reply) => {
      const data = promoSchema.parse(req.body);
      const tenantId = req.session.tenantId;

      const existing = await app.prisma.promoCode.findUnique({
        where: { tenantId_code: { tenantId, code: data.code } },
      });
      if (existing) return reply.code(409).send({ error: "Bu kod allaqachon mavjud" });

      const created = await app.prisma.promoCode.create({
        data: {
          tenantId,
          code: data.code,
          description: data.description,
          discountType: data.discountType,
          discountValue: data.discountValue,
          maxDiscount: data.maxDiscount ?? null,
          minOrderAmount: data.minOrderAmount ?? null,
          usageLimit: data.usageLimit ?? null,
          perUserLimit: data.perUserLimit,
          startsAt: data.startsAt ? new Date(data.startsAt) : null,
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
          active: data.active,
        },
      });
      return reply.code(201).send({ ...created, discountValue: Number(created.discountValue) });
    });

    // Promo kodni yangilash
    admin.patch<{ Params: { id: string } }>("/:id", async (req, reply) => {
      const data = promoSchema.partial().parse(req.body);
      const existing = await app.prisma.promoCode.findFirst({
        where: { id: req.params.id, tenantId: req.session.tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "Topilmadi" });

      const updated = await app.prisma.promoCode.update({
        where: { id: req.params.id },
        data: {
          ...(data.description !== undefined && { description: data.description }),
          ...(data.discountType !== undefined && { discountType: data.discountType }),
          ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
          ...(data.maxDiscount !== undefined && { maxDiscount: data.maxDiscount }),
          ...(data.minOrderAmount !== undefined && { minOrderAmount: data.minOrderAmount }),
          ...(data.usageLimit !== undefined && { usageLimit: data.usageLimit }),
          ...(data.perUserLimit !== undefined && { perUserLimit: data.perUserLimit }),
          ...(data.startsAt !== undefined && { startsAt: data.startsAt ? new Date(data.startsAt) : null }),
          ...(data.endsAt !== undefined && { endsAt: data.endsAt ? new Date(data.endsAt) : null }),
          ...(data.active !== undefined && { active: data.active }),
        },
      });
      return { ...updated, discountValue: Number(updated.discountValue) };
    });

    // Promo kodni o'chirish
    admin.delete<{ Params: { id: string } }>("/:id", { preHandler: [admin.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
      const existing = await app.prisma.promoCode.findFirst({
        where: { id: req.params.id, tenantId: req.session.tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "Topilmadi" });
      await app.prisma.promoCode.delete({ where: { id: req.params.id } });
      return { ok: true };
    });

    // Statistika
    admin.get<{ Params: { id: string } }>("/:id/stats", async (req, reply) => {
      const code = await app.prisma.promoCode.findFirst({
        where: { id: req.params.id, tenantId: req.session.tenantId },
      });
      if (!code) return reply.code(404).send({ error: "Topilmadi" });

      const [usageCount, totalDiscount] = await Promise.all([
        app.prisma.promoUsage.count({ where: { promoCodeId: code.id } }),
        app.prisma.order.aggregate({
          where: { tenantId: req.session.tenantId, promoCodeId: code.id },
          _sum: { promoDiscount: true },
        }),
      ]);

      return {
        usageCount,
        totalDiscount: Number(totalDiscount._sum.promoDiscount ?? 0),
        remainingUsages: code.usageLimit ? code.usageLimit - code.usageCount : null,
      };
    });
  });
};

