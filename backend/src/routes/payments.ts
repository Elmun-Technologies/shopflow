// Payments routes — admin panel uchun to'lov usullari va tranzaksiyalarni
// boshqarish + provayder'lar (Click/Payme/Uzum/...) uchun webhook qabuli.

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient, Prisma } from "@prisma/client";
import { PaymentTxStatus } from "@prisma/client";
import { z } from "zod";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { logAudit } from "../lib/audit.js";
import { fireWebhookEvent } from "../lib/outbound-webhook.js";
import { amountsMatch, reconcileOutcome, type ReconOutcome } from "../lib/payment-reconcile.js";

function getPublicBaseUrl(): string {
  const raw =
    process.env.PUBLIC_URL ??
    process.env.API_PUBLIC_URL ??
    `https://${process.env.DOMAIN ?? "shop-flow.uz"}`;
  return raw.replace(/\/$/, "");
}

/** Har bir tenant uchun noyob webhook URL (Click/Payme kabilar path orqali tenantni biladi). */
export function paymentWebhookUrl(tenantSlug: string, methodCode: string): string {
  return `${getPublicBaseUrl()}/api/payments/webhook/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(methodCode)}`;
}

async function resolveTenantId(prisma: PrismaClient, ref: string): Promise<string | null> {
  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ slug: ref }, { id: ref }] },
    select: { id: true },
  });
  return tenant?.id ?? null;
}

type WebhookPaymentMethod = {
  id: string;
  tenantId: string;
  autoConfirm: boolean;
  config: unknown;
  testMode: boolean;
};

async function loadPaymentMethodForWebhook(
  prisma: PrismaClient,
  tenantRef: string,
  methodCode: string,
): Promise<WebhookPaymentMethod | null> {
  const tenantId = await resolveTenantId(prisma, tenantRef);
  if (!tenantId) return null;
  return prisma.paymentMethod.findUnique({
    where: { tenantId_code: { tenantId, code: methodCode } },
    select: { id: true, tenantId: true, autoConfirm: true, config: true, testMode: true },
  });
}

/** Buyurtmani to'lov referensi (order.code yoki id) bo'yicha topadi — total bilan. */
export async function findOrderForPayment(
  prisma: PrismaClient,
  tenantId: string,
  orderRef: string | null | undefined,
): Promise<{ id: string; total: number } | null> {
  if (!orderRef) return null;
  const o = await prisma.order.findFirst({
    where: { tenantId, OR: [{ code: orderRef }, { id: orderRef }] },
    select: { id: true, total: true },
  });
  return o ? { id: o.id, total: Number(o.total) } : null;
}

/**
 * To'lov natijasini DB'ga yozadi: PaymentTransaction yaratadi/yangilaydi
 * (externalId bo'yicha idempotent — webhook qayta kelsa duplikat bo'lmaydi).
 *
 * RECONCILIATION: SUCCESS webhook'ida buyurtma mavjudligi va summa mosligi
 * tekshiriladi. Order topilmasa yoki summa order.total bilan mos kelmasa —
 * buyurtma "paid" deb belgilanMAYDI, tranzaksiya FAILED sifatida sabab bilan
 * yoziladi. Bu imzo tekshiruvidan keyingi himoya qatlami (provider'dan qat'i
 * nazar noto'g'ri summa/order uchun pul tasdiqlanmaydi).
 */
