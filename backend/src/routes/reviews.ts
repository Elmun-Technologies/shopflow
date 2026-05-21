// Admin tomondan mahsulot sharhlari boshqaruvi:
//  - GET /reviews        — barcha (filter status, productId)
//  - PATCH /reviews/:id  — moderatsiya (approve/reject)
//  - DELETE /reviews/:id — to'liq o'chirish (kerak bo'lganda)
//
// Mijoz tomondan sharh yuborish + sharhlar ro'yxati endpoint'lari
// storefront.ts'da — auth talab qilmaydi.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logAudit } from "../lib/audit.js";

export const reviewRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  const listQuerySchema = z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    productId: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(50),
  });

  app.get("/", async (req) => {
    const q = listQuerySchema.parse(req.query);
    const where = {
      tenantId: req.session.tenantId,
      ...(q.status && { status: q.status }),
      ...(q.productId && { productId: q.productId }),
      ...(q.search && {
        OR: [
          { customerName: { contains: q.search, mode: "insensitive" as const } },
          { text: { contains: q.search, mode: "insensitive" as const } },
          { product: { name: { contains: q.search, mode: "insensitive" as const } } },
        ],
      }),
    };
    const [total, items, stats] = await Promise.all([
      app.prisma.review.count({ where }),
      app.prisma.review.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, imageUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      // Stats — barcha tenant sharhlari uchun (status filter qo'llamasdan)
      app.prisma.review.aggregate({
        where: { tenantId: req.session.tenantId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      app.prisma.review.count({ where: { tenantId: req.session.tenantId, status: "PENDING" } }),
      app.prisma.review.count({ where: { tenantId: req.session.tenantId, status: "APPROVED" } }),
      app.prisma.review.count({ where: { tenantId: req.session.tenantId, status: "REJECTED" } }),
    ]);
    return {
      total,
      page: q.page,
      stats: {
        avgRating: stats._avg.rating ?? 0,
        total: stats._count._all,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      items: items.map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.product?.name ?? "—",
        productImage: r.product?.imageUrl ?? null,
        customerId: r.customerId,
        customerName: r.customerName,
        rating: r.rating,
        text: r.text,
        photos: r.photos,
        status: r.status,
        moderatedAt: r.moderatedAt?.toISOString() ?? null,
        rejectReason: r.rejectReason,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  // Moderatsiya — status + rejectReason
  const patchSchema = z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    rejectReason: z.string().max(500).optional().nullable(),
  });
  app.patch(
    "/:id",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const data = patchSchema.parse(req.body);
      const review = await app.prisma.review.findFirst({
        where: { id, tenantId: req.session.tenantId },
      });
      if (!review) return reply.code(404).send({ error: "Not found" });

      const updated = await app.prisma.review.update({
        where: { id },
        data: {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.rejectReason !== undefined && { rejectReason: data.rejectReason || null }),
          ...(data.status && data.status !== review.status && {
            moderatedById: req.session.userId,
            moderatedAt: new Date(),
          }),
        },
      });

      const actor = await app.prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { name: true },
      });
      if (data.status && data.status !== review.status) {
        await logAudit({
          prisma: app.prisma,
          tenantId: req.session.tenantId,
          actorId: req.session.userId,
          actorName: actor?.name ?? null,
          action: "STATUS_CHANGE",
          resourceType: "review",
          resourceId: id,
          summary: `Sharh ${data.status === "APPROVED" ? "tasdiqlandi" : data.status === "REJECTED" ? "rad etildi" : "kutilmoqda"}: "${review.text.slice(0, 60)}"`,
        });
      }
      return { id: updated.id };
    },
  );

  app.delete(
    "/:id",
    { preHandler: [app.requireRole("OWNER", "ADMIN")] },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const review = await app.prisma.review.findFirst({
        where: { id, tenantId: req.session.tenantId },
      });
      if (!review) return reply.code(404).send({ error: "Not found" });
      await app.prisma.review.delete({ where: { id } });
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
        resourceType: "review",
        resourceId: id,
        summary: "Sharh o'chirildi",
      });
      return { ok: true };
    },
  );
};
