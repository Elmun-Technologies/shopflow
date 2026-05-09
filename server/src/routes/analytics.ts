import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export default async function analyticsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  function shopIdOf(req: { user: unknown }): string {
    const u = req.user as { kind?: string; shopId?: string };
    if (u.kind === "miniapp") throw new Error("Admin token kerak");
    if (!u.shopId) throw new Error("shopId yo'q");
    return u.shopId;
  }

  /** Asosiy KPI: bugun, hafta, oy uchun buyurtmalar, tushum, mijozlar */
  app.get("/dashboard", async (req) => {
    const sid = shopIdOf(req);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const weekMs = todayMs - 6 * dayMs;
    const monthMs = todayMs - 29 * dayMs;
    const yesterdayMs = todayMs - dayMs;

    const ordersAll = await db.query.orders.findMany({ where: eq(schema.orders.shopId, sid) });

    const revenue = (orders: typeof ordersAll, fromTs: number, toTs?: number) =>
      orders.filter((o) => {
        const t = new Date(o.createdAt as Date | number).getTime();
        return t >= fromTs && (toTs ? t < toTs : true) && o.status !== "cancelled";
      }).reduce((s, o) => s + o.total, 0);

    const count = (orders: typeof ordersAll, fromTs: number, toTs?: number) =>
      orders.filter((o) => {
        const t = new Date(o.createdAt as Date | number).getTime();
        return t >= fromTs && (toTs ? t < toTs : true);
      }).length;

    const customersAll = await db.query.tgUsers.findMany({ where: eq(schema.tgUsers.shopId, sid) });
    const newCustomersToday = customersAll.filter((c) => new Date(c.createdAt as Date | number).getTime() >= todayMs).length;
    const newCustomersWeek = customersAll.filter((c) => new Date(c.createdAt as Date | number).getTime() >= weekMs).length;

    const todayRevenue = revenue(ordersAll, todayMs);
    const yesterdayRevenue = revenue(ordersAll, yesterdayMs, todayMs);
    const weekRevenue = revenue(ordersAll, weekMs);
    const monthRevenue = revenue(ordersAll, monthMs);

    const todayOrders = count(ordersAll, todayMs);
    const weekOrders = count(ordersAll, weekMs);
    const monthOrders = count(ordersAll, monthMs);

    const productsAll = await db.query.products.findMany({ where: eq(schema.products.shopId, sid) });
    const lowStock = productsAll.filter((p) => p.stock > 0 && p.stock <= 5).length;
    const outOfStock = productsAll.filter((p) => p.stock === 0).length;

    return {
      revenue: {
        today: todayRevenue,
        yesterday: yesterdayRevenue,
        week: weekRevenue,
        month: monthRevenue,
        deltaPct: yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0,
      },
      orders: {
        today: todayOrders,
        week: weekOrders,
        month: monthOrders,
        total: ordersAll.length,
        pending: ordersAll.filter((o) => o.status === "pending").length,
      },
      customers: {
        total: customersAll.length,
        newToday: newCustomersToday,
        newWeek: newCustomersWeek,
      },
      products: {
        total: productsAll.length,
        lowStock,
        outOfStock,
      },
      generatedAt: now,
    };
  });

  /** Daromad chart — kunlar bo'yicha (default 30 kun) */
  app.get("/revenue", async (req) => {
    const sid = shopIdOf(req);
    const query = z.object({
      days: z.coerce.number().int().min(1).max(365).default(30),
    }).parse(req.query);

    const fromTs = Date.now() - query.days * 24 * 60 * 60 * 1000;
    const orders = await db.query.orders.findMany({
      where: and(eq(schema.orders.shopId, sid), gte(schema.orders.createdAt, new Date(fromTs))),
    });

    // Kun bo'yicha guruhlash
    const buckets = new Map<string, { revenue: number; orders: number }>();
    for (let i = 0; i < query.days; i++) {
      const d = new Date(fromTs + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { revenue: 0, orders: 0 });
    }
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const key = new Date(o.createdAt as Date | number).toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b) { b.revenue += o.total; b.orders += 1; }
    }
    return Array.from(buckets.entries()).map(([date, b]) => ({ date, revenue: b.revenue, orders: b.orders }));
  });

  /** Eng ko'p sotilgan mahsulotlar */
  app.get("/top-products", async (req) => {
    const sid = shopIdOf(req);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(req.query);

    const rows = await db.select({
      productId: schema.orderItems.productId,
      productName: schema.orderItems.productName,
      totalSold: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)`.as("total_sold"),
      totalRevenue: sql<number>`coalesce(sum(${schema.orderItems.total}), 0)`.as("total_revenue"),
      orderCount: sql<number>`count(distinct ${schema.orderItems.orderId})`.as("order_count"),
    })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .where(and(eq(schema.orders.shopId, sid), sql`${schema.orders.status} != 'cancelled'`))
      .groupBy(schema.orderItems.productId, schema.orderItems.productName)
      .orderBy(desc(sql`total_revenue`))
      .limit(query.limit);

    return rows;
  });

  /** Buyurtma manbalari (Mini App vs bot vs admin) */
  app.get("/sources", async (req) => {
    const sid = shopIdOf(req);
    const rows = await db.select({
      source: schema.orders.source,
      count: sql<number>`count(*)`.as("count"),
      revenue: sql<number>`coalesce(sum(${schema.orders.total}), 0)`.as("revenue"),
    })
      .from(schema.orders)
      .where(and(eq(schema.orders.shopId, sid), sql`${schema.orders.status} != 'cancelled'`))
      .groupBy(schema.orders.source);
    return rows;
  });

  /** So'nggi buyurtmalar widget uchun */
  app.get("/recent-orders", async (req) => {
    const sid = shopIdOf(req);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }).parse(req.query);
    const orders = await db.query.orders.findMany({
      where: eq(schema.orders.shopId, sid),
      orderBy: [desc(schema.orders.createdAt)],
      limit: query.limit,
    });
    // Mijoz nomini qo'shamiz
    const tgUserIds = orders.map((o) => o.tgUserId).filter((x): x is string => !!x);
    const customers = tgUserIds.length > 0
      ? await db.query.tgUsers.findMany({ where: sql`${schema.tgUsers.id} IN (${sql.raw(tgUserIds.map((id) => `'${id}'`).join(","))})` })
      : [];
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    return orders.map((o) => {
      const c = o.tgUserId ? customerMap.get(o.tgUserId) : null;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.total,
        createdAt: o.createdAt,
        customerName: c ? [c.firstName, c.lastName].filter(Boolean).join(" ") || c.username || "Mehmon" : "Mehmon",
        customerPhone: o.customerPhone,
      };
    });
  });

  /** Stock past mahsulotlar */
  app.get("/low-stock", async (req) => {
    const sid = shopIdOf(req);
    const products = await db.query.products.findMany({
      where: and(eq(schema.products.shopId, sid), sql`${schema.products.stock} <= 5`),
      orderBy: [schema.products.stock],
    });
    return products;
  });

  /** Hafta bo'yicha sotuv (Mon-Sun) — oxirgi 7 kun */
  app.get("/weekly-sales", async (req) => {
    const sid = shopIdOf(req);
    const fromTs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const orders = await db.query.orders.findMany({
      where: and(eq(schema.orders.shopId, sid), gte(schema.orders.createdAt, new Date(fromTs)), sql`${schema.orders.status} != 'cancelled'`),
    });
    const dayLabels = ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];
    const buckets = new Map<number, { revenue: number; orders: number }>();
    for (let i = 0; i < 7; i++) buckets.set(i, { revenue: 0, orders: 0 });
    for (const o of orders) {
      const d = new Date(o.createdAt as Date | number).getDay();
      const b = buckets.get(d);
      if (b) { b.revenue += o.total; b.orders += 1; }
    }
    return dayLabels.map((label, i) => ({ day: label, ...buckets.get(i)! }));
  });

  /** Sotuv kategoriya bo'yicha */
  app.get("/sales-by-category", async (req) => {
    const sid = shopIdOf(req);
    const rows = await db.select({
      categoryId: schema.products.categoryId,
      revenue: sql<number>`coalesce(sum(${schema.orderItems.total}), 0)`.as("revenue"),
      orderCount: sql<number>`count(distinct ${schema.orderItems.orderId})`.as("order_count"),
      itemsSold: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)`.as("items_sold"),
    })
      .from(schema.orderItems)
      .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
      .innerJoin(schema.products, eq(schema.orderItems.productId, schema.products.id))
      .where(and(eq(schema.orders.shopId, sid), sql`${schema.orders.status} != 'cancelled'`))
      .groupBy(schema.products.categoryId);

    const cats = await db.query.categories.findMany({ where: eq(schema.categories.shopId, sid) });
    const catMap = new Map(cats.map((c) => [c.id, c.name]));
    return rows.map((r) => ({
      categoryId: r.categoryId,
      categoryName: r.categoryId ? catMap.get(r.categoryId) ?? "Kategoriyasiz" : "Kategoriyasiz",
      revenue: r.revenue,
      orderCount: r.orderCount,
      itemsSold: r.itemsSold,
    }));
  });

  /** Trafik manbai — bot/mini app/admin va shu paytdagi customers */
  app.get("/traffic", async (req) => {
    const sid = shopIdOf(req);
    const orders = await db.query.orders.findMany({ where: eq(schema.orders.shopId, sid) });
    const customers = await db.query.tgUsers.findMany({ where: eq(schema.tgUsers.shopId, sid) });
    const sourceLabels: Record<string, string> = {
      miniapp: "Mini App",
      telegram: "Telegram menyu",
      admin: "Admin qo'lda",
    };
    const grouped = new Map<string, { orders: number; revenue: number; customers: Set<string> }>();
    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const key = o.source;
      let g = grouped.get(key);
      if (!g) { g = { orders: 0, revenue: 0, customers: new Set() }; grouped.set(key, g); }
      g.orders++;
      g.revenue += o.total;
      if (o.tgUserId) g.customers.add(o.tgUserId);
    }
    const results = Array.from(grouped.entries()).map(([source, g]) => ({
      source,
      label: sourceLabels[source] ?? source,
      orders: g.orders,
      revenue: g.revenue,
      customers: g.customers.size,
    }));
    if (results.length === 0) {
      return [{ source: "telegram", label: "Telegram", orders: 0, revenue: 0, customers: customers.length }];
    }
    return results;
  });
}
