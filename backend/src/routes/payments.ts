// Payments routes — admin panel uchun to'lov usullari va tranzaksiyalarni
// boshqarish + provayder'lar (Click/Payme/Uzum/...) uchun webhook qabuli.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logAudit } from "../lib/audit.js";

// Provayder konfiguratsiya — frontend'da yashirin maydonlar (apiKey, secretKey)
// faqat "configured: true/false" sifatida ko'rinadi.
const SECRET_KEYS = new Set(["apiKey", "secretKey", "password", "privateKey", "merchantSecret"]);

function redactConfig(config: unknown): { configured: boolean; preview: Record<string, unknown> } {
  if (!config || typeof config !== "object") return { configured: false, preview: {} };
  const c = config as Record<string, unknown>;
  const preview: Record<string, unknown> = {};
  let hasSecret = false;
  for (const [k, v] of Object.entries(c)) {
    if (SECRET_KEYS.has(k)) {
      if (v && String(v).length > 0) hasSecret = true;
      preview[k] = v ? "•••••" : "";
    } else {
      preview[k] = v;
    }
  }
  return { configured: hasSecret, preview };
}

const upsertMethodSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(1).max(80),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "ERROR"]).optional(),
  type: z.enum(["instant", "installment", "cash"]).optional(),
  config: z.record(z.unknown()).optional(),
  minAmount: z.number().nonnegative().nullable().optional(),
  maxAmount: z.number().nonnegative().nullable().optional(),
  commissionPercent: z.number().nonnegative().max(100).nullable().optional(),
  testMode: z.boolean().optional(),
  autoConfirm: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
});