async function recordPaymentResult(
  prisma: PrismaClient,
  method: { id: string; tenantId: string },
  args: {
    orderRef?: string | null; // merchant_trans_id — odatda order.code
    externalId?: string | null; // provayder transaction id
    amount: number;
    currency?: string;
    status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
    payload: unknown;
    errorMessage?: string | null;
  },
): Promise<{ orderId: string | null; outcome: ReconOutcome }> {
  const { tenantId } = method;

  const order = await findOrderForPayment(prisma, tenantId, args.orderRef);

  // Reconciliation natijasi
  const outcome = reconcileOutcome(args.orderRef, order, args.amount);

  // SUCCESS bo'lsa-yu reconciliation muammosi bo'lsa — FAILED'ga aylantiramiz
  const reconcileOk = outcome === "ok";
  const effectiveStatus: PaymentTxStatus =
    args.status === "SUCCESS" && !reconcileOk ? "FAILED" : (args.status as PaymentTxStatus);
  const effectiveError =
    args.status === "SUCCESS" && !reconcileOk
      ? outcome === "no_order"
        ? `Reconciliation: buyurtma topilmadi (ref=${args.orderRef})`
        : `Reconciliation: summa mos emas (webhook=${args.amount}, order=${order?.total})`
      : args.errorMessage ?? null;

  const completedAt = effectiveStatus === "SUCCESS" ? new Date() : null;
  const baseData = {
    tenantId,
    methodId: method.id,
    orderId: order?.id ?? null,
    amount: args.amount,
    currency: args.currency ?? "UZS",
    status: effectiveStatus,
    payload: (args.payload ?? null) as Prisma.InputJsonValue,
    errorMessage: effectiveError,
    completedAt,
  };

  // externalId bor → idempotent upsert; yo'q → oddiy create
  if (args.externalId) {
    await prisma.paymentTransaction.upsert({
      where: {
        tenantId_methodId_externalId: { tenantId, methodId: method.id, externalId: args.externalId },
      },
      create: { ...baseData, externalId: args.externalId },
      update: { status: effectiveStatus, completedAt, errorMessage: effectiveError, orderId: baseData.orderId },
    });
  } else {
    await prisma.paymentTransaction.create({ data: baseData });
  }

  // Faqat reconciliation OK bo'lganda buyurtmani paid deb belgilaymiz
  if (args.status === "SUCCESS" && reconcileOk && order) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paid: true, paidAt: new Date() },
    });
    // Outbound webhook — order.paid
    fireWebhookEvent(prisma, tenantId, "order.paid", {
      order: { id: order.id, amount: args.amount, currency: args.currency ?? "UZS" },
    }).catch(() => null);
  }

  return { orderId: order?.id ?? null, outcome };
}

