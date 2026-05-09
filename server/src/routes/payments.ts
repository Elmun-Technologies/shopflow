import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { decrypt, encrypt } from "../lib/crypto.js";
import { CLICK_ERRORS, verifyClickSign, type ClickPrepareRequest, type ClickCompleteRequest } from "../integrations/payments/click.js";
import { PAYME_ERRORS, verifyPaymeAuth, makeError, type PaymeRequest, type PaymeResponse } from "../integrations/payments/payme.js";
import { emit } from "../lib/events.js";

const clickConnectSchema = z.object({
  merchantId: z.string().min(1),
  serviceId: z.string().min(1),
  secretKey: z.string().min(1),
});

const paymeConnectSchema = z.object({
  merchantId: z.string().min(1),
  merchantKey: z.string().min(1),
});

export default async function paymentRoutes(app: FastifyInstance) {
  // ─── ADMIN endpoints (JWT kerak) ───────────────────────────────────
  app.register(async (admin) => {
    admin.addHook("onRequest", app.authenticate);

    function shopIdOf(req: { user: unknown }): string {
      const u = req.user as { kind?: string; shopId?: string };
      if (u.kind === "miniapp") throw new Error("Admin token kerak");
      if (!u.shopId) throw new Error("shopId yo'q");
      return u.shopId;
    }

    admin.post("/click", async (req) => {
      const sid = shopIdOf(req);
      const body = clickConnectSchema.parse(req.body);
      await upsertIntegration(sid, "click", body);
      return { ok: true };
    });

    admin.delete("/click", async (req) => {
      const sid = shopIdOf(req);
      await db.delete(schema.integrations)
        .where(and(eq(schema.integrations.shopId, sid), eq(schema.integrations.type, "click")));
      return { ok: true };
    });

    admin.post("/payme", async (req) => {
      const sid = shopIdOf(req);
      const body = paymeConnectSchema.parse(req.body);
      await upsertIntegration(sid, "payme", body);
      return { ok: true };
    });

    admin.delete("/payme", async (req) => {
      const sid = shopIdOf(req);
      await db.delete(schema.integrations)
        .where(and(eq(schema.integrations.shopId, sid), eq(schema.integrations.type, "payme")));
      return { ok: true };
    });
  });

  // ─── PUBLIC webhook endpoints (provider'lar chaqiradi) ─────────────

  // Click — application/x-www-form-urlencoded yuboradi
  app.post("/click/:shopId", async (req, reply) => {
    const params = req.params as { shopId: string };
    const integration = await db.query.integrations.findFirst({
      where: and(eq(schema.integrations.shopId, params.shopId), eq(schema.integrations.type, "click")),
    });
    if (!integration) return reply.send({ error: CLICK_ERRORS.REQUEST_INVALID, error_note: "Integration yo'q" });

    const cfg = JSON.parse(decrypt(integration.credentialsEncrypted)) as z.infer<typeof clickConnectSchema>;
    const body = req.body as ClickPrepareRequest | ClickCompleteRequest;

    if (!verifyClickSign(body, cfg.secretKey)) {
      return reply.send({ error: CLICK_ERRORS.SIGN_INVALID, error_note: "Imzo noto'g'ri" });
    }

    // merchant_trans_id = ShopFlow order id
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, body.merchant_trans_id), eq(schema.orders.shopId, params.shopId)),
    });
    if (!order) return reply.send({ error: CLICK_ERRORS.TRANSACTION_NOT_FOUND, error_note: "Buyurtma topilmadi" });

    if (Math.abs(Number(body.amount) - order.total) > 0.01) {
      return reply.send({ error: CLICK_ERRORS.AMOUNT_INVALID, error_note: "Miqdor noto'g'ri" });
    }

    if (body.action === "0") {
      // Prepare — payment yozuvini yaratamiz
      const [payment] = await db.insert(schema.payments).values({
        shopId: params.shopId,
        orderId: order.id,
        provider: "click",
        providerTxnId: body.click_trans_id,
        amount: order.total,
        state: "prepared",
        raw: body as unknown,
      }).returning();
      return reply.send({
        click_trans_id: body.click_trans_id,
        merchant_trans_id: body.merchant_trans_id,
        merchant_prepare_id: payment.id,
        error: 0,
        error_note: "Success",
      });
    }
    if (body.action === "1") {
      // Complete — to'lovni yakunlash
      const cb = body as ClickCompleteRequest;
      const payment = await db.query.payments.findFirst({ where: eq(schema.payments.id, cb.merchant_prepare_id) });
      if (!payment) return reply.send({ error: CLICK_ERRORS.TRANSACTION_NOT_FOUND, error_note: "Tayyorlov topilmadi" });

      if (cb.error !== "0" && cb.error !== "" && Number(cb.error) !== 0) {
        await db.update(schema.payments).set({ state: "cancelled", raw: cb as unknown, updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
        return reply.send({ click_trans_id: cb.click_trans_id, merchant_trans_id: cb.merchant_trans_id, merchant_confirm_id: payment.id, error: 0, error_note: "Cancelled" });
      }

      await db.update(schema.payments).set({ state: "paid", raw: cb as unknown, updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
      await db.update(schema.orders).set({ paymentStatus: "paid", paymentMethod: "click", updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
      emit({ type: "order.updated", shopId: params.shopId, orderId: order.id, status: order.status });

      return reply.send({
        click_trans_id: cb.click_trans_id,
        merchant_trans_id: cb.merchant_trans_id,
        merchant_confirm_id: payment.id,
        error: 0,
        error_note: "Success",
      });
    }

    return reply.send({ error: CLICK_ERRORS.ACTION_INVALID, error_note: "Action noto'g'ri" });
  });

  // Payme — JSON-RPC, application/json
  app.post("/payme/:shopId", async (req, reply) => {
    const params = req.params as { shopId: string };
    const integration = await db.query.integrations.findFirst({
      where: and(eq(schema.integrations.shopId, params.shopId), eq(schema.integrations.type, "payme")),
    });
    const rpc = req.body as PaymeRequest;
    const reply404: PaymeResponse = { jsonrpc: "2.0", id: rpc?.id ?? 0, error: makeError(PAYME_ERRORS.ACCESS, "Integration topilmadi") };
    if (!integration) return reply.send(reply404);

    const cfg = JSON.parse(decrypt(integration.credentialsEncrypted)) as z.infer<typeof paymeConnectSchema>;
    if (!verifyPaymeAuth(req.headers.authorization, cfg.merchantKey)) {
      return reply.send({ jsonrpc: "2.0", id: rpc?.id ?? 0, error: makeError(PAYME_ERRORS.ACCESS, "Auth xatosi") });
    }

    const respond = (result?: unknown, error?: NonNullable<PaymeResponse["error"]>): PaymeResponse =>
      ({ jsonrpc: "2.0", id: rpc.id, ...(error ? { error } : { result }) });

    try {
      switch (rpc.method) {
        case "CheckPerformTransaction": {
          const orderId = (rpc.params.account as { order_id?: string })?.order_id;
          if (!orderId) return reply.send(respond(undefined, makeError(PAYME_ERRORS.INVALID_ACCOUNT, "order_id yo'q")));
          const order = await db.query.orders.findFirst({ where: and(eq(schema.orders.id, orderId), eq(schema.orders.shopId, params.shopId)) });
          if (!order) return reply.send(respond(undefined, makeError(PAYME_ERRORS.ORDER_NOT_FOUND, "Buyurtma topilmadi")));
          const expected = Math.round(order.total * 100);
          if (Number(rpc.params.amount) !== expected) {
            return reply.send(respond(undefined, makeError(PAYME_ERRORS.INVALID_AMOUNT, "Miqdor noto'g'ri")));
          }
          if (order.paymentStatus === "paid") {
            return reply.send(respond(undefined, makeError(PAYME_ERRORS.ORDER_ALREADY_PAID, "To'lab bo'lingan")));
          }
          return reply.send(respond({ allow: true }));
        }
        case "CreateTransaction": {
          const txnId = String(rpc.params.id);
          const time = Number(rpc.params.time);
          const orderId = (rpc.params.account as { order_id?: string })?.order_id ?? "";
          const order = await db.query.orders.findFirst({ where: and(eq(schema.orders.id, orderId), eq(schema.orders.shopId, params.shopId)) });
          if (!order) return reply.send(respond(undefined, makeError(PAYME_ERRORS.ORDER_NOT_FOUND, "Buyurtma topilmadi")));

          const existing = await db.query.payments.findFirst({
            where: and(eq(schema.payments.providerTxnId, txnId), eq(schema.payments.provider, "payme")),
          });
          if (existing) {
            return reply.send(respond({ create_time: time, transaction: existing.id, state: existing.state === "paid" ? 2 : 1 }));
          }
          const [payment] = await db.insert(schema.payments).values({
            shopId: params.shopId,
            orderId: order.id,
            provider: "payme",
            providerTxnId: txnId,
            amount: order.total,
            state: "prepared",
            raw: rpc.params as unknown,
          }).returning();
          return reply.send(respond({ create_time: time, transaction: payment.id, state: 1 }));
        }
        case "PerformTransaction": {
          const txnId = String(rpc.params.id);
          const payment = await db.query.payments.findFirst({
            where: and(eq(schema.payments.providerTxnId, txnId), eq(schema.payments.provider, "payme")),
          });
          if (!payment) return reply.send(respond(undefined, makeError(PAYME_ERRORS.TRANSACTION_NOT_FOUND, "Tranzaksiya yo'q")));
          if (payment.state !== "paid") {
            await db.update(schema.payments).set({ state: "paid", updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
            await db.update(schema.orders).set({ paymentStatus: "paid", paymentMethod: "payme", updatedAt: new Date() }).where(eq(schema.orders.id, payment.orderId));
            emit({ type: "order.updated", shopId: params.shopId, orderId: payment.orderId, status: "pending" });
          }
          return reply.send(respond({ transaction: payment.id, perform_time: Date.now(), state: 2 }));
        }
        case "CancelTransaction": {
          const txnId = String(rpc.params.id);
          const payment = await db.query.payments.findFirst({
            where: and(eq(schema.payments.providerTxnId, txnId), eq(schema.payments.provider, "payme")),
          });
          if (!payment) return reply.send(respond(undefined, makeError(PAYME_ERRORS.TRANSACTION_NOT_FOUND, "Tranzaksiya yo'q")));
          await db.update(schema.payments).set({ state: "cancelled", updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
          return reply.send(respond({ transaction: payment.id, cancel_time: Date.now(), state: -1 }));
        }
        case "CheckTransaction": {
          const txnId = String(rpc.params.id);
          const payment = await db.query.payments.findFirst({
            where: and(eq(schema.payments.providerTxnId, txnId), eq(schema.payments.provider, "payme")),
          });
          if (!payment) return reply.send(respond(undefined, makeError(PAYME_ERRORS.TRANSACTION_NOT_FOUND, "Tranzaksiya yo'q")));
          return reply.send(respond({
            create_time: Number(payment.createdAt),
            perform_time: payment.state === "paid" ? Number(payment.updatedAt) : 0,
            cancel_time: payment.state === "cancelled" ? Number(payment.updatedAt) : 0,
            transaction: payment.id,
            state: payment.state === "paid" ? 2 : payment.state === "cancelled" ? -1 : 1,
            reason: null,
          }));
        }
        default:
          return reply.send(respond(undefined, makeError(PAYME_ERRORS.REQUIRED_FIELD, "method noto'g'ri")));
      }
    } catch (err) {
      return reply.send({ jsonrpc: "2.0", id: rpc.id, error: makeError(PAYME_ERRORS.TRANSPORT, err instanceof Error ? err.message : "xato") });
    }
  });
}

async function upsertIntegration(shopId: string, type: "click" | "payme", body: object) {
  const encrypted = encrypt(JSON.stringify(body));
  const existing = await db.query.integrations.findFirst({
    where: and(eq(schema.integrations.shopId, shopId), eq(schema.integrations.type, type)),
  });
  if (existing) {
    await db.update(schema.integrations)
      .set({ credentialsEncrypted: encrypted, status: "connected" })
      .where(eq(schema.integrations.id, existing.id));
  } else {
    await db.insert(schema.integrations).values({
      shopId,
      type,
      credentialsEncrypted: encrypted,
      status: "connected",
    });
  }
}