const patchMethodSchema = upsertMethodSchema.partial();

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  // Admin endpointlari — auth talab
  app.register(async (admin) => {
    admin.addHook("preHandler", admin.authenticate);

    // Barcha tenant to'lov usullari ro'yxati
    admin.get("/methods", async (req) => {
      const items = await admin.prisma.paymentMethod.findMany({
        where: { tenantId: req.session.tenantId },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { _count: { select: { transactions: true } } },
      });
      return {
        items: items.map((m) => {
          const cfg = redactConfig(m.config);
          return {
            id: m.id,
            code: m.code,
            name: m.name,
            status: m.status,
            type: m.type,
            configured: cfg.configured,
            configPreview: cfg.preview,
            minAmount: m.minAmount ? Number(m.minAmount) : null,
            maxAmount: m.maxAmount ? Number(m.maxAmount) : null,
            commissionPercent: m.commissionPercent ? Number(m.commissionPercent) : null,
            testMode: m.testMode,
            autoConfirm: m.autoConfirm,
            position: m.position,
            transactionsCount: m._count.transactions,
            createdAt: m.createdAt.toISOString(),
            updatedAt: m.updatedAt.toISOString(),
          };
        }),
      };
    });

    // Yangi method qo'shish (yoki code bo'yicha upsert)
    admin.post(
      "/methods",
      { preHandler: [admin.requireRole("OWNER", "ADMIN")] },
      async (req, reply) => {
        const data = upsertMethodSchema.parse(req.body);
        const existing = await admin.prisma.paymentMethod.findUnique({
          where: { tenantId_code: { tenantId: req.session.tenantId, code: data.code } },
        });
        if (existing) {
          return reply.code(409).send({ error: "Bu to'lov usuli allaqachon qo'shilgan" });
        }
        const created = await admin.prisma.paymentMethod.create({
          data: {
            tenantId: req.session.tenantId,
            code: data.code,
            name: data.name,
            status: data.status ?? "INACTIVE",
            type: data.type ?? "instant",
            config: (data.config ?? {}) as never,
            minAmount: data.minAmount ?? null,
            maxAmount: data.maxAmount ?? null,
            commissionPercent: data.commissionPercent ?? null,
            testMode: data.testMode ?? true,
            autoConfirm: data.autoConfirm ?? false,
            position: data.position ?? 0,
          },
        });
        const actor = await admin.prisma.user.findUnique({
          where: { id: req.session.userId },
          select: { name: true },
        });
        await logAudit({
          prisma: admin.prisma,
          tenantId: req.session.tenantId,
          actorId: req.session.userId,
          actorName: actor?.name ?? null,
          action: "CREATE",
          resourceType: "payment_method",
          resourceId: created.id,
          summary: `To'lov usuli qo'shildi: ${created.name}`,
        });
        return reply.code(201).send({ id: created.id });
      },
    );

    // To'lov usulini yangilash (status, config, limit, h.k.)
    admin.patch(
      "/methods/:id",
      { preHandler: [admin.requireRole("OWNER", "ADMIN")] },
      async (req, reply) => {
        const { id } = z.object({ id: z.string() }).parse(req.params);
        const data = patchMethodSchema.parse(req.body);
        const method = await admin.prisma.paymentMethod.findFirst({
          where: { id, tenantId: req.session.tenantId },
        });
        if (!method) return reply.code(404).send({ error: "Not found" });

        // config — mavjud bilan birlashadi (qisman yangilash)
        let mergedConfig = method.config as Record<string, unknown>;
        if (data.config) {
          mergedConfig = { ...mergedConfig, ...data.config };
        }

        const updated = await admin.prisma.paymentMethod.update({
          where: { id },
          data: {
            ...(data.code !== undefined && { code: data.code }),
            ...(data.name !== undefined && { name: data.name }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.type !== undefined && { type: data.type }),
            ...(data.config !== undefined && { config: mergedConfig as never }),
            ...(data.minAmount !== undefined && { minAmount: data.minAmount }),
            ...(data.maxAmount !== undefined && { maxAmount: data.maxAmount }),
            ...(data.commissionPercent !== undefined && { commissionPercent: data.commissionPercent }),
            ...(data.testMode !== undefined && { testMode: data.testMode }),
            ...(data.autoConfirm !== undefined && { autoConfirm: data.autoConfirm }),
            ...(data.position !== undefined && { position: data.position }),
          },
        });
        const actor = await admin.prisma.user.findUnique({
          where: { id: req.session.userId },
          select: { name: true },
        });
        const changedKeys = (Object.keys(data) as Array<keyof typeof data>).filter((k) => data[k] !== undefined);
        await logAudit({
          prisma: admin.prisma,
          tenantId: req.session.tenantId,
          actorId: req.session.userId,
          actorName: actor?.name ?? null,
          action: "UPDATE",
          resourceType: "payment_method",
          resourceId: id,
          summary: `${updated.name} — yangilandi: ${changedKeys.join(", ")}`,
        });
        return { id: updated.id };
      },
    );

    admin.delete(
      "/methods/:id",
      { preHandler: [admin.requireRole("OWNER", "ADMIN")] },
      async (req, reply) => {
        const { id } = z.object({ id: z.string() }).parse(req.params);
        const method = await admin.prisma.paymentMethod.findFirst({
          where: { id, tenantId: req.session.tenantId },
        });
        if (!method) return reply.code(404).send({ error: "Not found" });
        await admin.prisma.paymentMethod.delete({ where: { id } });
        const actor = await admin.prisma.user.findUnique({
          where: { id: req.session.userId },
          select: { name: true },
        });
        await logAudit({
          prisma: admin.prisma,
          tenantId: req.session.tenantId,
          actorId: req.session.userId,
          actorName: actor?.name ?? null,
          action: "DELETE",
          resourceType: "payment_method",
          resourceId: id,
          summary: `To'lov usuli o'chirildi: ${method.name}`,
        });
        return { ok: true };
      },
    );

    // Tranzaksiyalar ro'yxati — filterlar bilan
    const txQuerySchema = z.object({
      status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED", "CANCELLED"]).optional(),
      methodId: z.string().optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(200).default(50),
    });
    admin.get("/transactions", async (req) => {
      const q = txQuerySchema.parse(req.query);
      const where = {
        tenantId: req.session.tenantId,
        ...(q.status && { status: q.status }),
        ...(q.methodId && { methodId: q.methodId }),
      };
      const [total, items] = await Promise.all([
        admin.prisma.paymentTransaction.count({ where }),
        admin.prisma.paymentTransaction.findMany({
          where,
          include: { method: { select: { id: true, code: true, name: true } } },
          orderBy: { createdAt: "desc" },
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
        }),
      ]);
      return {
        total,
        page: q.page,
        pageSize: q.pageSize,
        items: items.map((t) => ({
          id: t.id,
          methodId: t.methodId,
          method: t.method,
          orderId: t.orderId,
          externalId: t.externalId,
          amount: Number(t.amount),
          currency: t.currency,
          status: t.status,
          commission: t.commission ? Number(t.commission) : null,
          errorMessage: t.errorMessage,
          createdAt: t.createdAt.toISOString(),
          completedAt: t.completedAt?.toISOString() ?? null,
        })),
      };
    });

    // Statistika — usul bo'yicha umumiy ko'rsatkichlar (oxirgi 30 kun)
    admin.get("/stats", async (req) => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const grouped = await admin.prisma.paymentTransaction.groupBy({
        by: ["methodId", "status"],
        where: { tenantId: req.session.tenantId, createdAt: { gte: cutoff } },
        _sum: { amount: true },
        _count: { _all: true },
      });
      return { stats: grouped.map((g) => ({
        methodId: g.methodId,
        status: g.status,
        count: g._count._all,
        amount: g._sum.amount ? Number(g._sum.amount) : 0,
      })) };
    });
  });

  // Webhook qabuli — auth talab qilinmaydi (provayder o'zining imzosini yuboradi)
  // Hozircha skeleton — provayder'ning real verify mantig'i keyingi PR'larda
  app.post<{ Params: { methodCode: string }; Body: unknown }>(
    "/webhook/:methodCode",
    async (req, reply) => {
      const { methodCode } = z.object({ methodCode: z.string() }).parse(req.params);
      const tenantId = (req.headers["x-shopflow-tenant"] as string | undefined) ?? "";

      // Hech bo'lmaganda webhook event yozib qo'yamiz — keyin debug uchun
      const method = await app.prisma.paymentMethod.findFirst({
        where: { code: methodCode, ...(tenantId && { tenantId }) },
        select: { id: true, tenantId: true, autoConfirm: true },
      });
      if (!method) {
        return reply.code(404).send({ error: "Payment method not found" });
      }

      // TODO: provayder'ga xos signature verification
      // - Click: x-click-sign header / merchant_prepare_id
      // - Payme: x-auth basic + JSON-RPC
      // - Uzum: HMAC sign

      app.log.info({ methodCode, body: req.body }, "[payments] webhook received");

      return reply.code(200).send({ ok: true });
    },
  );
};
