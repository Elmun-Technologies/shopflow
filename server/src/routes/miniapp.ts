import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authenticateMiniAppUser, genOrderNumber } from "../services/miniapp.js";
import { decrypt } from "../lib/crypto.js";
import { sendMessage } from "../services/telegram.js";

const authSchema = z.object({ botId: z.string(), initData: z.string() });

const cartItemSchema = z.object({ productId: z.string(), quantity: z.number().int().min(1).max(99) });

const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  customerPhone: z.string().min(5),
  deliveryAddress: z.object({
    city: z.string().optional(),
    street: z.string().optional(),
    house: z.string().optional(),
    apartment: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
  paymentMethod: z.enum(["cash", "card_online", "transfer"]).default("cash"),
  notes: z.string().optional(),
});

export default async function miniappRoutes(app: FastifyInstance) {
  // 1. Auth — initData → JWT
  app.post("/auth", async (req, reply) => {
    const body = authSchema.parse(req.body);
    const { tgUser, shop, bot } = await authenticateMiniAppUser(body);
    const token = app.jwt.sign({
      kind: "miniapp",
      tgUserId: tgUser.id,
      shopId: tgUser.shopId,
      botId: bot.id,
    });
    return reply.send({
      token,
      user: {
        id: tgUser.id,
        firstName: tgUser.firstName,
        username: tgUser.username,
      },
      shop: { id: shop?.id, name: shop?.name, currency: shop?.currency ?? "UZS" },
    });
  });

  // Quyidagilar uchun JWT kerak
  app.register(async (api) => {
    api.addHook("onRequest", async (req, reply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply.code(401).send({ error: "Avtorizatsiya kerak" });
      }
      const payload = req.user as unknown as { kind?: string };
      if (payload.kind !== "miniapp") {
        return reply.code(403).send({ error: "Mini App tokeni emas" });
      }
    });

    // 2. Catalog — kategoriyalar + mahsulotlar
    api.get("/catalog", async (req) => {
      const { shopId } = req.user as unknown as { shopId: string };
      const cats = await db.query.categories.findMany({
        where: eq(schema.categories.shopId, shopId),
        orderBy: [schema.categories.sortOrder],
      });
      const prods = await db.query.products.findMany({
        where: and(eq(schema.products.shopId, shopId), eq(schema.products.active, true)),
      });
      return { categories: cats, products: prods };
    });

    api.get("/products/:id", async (req, reply) => {
      const { shopId } = req.user as unknown as { shopId: string };
      const params = z.object({ id: z.string() }).parse(req.params);
      const product = await db.query.products.findFirst({
        where: and(eq(schema.products.id, params.id), eq(schema.products.shopId, shopId)),
      });
      if (!product) return reply.code(404).send({ error: "Mahsulot topilmadi" });
      return product;
    });

    // 3. Cart — saqlash/o'qish
    api.get("/cart", async (req) => {
      const { tgUserId, shopId } = req.user as unknown as { tgUserId: string; shopId: string };
      const cart = await db.query.carts.findFirst({
        where: and(eq(schema.carts.shopId, shopId), eq(schema.carts.tgUserId, tgUserId)),
      });
      return { items: cart?.items ?? [] };
    });

    api.put("/cart", async (req) => {
      const { tgUserId, shopId } = req.user as unknown as { tgUserId: string; shopId: string };
      const body = z.object({ items: z.array(cartItemSchema) }).parse(req.body);
      const existing = await db.query.carts.findFirst({
        where: and(eq(schema.carts.shopId, shopId), eq(schema.carts.tgUserId, tgUserId)),
      });
      if (existing) {
        await db.update(schema.carts).set({ items: body.items, updatedAt: new Date() }).where(eq(schema.carts.id, existing.id));
      } else {
        await db.insert(schema.carts).values({ shopId, tgUserId, items: body.items });
      }
      return { ok: true };
    });

    // 4. Order — yaratish
    api.post("/orders", async (req, reply) => {
      const { tgUserId, shopId, botId } = req.user as unknown as { tgUserId: string; shopId: string; botId: string };
      const body = checkoutSchema.parse(req.body);

      const productIds = body.items.map((i) => i.productId);
      const products = await db.query.products.findMany({ where: inArray(schema.products.id, productIds) });
      const productMap = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const itemsToInsert: Array<{ orderId: string; productId: string; productName: string; quantity: number; price: number; total: number }> = [];
      for (const it of body.items) {
        const p = productMap.get(it.productId);
        if (!p) return reply.code(400).send({ error: `Mahsulot topilmadi: ${it.productId}` });
        if (p.shopId !== shopId) return reply.code(400).send({ error: "Boshqa do'kon mahsuloti" });
        if (p.stock < it.quantity) return reply.code(400).send({ error: `${p.name}: yetarli qoldiq yo'q` });
        const total = p.price * it.quantity;
        subtotal += total;
        itemsToInsert.push({ orderId: "", productId: p.id, productName: p.name, quantity: it.quantity, price: p.price, total });
      }

      const orderNumber = await genOrderNumber(shopId);
      const [order] = await db.insert(schema.orders).values({
        shopId,
        orderNumber,
        tgUserId,
        source: "miniapp",
        subtotal,
        deliveryFee: 0,
        total: subtotal,
        customerPhone: body.customerPhone,
        deliveryAddress: body.deliveryAddress ?? null,
        paymentMethod: body.paymentMethod,
        notes: body.notes,
      }).returning();

      await db.insert(schema.orderItems).values(itemsToInsert.map((it) => ({ ...it, orderId: order.id })));

      // Stocklarni kamaytirish
      for (const it of body.items) {
        const p = productMap.get(it.productId)!;
        await db.update(schema.products).set({ stock: p.stock - it.quantity, updatedAt: new Date() }).where(eq(schema.products.id, p.id));
      }

      // Savatni tozalash
      await db.update(schema.carts).set({ items: [], updatedAt: new Date() }).where(and(eq(schema.carts.shopId, shopId), eq(schema.carts.tgUserId, tgUserId)));

      // Bot orqali xaridorga tasdiq xabari
      try {
        const bot = await db.query.bots.findFirst({ where: eq(schema.bots.id, botId) });
        const tgUser = await db.query.tgUsers.findFirst({ where: eq(schema.tgUsers.id, tgUserId) });
        if (bot && tgUser) {
          const token = decrypt(bot.tokenEncrypted);
          const lines = itemsToInsert.map((it) => `• ${it.productName} × ${it.quantity} = ${it.total.toLocaleString()} so'm`).join("\n");
          await sendMessage(token, tgUser.tgUserId, [
            `✅ <b>Buyurtma qabul qilindi</b>`,
            ``,
            `№ <b>${order.orderNumber}</b>`,
            ``,
            lines,
            ``,
            `<b>Jami:</b> ${order.total.toLocaleString()} so'm`,
            `<b>Telefon:</b> ${order.customerPhone}`,
            ``,
            `Tez orada operator bog'lanadi.`,
          ].join("\n"));
        }
      } catch (err) {
        req.log.warn({ err }, "buyurtma tasdiq xabarini yuborib bo'lmadi");
      }

      return reply.code(201).send({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
      });
    });

    // 5. Buyurtma tarixi
    api.get("/orders", async (req) => {
      const { tgUserId } = req.user as unknown as { tgUserId: string };
      const orders = await db.query.orders.findMany({
        where: eq(schema.orders.tgUserId, tgUserId),
        orderBy: [desc(schema.orders.createdAt)],
        limit: 50,
      });
      return orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.total,
        createdAt: o.createdAt,
      }));
    });
  });
}
