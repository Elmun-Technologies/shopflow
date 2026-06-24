// Sodiqlik dasturi — ball tizimi
// Admin: qoidalar, hisobot, qo'lda sozlash
// Storefront: balansni ko'rish, sarflash

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logAuditFor } from "../lib/audit.js";

// Xariddan ball hisoblash
export async function calculateEarnedPoints(
  prisma: Parameters<FastifyPluginAsync>[0]["prisma"],
  tenantId: string,
  orderTotal: number,
): Promise<number> {
  const rule = await prisma.loyaltyRule.findFirst({
    where: { tenantId, type: "purchase", active: true },
    orderBy: { createdAt: "desc" },
  });
  if (!rule || !rule.earnPerAmount || !rule.earnPerThreshold) return 0;
  return Math.floor((orderTotal / rule.earnPerThreshold) * rule.earnPerAmount);
}

// Buyurtma yaratilganda ball berish (storefront checkout'dan chaqiriladi)
export async function grantOrderPoints(
  prisma: Parameters<FastifyPluginAsync>[0]["prisma"],
  tenantId: string,
  customerId: string,
  orderId: string,
  orderTotal: number,
): Promise<number> {
  const points = await calculateEarnedPoints(prisma, tenantId, orderTotal);
  if (points <= 0) return 0;

  const account = await prisma.loyaltyAccount.upsert({
    where: { customerId },
    create: {
      tenantId,
      customerId,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
    },
    update: {},
  });

  const newBalance = account.balance + points;

  await Promise.all([
    prisma.loyaltyAccount.update({
      where: { id: account.id },
      data: { balance: { increment: points }, totalEarned: { increment: points } },
    }),
    prisma.loyaltyTransaction.create({
      data: {
        tenantId,
        accountId: account.id,
        type: "EARN",
        amount: points,
        balance: newBalance,
        description: `Xariddan ball: ${orderTotal.toLocaleString("uz-UZ")} so'm`,
        orderId,
      },
    }),
  ]);

  return points;
}

