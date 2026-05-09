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
}

async function notifyCustomer(tgUserId: string | null, shopId: string, orderNumber: string, status: typeof orderStatuses[number]) {
  if (!tgUserId) return;
  const tgUser = await db.query.tgUsers.findFirst({ where: eq(schema.tgUsers.id, tgUserId) });
  if (!tgUser) return;
  const bot = await db.query.bots.findFirst({ where: eq(schema.bots.shopId, shopId) });
  if (!bot) return;
  const token = decrypt(bot.tokenEncrypted);
  const label = statusLabels[status];
  const emoji = status === "delivered" ? "🎉" : status === "cancelled" ? "❌" : "📦";
  await sendMessage(token, tgUser.tgUserId, `${emoji} Buyurtma <b>${orderNumber}</b> holati: <b>${label}</b>`);
}
