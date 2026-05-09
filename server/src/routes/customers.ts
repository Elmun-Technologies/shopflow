import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export default async function customerRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  function shopIdOf(req: { user: unknown }): string {
    const u = req.user as { kind?: string; shopId?: string };
    if (u.kind === "miniapp") throw new Error("Admin token kerak");
    if (!u.shopId) throw new Error("shopId yo'q");
    return u.shopId;
  }

  /** Telegram orqali kelgan mijozlar + ularning xarid statistikasi */
  app.get("/", async (req) => {
    const sid = shopIdOf(req);
    const customers = await db.query.tgUsers.findMany({
      where: eq(schema.tgUsers.shopId, sid),
      orderBy: [desc(schema.tgUsers.createdAt)],
    });

    // Har mijoz uchun buyurtma statistikasi
    const stats = await db.select({
      tgUserId: schema.orders.tgUserId,
      orderCount: sql<number>`count(*)`.as("order_count"),
      totalSpent: sql<number>`coalesce(sum(case when ${schema.orders.status} != 'cancelled' then ${schema.orders.total} else 0 end), 0)`.as("total_spent"),
      lastOrderAt: sql<number | null>`max(${schema.orders.createdAt})`.as("last_order_at"),
    })
      .from(schema.orders)
      .where(eq(schema.orders.shopId, sid))
      .groupBy(schema.orders.tgUserId);

    const statMap = new Map(stats.map((s) => [s.tgUserId, s]));

    return customers.map((c) => {
      const st = statMap.get(c.id);
      return {
        id: c.id,
        tgUserId: c.tgUserId,
        username: c.username,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        languageCode: c.languageCode,
        createdAt: c.createdAt,
        orderCount: st?.orderCount ?? 0,
        totalSpent: st?.totalSpent ?? 0,
        lastOrderAt: st?.lastOrderAt ?? null,
      };
    });
  });

  app.get("/:id", async (req, reply) => {
    const sid = shopIdOf(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const customer = await db.query.tgUsers.findFirst({
      where: and(eq(schema.tgUsers.id, params.id), eq(schema.tgUsers.shopId, sid)),
    });
    if (!customer) return reply.code(404).send({ error: "Mijoz topilmadi" });

    const orders = await db.query.orders.findMany({
      where: eq(schema.orders.tgUserId, params.id),
      orderBy: [desc(schema.orders.createdAt)],
      limit: 50,
    });

    const totalSpent = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);

    return {
      ...customer,
      orderCount: orders.length,
      totalSpent,
      orders,
    };
  });
}