export const loyaltyRoutes: FastifyPluginAsync = async (app) => {
  // ─── Admin endpointlar ────────────────────────────────────────────────────
  app.register(async (admin) => {
    admin.addHook("preHandler", admin.authenticate);

    // Qoidalar
    admin.get("/rules", async (req) => {
      return app.prisma.loyaltyRule.findMany({
        where: { tenantId: req.session.tenantId },
        orderBy: { createdAt: "desc" },
      });
    });

    admin.post("/rules", { preHandler: [admin.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
      const data = z.object({
        name: z.string().min(1).max(80),
        description: z.string().max(300).optional(),
        type: z.enum(["purchase", "birthday", "referral", "first_order"]),
        earnPerAmount: z.number().int().nonnegative().optional(),
        earnPerThreshold: z.number().int().positive().default(1000),
        redeemRate: z.number().int().positive().optional(),
        active: z.boolean().default(true),
      }).parse(req.body);

      const rule = await app.prisma.loyaltyRule.create({
        data: { tenantId: req.session.tenantId, ...data },
      });
      await logAuditFor(app.prisma, req.session, {
        action: "CREATE", resourceType: "loyalty_rule", resourceId: rule.id,
        summary: `Sodiqlik qoidasi yaratildi: ${rule.name}`,
      });
      return reply.code(201).send(rule);
    });

    admin.patch<{ Params: { id: string } }>("/rules/:id", { preHandler: [admin.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
      const data = z.object({
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(300).optional().nullable(),
        earnPerAmount: z.number().int().nonnegative().optional().nullable(),
        earnPerThreshold: z.number().int().positive().optional(),
        redeemRate: z.number().int().positive().optional().nullable(),
        active: z.boolean().optional(),
      }).parse(req.body);

      const existing = await app.prisma.loyaltyRule.findFirst({
        where: { id: req.params.id, tenantId: req.session.tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "Topilmadi" });

      const affected = await app.prisma.loyaltyRule.updateMany({
        where: { id: req.params.id, tenantId: req.session.tenantId },
        data,
      });
      if (affected.count === 0) return reply.code(404).send({ error: "Topilmadi" });
      await logAuditFor(app.prisma, req.session, {
        action: "UPDATE", resourceType: "loyalty_rule", resourceId: req.params.id,
        summary: "Sodiqlik qoidasi tahrirlandi", changes: data,
      });
      return app.prisma.loyaltyRule.findFirstOrThrow({
        where: { id: req.params.id, tenantId: req.session.tenantId },
      });
    });

    // Tranzaksiyalar tarixi (barcha mijozlar)
    admin.get("/transactions", async (req) => {
      const q = z.object({
        page: z.coerce.number().int().positive().default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        type: z.enum(["EARN", "SPEND", "EXPIRE", "ADJUST", "BONUS"]).optional(),
        customerId: z.string().optional(),
      }).parse(req.query);

      const where = {
        tenantId: req.session.tenantId,
        ...(q.type ? { type: q.type } : {}),
        ...(q.customerId ? { account: { customerId: q.customerId } } : {}),
      };

      const [items, total] = await Promise.all([
        app.prisma.loyaltyTransaction.findMany({
          where,
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
          orderBy: { createdAt: "desc" },
          include: {
            account: {
              select: {
                customer: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        }),
        app.prisma.loyaltyTransaction.count({ where }),
      ]);

      return { items, total, page: q.page, pageSize: q.pageSize };
    });

    // Balansni qo'lda o'zgartirish — moliyaviy amal, faqat OWNER/ADMIN/MANAGER
    admin.post<{ Params: { customerId: string } }>("/adjust/:customerId", { preHandler: [admin.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
      const data = z.object({
        amount: z.number().int().min(-100000).max(100000),
        description: z.string().min(1).max(200),
      }).parse(req.body);

      const tenantId = req.session.tenantId;
      const customer = await app.prisma.customer.findFirst({
        where: { id: req.params.customerId, tenantId },
      });
      if (!customer) return reply.code(404).send({ error: "Mijoz topilmadi" });

      const account = await app.prisma.loyaltyAccount.upsert({
        where: { customerId: customer.id },
        create: { tenantId, customerId: customer.id, balance: 0, totalEarned: 0, totalSpent: 0 },
        update: {},
      });

      const newBalance = Math.max(0, account.balance + data.amount);
      const diff = newBalance - account.balance;

      if (diff === 0) return { balance: account.balance, changed: 0 };

      await Promise.all([
        app.prisma.loyaltyAccount.update({
          where: { id: account.id },
          data: {
            balance: newBalance,
            ...(diff > 0 ? { totalEarned: { increment: diff } } : { totalSpent: { increment: -diff } }),
          },
        }),
        app.prisma.loyaltyTransaction.create({
          data: {
            tenantId,
            accountId: account.id,
            type: "ADJUST",
            amount: diff,
            balance: newBalance,
            description: data.description,
          },
        }),
      ]);

      await logAuditFor(app.prisma, req.session, {
        action: "ADJUST", resourceType: "loyalty_account", resourceId: customer.id,
        summary: `Ball balansi qo'lda o'zgartirildi: ${diff > 0 ? "+" : ""}${diff} (${account.balance} → ${newBalance}) — ${data.description}`,
        changes: { customerId: customer.id, from: account.balance, to: newBalance, diff },
      });

      return reply.code(201).send({ balance: newBalance, changed: diff });
    });

    // Stats
    admin.get("/stats", async (req) => {
      const tenantId = req.session.tenantId;
      const [accounts, txStats] = await Promise.all([
        app.prisma.loyaltyAccount.aggregate({
          where: { tenantId },
          _sum: { balance: true, totalEarned: true, totalSpent: true },
          _count: true,
        }),
        app.prisma.loyaltyTransaction.groupBy({
          by: ["type"],
          where: { tenantId },
          _count: true,
          _sum: { amount: true },
        }),
      ]);
      return {
        totalAccounts: accounts._count,
        totalBalance: accounts._sum.balance ?? 0,
        totalEarned: accounts._sum.totalEarned ?? 0,
        totalSpent: accounts._sum.totalSpent ?? 0,
        byType: txStats.map((t) => ({ type: t.type, count: t._count, total: t._sum.amount ?? 0 })),
      };
    });
  });

  // ─── Storefront endpointlar ───────────────────────────────────────────────

  // Mijozning balansini olish
  app.get<{ Params: { tenantSlug: string } }>(
    "/storefront/:tenantSlug/balance",
    async (req, reply) => {
      const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
      const { tgUserId } = z.object({ tgUserId: z.coerce.number().int().positive() }).parse(req.query);

      const tenant = await app.prisma.tenant.findUnique({
        where: { slug: tenantSlug }, select: { id: true },
      });
      if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

      const customer = await app.prisma.customer.findFirst({
        where: { tenantId: tenant.id, telegramUserId: BigInt(tgUserId) },
        select: { id: true },
      });
      if (!customer) return { balance: 0, totalEarned: 0, totalSpent: 0 };

      const account = await app.prisma.loyaltyAccount.findUnique({
        where: { customerId: customer.id },
        select: { balance: true, totalEarned: true, totalSpent: true },
      });
      return account ?? { balance: 0, totalEarned: 0, totalSpent: 0 };
    },
  );
};