function tenantRefFromRequest(req: FastifyRequest): string | undefined {
  const header = req.headers["x-shopflow-tenant"];
  if (typeof header === "string" && header.trim()) return header.trim();
  const q = req.query as { tenant?: string };
  if (typeof q.tenant === "string" && q.tenant.trim()) return q.tenant.trim();
  return undefined;
}

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
      const tenant = await admin.prisma.tenant.findUnique({
        where: { id: req.session.tenantId },
        select: { slug: true },
      });
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
            webhookUrl: tenant?.slug ? paymentWebhookUrl(tenant.slug, m.code) : undefined,
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
  const handlePaymentWebhook = async (
    req: FastifyRequest,
    reply: FastifyReply,
    tenantRef: string,
    methodCode: string,
  ) => {
      const method = await loadPaymentMethodForWebhook(app.prisma, tenantRef, methodCode);
      if (!method) {
        return reply.code(404).send({ error: "Payment method not found" });
      }

      const cfg = (method.config ?? {}) as Record<string, string>;
      const body = req.body as Record<string, unknown>;
      const rawBody = JSON.stringify(req.body);

      // ─── Click.uz signature verification ─────────────────────────────────
      // Click to'liq protokoli: action=0 (Prepare), action=1 (Complete)
      // sign_string = MD5(click_trans_id + service_id + secret_key +
      //               merchant_trans_id + amount + action + error)
      if (methodCode === "click") {
        const b = body as {
          click_trans_id?: string | number;
          service_id?: string | number;
          merchant_trans_id?: string;
          amount?: string | number;
          action?: string | number;
          error?: string | number;
          sign_string?: string;
          sign_time?: string;
        };

        const secretKey = cfg.secretKey ?? "";
        const serviceId = cfg.serviceId ?? String(b.service_id ?? "");

        if (secretKey && b.sign_string && b.click_trans_id !== undefined) {
          const signSource = [
            b.click_trans_id,
            serviceId,
            secretKey,
            b.merchant_trans_id ?? "",
            b.amount ?? "",
            b.action ?? "",
            b.error ?? "0",
          ].join("");

          const expected = createHash("md5").update(signSource).digest("hex");

          if (!timingSafeEqual(Buffer.from(b.sign_string), Buffer.from(expected))) {
            app.log.warn({ methodCode, tenantId: method.tenantId, sign_string: b.sign_string, expected }, "[payments] Click sign mismatch");
            return reply.code(200).send({ error: -1, error_note: "SIGN CHECK FAILED" });
          }
        } else if (!method.testMode) {
          // Production'da imzo majburiy — yo'q bo'lsa rad etamiz
          app.log.warn({ methodCode, tenantId: method.tenantId }, "[payments] Click signature missing/key not set in non-test mode — rejected");
          return reply.code(200).send({ error: -1, error_note: secretKey ? "SIGN REQUIRED" : "PROVIDER NOT CONFIGURED" });
        }

        // Click action — string yoki number bo'lishi mumkin; faqat "0" va "1" qabul qilinadi
        const actionRaw = b.action;
        const action = (actionRaw === 0 || actionRaw === "0") ? 0 : (actionRaw === 1 || actionRaw === "1") ? 1 : -1;
        if (action === 0) {
          // Prepare: buyurtma mavjudligi va summa mosligini tekshirish.
          // Click kodlari: -5 (buyurtma topilmadi), -2 (summa noto'g'ri).
          const order = await findOrderForPayment(app.prisma, method.tenantId, b.merchant_trans_id ?? null);
          if (!order) {
            return reply.code(200).send({
              click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id,
              error: -5, error_note: "Order not found",
            });
          }
          if (!amountsMatch(Number(b.amount ?? 0), order.total)) {
            return reply.code(200).send({
              click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id,
              error: -2, error_note: "Incorrect amount",
            });
          }
          return reply.code(200).send({
            click_trans_id: b.click_trans_id,
            merchant_trans_id: b.merchant_trans_id,
            merchant_prepare_id: Date.now(),
            error: 0,
            error_note: "Success",
          });
        } else if (action === 1) {
          // Complete: to'lovni tasdiqlash. error < 0 — bekor/muvaffaqiyatsiz.
          const clickError = Number(b.error ?? 0);
          const recon = await recordPaymentResult(app.prisma, method, {
            orderRef: b.merchant_trans_id ?? null,
            externalId: b.click_trans_id !== undefined ? String(b.click_trans_id) : null,
            amount: Number(b.amount ?? 0),
            currency: "UZS",
            status: clickError < 0 ? "FAILED" : "SUCCESS",
            payload: req.body,
            errorMessage: clickError < 0 ? `Click error ${clickError}` : null,
          }).catch((err) => {
            app.log.error({ err, methodCode }, "[payments] Click tx persist failed");
            return null;
          });

          // Reconciliation muvaffaqiyatsiz bo'lsa Click'ga mos xato qaytaramiz
          if (clickError >= 0 && recon?.outcome === "no_order") {
            return reply.code(200).send({
              click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id,
              error: -5, error_note: "Order not found",
            });
          }
          if (clickError >= 0 && recon?.outcome === "amount_mismatch") {
            app.log.warn({ methodCode, tenantId: method.tenantId, orderRef: b.merchant_trans_id }, "[payments] Click amount mismatch — to'lov rad etildi");
            return reply.code(200).send({
              click_trans_id: b.click_trans_id, merchant_trans_id: b.merchant_trans_id,
              error: -2, error_note: "Incorrect amount",
            });
          }

          return reply.code(200).send({
            click_trans_id: b.click_trans_id,
            merchant_trans_id: b.merchant_trans_id,
            merchant_confirm_id: Date.now(),
            error: 0,
            error_note: "Success",
          });
        }

      // ─── Payme (Paycom) JSON-RPC protocol ────────────────────────────────
      } else if (methodCode === "payme") {
        // Payme: Basic auth — `Paycom:${cashierKey}`
        const authHeader = req.headers["authorization"] as string | undefined;
        const cashierKey = cfg.secretKey ?? cfg.cashierKey ?? "";

        if (authHeader && cashierKey) {
          const expectedAuth = `Basic ${Buffer.from(`Paycom:${cashierKey}`).toString("base64")}`;
          const providedBuf = Buffer.from(authHeader.trim());
          const expectedBuf = Buffer.from(expectedAuth.trim());
          const match = providedBuf.length === expectedBuf.length
            ? timingSafeEqual(providedBuf, expectedBuf)
            : false;
          if (!match) {
            app.log.warn({ methodCode, tenantId: method.tenantId }, "[payments] Payme auth mismatch");
            // Payme JSON-RPC error format
            return reply.code(200).send({
              id: (body as { id?: unknown }).id,
              error: { code: -32504, message: { ru: "Insufficient privilege to execute this method", en: "Insufficient privilege to execute this method", uz: "Usul bajarishga ruxsat yo'q" }, data: "auth" },
            });
          }
        } else if (!method.testMode && cashierKey) {
          // Production'da imzo majburiy — Authorization yo'q bo'lsa rad etamiz
          app.log.warn({ methodCode, tenantId: method.tenantId }, "[payments] Payme auth missing in non-test mode — rejected");
          return reply.code(200).send({
            id: (body as { id?: unknown }).id,
            error: { code: -32504, message: { en: "Authorization required" }, data: "auth" },
          });
        } else if (!method.testMode && !cashierKey) {
          // Production'da kalit ham sozlanmagan — sozlash kerakligini xabar qilamiz
          app.log.error({ methodCode, tenantId: method.tenantId }, "[payments] Payme cashierKey not configured");
          return reply.code(200).send({
            id: (body as { id?: unknown }).id,
            error: { code: -32504, message: { en: "Payment provider not configured" } },
          });
        }

        // JSON-RPC method dispatch
        const rpcMethod = (body as { method?: string }).method ?? "";
        const rpcId = (body as { id?: unknown }).id;
        const params = (body as { params?: Record<string, unknown> }).params ?? {};

        // Payme account'dan buyurtma referensi (sozlama bo'yicha turli nom bo'lishi mumkin)
        const pmAccount = (params.account ?? {}) as Record<string, unknown>;
        const pmOrderRef =
          (pmAccount.order_id ?? pmAccount.order ?? pmAccount.code ?? pmAccount.orderId) as string | undefined;
        const pmTxId = params.id !== undefined ? String(params.id) : null;
        const pmAmount = Number(params.amount ?? 0) / 100; // Payme tiyin'da yuboradi

        if (rpcMethod === "CheckPerformTransaction") {
          // Payme protokoli: bu yerda buyurtma mavjudligi va summa mosligi
          // tekshirilishi SHART (aks holda istalgan summa/order qabul qilinardi).
          const order = await findOrderForPayment(app.prisma, method.tenantId, pmOrderRef ?? null);
          if (!order) {
            return reply.code(200).send({
              id: rpcId,
              error: { code: -31050, message: { ru: "Заказ не найден", en: "Order not found", uz: "Buyurtma topilmadi" }, data: "order_id" },
            });
          }
          if (!amountsMatch(pmAmount, order.total)) {
            app.log.warn({ methodCode, tenantId: method.tenantId, orderRef: pmOrderRef }, "[payments] Payme amount mismatch — rad etildi");
            return reply.code(200).send({
              id: rpcId,
              error: { code: -31001, message: { ru: "Неверная сумма", en: "Incorrect amount", uz: "Summa noto'g'ri" } },
            });
          }
          return reply.code(200).send({
            id: rpcId,
            result: { allow: true },
          });
        } else if (rpcMethod === "CreateTransaction") {
          // PENDING tranzaksiya yaratamiz — order bilan bog'laymiz (idempotent)
          await recordPaymentResult(app.prisma, method, {
            orderRef: pmOrderRef ?? null,
            externalId: pmTxId,
            amount: pmAmount,
            currency: "UZS",
            status: "PENDING",
            payload: req.body,
          }).catch((err) => app.log.error({ err }, "[payments] Payme create persist failed"));

          return reply.code(200).send({
            id: rpcId,
            result: {
              create_time: Date.now(),
              transaction: pmTxId,
              state: 1,
            },
          });
        } else if (rpcMethod === "PerformTransaction") {
          // To'lov tasdiqlandi → SUCCESS + buyurtma paid
          await recordPaymentResult(app.prisma, method, {
            orderRef: pmOrderRef ?? null,
            externalId: pmTxId,
            amount: pmAmount,
            currency: "UZS",
            status: "SUCCESS",
            payload: req.body,
          }).catch((err) => app.log.error({ err }, "[payments] Payme perform persist failed"));

          return reply.code(200).send({
            id: rpcId,
            result: {
              transaction: pmTxId,
              perform_time: Date.now(),
              state: 2,
            },
          });
        } else if (rpcMethod === "CancelTransaction") {
          await recordPaymentResult(app.prisma, method, {
            orderRef: pmOrderRef ?? null,
            externalId: pmTxId,
            amount: pmAmount,
            currency: "UZS",
            status: "CANCELLED",
            payload: req.body,
          }).catch((err) => app.log.error({ err }, "[payments] Payme cancel persist failed"));

          return reply.code(200).send({
            id: rpcId,
            result: {
              transaction: pmTxId,
              cancel_time: Date.now(),
              state: -2,
            },
          });
        } else if (rpcMethod === "CheckTransaction") {
          return reply.code(200).send({
            id: rpcId,
            result: {
              create_time: 0,
              perform_time: 0,
              cancel_time: 0,
              transaction: params.id,
              state: 1,
              reason: null,
            },
          });
        } else if (rpcMethod === "GetStatement") {
          return reply.code(200).send({ id: rpcId, result: { transactions: [] } });
        }

      // ─── Uzum Bank (HMAC-SHA256) ──────────────────────────────────────────
      } else if (methodCode === "uzum") {
        const signHeader = req.headers["x-hub-signature-256"] ?? req.headers["x-sign"];
        const secretKey = cfg.secretKey ?? "";

        if (signHeader && secretKey) {
          const signValue = String(signHeader).replace(/^sha256=/, "");
          const expected = createHmac("sha256", secretKey).update(rawBody).digest("hex");
          const providedBuf = Buffer.from(signValue.toLowerCase(), "hex");
          const expectedBuf = Buffer.from(expected, "hex");
          if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
            app.log.warn({ methodCode, tenantId: method.tenantId }, "[payments] Uzum HMAC mismatch");
            return reply.code(401).send({ error: "Invalid signature" });
          }
        } else if (!method.testMode) {
          // Production'da imzo majburiy
          app.log.warn({ methodCode, tenantId: method.tenantId }, "[payments] Uzum signature missing/key not set in non-test mode — rejected");
          return reply.code(401).send({ error: secretKey ? "SIGN REQUIRED" : "PROVIDER NOT CONFIGURED" });
        }

        // Uzum payload'idan buyurtma va status — defensiv o'qish (nom turlanishi mumkin)
        const uz = body as Record<string, unknown>;
        const uzOrderRef = (uz.orderId ?? uz.order_id ?? uz.merchant_trans_id ?? uz.orderNumber) as string | undefined;
        const uzTxId = (uz.transactionId ?? uz.transaction_id ?? uz.paymentId ?? uz.id) as string | number | undefined;
        const uzStatusRaw = String(uz.status ?? uz.event ?? uz.paymentStatus ?? "").toUpperCase();
        const uzSuccess = /SUCCESS|PAID|CONFIRM|COMPLETE|APPROVE/.test(uzStatusRaw);
        const uzFailed = /FAIL|CANCEL|DECLINE|REVERS|REFUND/.test(uzStatusRaw);
        if (uzOrderRef && (uzSuccess || uzFailed)) {
          await recordPaymentResult(app.prisma, method, {
            orderRef: String(uzOrderRef),
            externalId: uzTxId !== undefined ? String(uzTxId) : null,
            amount: Number(uz.amount ?? 0),
            currency: "UZS",
            status: uzSuccess ? "SUCCESS" : "CANCELLED",
            payload: req.body,
          }).catch((err) => app.log.error({ err, methodCode }, "[payments] Uzum tx persist failed"));
        }
      }

      app.log.info({ methodCode, tenantId: method.tenantId, event: (body as Record<string,unknown>).event }, "[payments] webhook received");

      // Tranzaksiyani DB ga yozish (audit)
      await logAudit({
        prisma: app.prisma,
        tenantId: method.tenantId,
        action: `payment_webhook_${methodCode}`,
        resourceType: "PaymentMethod",
        resourceId: method.id,
        changes: { body: req.body },
      });

      return reply.code(200).send({ ok: true });
  };

  // Asosiy URL: /api/payments/webhook/:tenantSlug/:methodCode
  app.post<{ Params: { tenantSlug: string; methodCode: string }; Body: unknown }>(
    "/webhook/:tenantSlug/:methodCode",
    async (req, reply) => {
      const { tenantSlug, methodCode } = z
        .object({ tenantSlug: z.string().min(1), methodCode: z.string().min(1) })
        .parse(req.params);
      return handlePaymentWebhook(req, reply, tenantSlug, methodCode);
    },
  );

  // Legacy: /api/payments/webhook/:methodCode?tenant=slug yoki x-shopflow-tenant header
  app.post<{ Params: { methodCode: string }; Body: unknown }>(
    "/webhook/:methodCode",
    async (req, reply) => {
      const { methodCode } = z.object({ methodCode: z.string().min(1) }).parse(req.params);
      const tenantRef = tenantRefFromRequest(req);
      if (!tenantRef) {
        return reply.code(400).send({
          error: "Tenant talab qilinadi",
          hint: "Yangi URL: /api/payments/webhook/{tenantSlug}/{methodCode} yoki ?tenant=slug",
        });
      }
      return handlePaymentWebhook(req, reply, tenantRef, methodCode);
    },
  );
};
