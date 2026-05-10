import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { decrypt } from "../lib/crypto.js";
import { sendMessage } from "../services/telegram.js";
import { emit } from "../lib/events.js";

const orderStatuses = ["pending", "confirmed", "preparing", "shipping", "delivered", "cancelled"] as const;

const statusLabels: Record<typeof orderStatuses[number], string> = {
  pending: "Kutilmoqda",
  confirmed: "Tasdiqlandi",
  preparing: "Tayyorlanmoqda",
  shipping: "Yetkazilmoqda",
  delivered: "Yetkazildi",
  cancelled: "Bekor qilindi",
};

const updateSchema = z.object({
  status: z.enum(orderStatuses).optional(),
  paymentStatus: z.enum(["unpaid", "paid", "refunded"]).optional(),
  notes: z.string().optional(),
});

export default async function orderRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  function shopIdOf(req: { user: unknown }): string {
    const u = req.user as { kind?: string; shopId?: string };
    if (u.kind === "miniapp") throw new Error("Admin token kerak");
    if (!u.shopId) throw new Error("shopId yo'q");
    return u.shopId;
  }

  app.get("/", async (req) => {
    const sid = shopIdOf(req);
    const query = z.object({
      status: z.enum(orderStatuses).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(req.query);

    const where = query.status
      ? and(eq(schema.orders.shopId, sid), eq(schema.orders.status, query.status))
      : eq(schema.orders.shopId, sid);

    const rows = await db.query.orders.findMany({
      where,
      orderBy: [desc(schema.orders.createdAt)],
      limit: query.limit,
    });
    return rows;
  });

  app.get("/stats", async (req) => {
    const sid = shopIdOf(req);
    const rows = await db.select({
      status: schema.orders.status,
      count: sql<number>`count(*)`.as("count"),
      total: sql<number>`coalesce(sum(${schema.orders.total}), 0)`.as("total"),
    })
      .from(schema.orders)
      .where(eq(schema.orders.shopId, sid))
      .groupBy(schema.orders.status);
    return rows;
  });

  app.get("/:id", async (req, reply) => {
    const sid = shopIdOf(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, params.id), eq(schema.orders.shopId, sid)),
    });
    if (!order) return reply.code(404).send({ error: "Buyurtma topilmadi" });
    const items = await db.query.orderItems.findMany({ where: eq(schema.orderItems.orderId, order.id) });
    let customer = null;
    if (order.tgUserId) {
      customer = await db.query.tgUsers.findFirst({ where: eq(schema.tgUsers.id, order.tgUserId) });
    }
    return { ...order, items, customer };
  });

  app.patch("/:id", async (req, reply) => {
    const sid = shopIdOf(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = updateSchema.parse(req.body);

    const existing = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, params.id), eq(schema.orders.shopId, sid)),
    });
    if (!existing) return reply.code(404).send({ error: "Buyurtma topilmadi" });

    const [updated] = await db.update(schema.orders)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.orders.id, existing.id))
      .returning();

    if (body.status && body.status !== existing.status) {
      await notifyCustomer(existing.tgUserId, sid, updated.orderNumber, body.status).catch((err) => {
        req.log.warn({ err }, "mijozga xabar yuborilmadi");
      });
      emit({ type: "order.updated", shopId: sid, orderId: updated.id, status: body.status });
    }

    return updated;
  });

  /** Export to CSV (Assembly sheet) */
  app.get("/export", async (req, reply) => {
    const sid = shopIdOf(req);
    const query = z.object({
      statuses: z.string().optional(), // comma-separated
      type: z.enum(["by_orders", "by_products"]).default("by_orders"),
      format: z.enum(["csv", "json"]).default("csv"),
    }).parse(req.query);

    const statuses = query.statuses ? query.statuses.split(",").filter(Boolean) : null;
    const allOrders = await db.query.orders.findMany({
      where: eq(schema.orders.shopId, sid),
      orderBy: [desc(schema.orders.createdAt)],
    });
    const filtered = statuses ? allOrders.filter((o) => statuses.includes(o.status)) : allOrders;

    if (query.type === "by_products") {
      // Each row = order item
      const orderIds = filtered.map((o) => o.id);
      const items = orderIds.length > 0
        ? await db.query.orderItems.findMany({
            where: sql`${schema.orderItems.orderId} IN (${sql.raw(orderIds.map((id) => `'${id}'`).join(","))})`,
          })
        : [];
      const orderMap = new Map(filtered.map((o) => [o.id, o]));
      const rows = items.map((it) => {
        const o = orderMap.get(it.orderId);
        return {
          order_number: o?.orderNumber ?? "",
          date: o ? new Date(o.createdAt as Date | number).toISOString().slice(0, 10) : "",
          status: o?.status ?? "",
          customer_phone: o?.customerPhone ?? "",
          product_name: it.productName,
          quantity: it.quantity,
          price: it.price,
          total: it.total,
        };
      });
      if (query.format === "json") return rows;
      return reply.type("text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="orders_by_products_${Date.now()}.csv"`)
        .send(toCsv(rows));
    }

    // by_orders — each row = order
    const rows = filtered.map((o) => {
      const addr = o.deliveryAddress as { city?: string; street?: string; house?: string; apartment?: string } | null;
      return {
        order_number: o.orderNumber,
        date: new Date(o.createdAt as Date | number).toISOString().slice(0, 19).replace("T", " "),
        status: o.status,
        payment_status: o.paymentStatus,
        payment_method: o.paymentMethod ?? "",
        source: o.source,
        customer_phone: o.customerPhone ?? "",
        address: [addr?.city, addr?.street, addr?.house, addr?.apartment].filter(Boolean).join(", "),
        subtotal: o.subtotal,
        delivery_fee: o.deliveryFee,
        total: o.total,
        notes: o.notes ?? "",
      };
    });
    if (query.format === "json") return rows;
    return reply.type("text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="orders_${Date.now()}.csv"`)
      .send(toCsv(rows));
  });
}

async function notifyCustomer(tgUserId: string | null, shopId: string, orderNumber: string, status: typeof orderStatuses[number]) {
  if (!tgUserId) return;
  const tgUser = await db.query.tgUsers.findFirst({ where: eq(schema.tgUsers.id, tgUserId) });
  if (!tgUser) return;
  const bot = await db.query.bots.findFirst({ where: eq(schema.bots.shopId, shopId) });
  if (!bot) return;
  const token = decrypt(bot.tokenEncrypted);

  // Avtoresponder shablonini settings'dan o'qish
  const setting = await db.query.shopSettings.findFirst({
    where: and(eq(schema.shopSettings.shopId, shopId), eq(schema.shopSettings.key, "autoresponder")),
  });
  const templates = (setting?.value as Record<string, string> | null) ?? {};
  const defaultLabel = statusLabels[status];
  const emoji = status === "delivered" ? "🎉" : status === "cancelled" ? "❌" : "📦";

  let template = templates[status];
  if (!template) {
    template = `${emoji} Buyurtma <b>{order_id}</b> holati: <b>${defaultLabel}</b>`;
  }
  // Variable replacement
  const text = template.replace(/\{order_id\}/g, orderNumber).replace(/\{status\}/g, defaultLabel);
  await sendMessage(token, tgUser.tgUserId, text);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return "﻿" + lines.join("\n");
}
