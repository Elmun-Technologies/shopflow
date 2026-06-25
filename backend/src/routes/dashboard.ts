import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";

// Period → { from, prevFrom, prevTo } tartib bilan qaytaradi
type Period = "today" | "week" | "month" | "year" | "all";

function getPeriodRange(period: Period): { from: Date | null; prevFrom: Date | null; prevTo: Date | null } {
  const now = new Date();
  if (period === "today") {
    const from = new Date(now); from.setHours(0, 0, 0, 0);
    const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - 1);
    const prevTo = new Date(from);
    return { from, prevFrom, prevTo };
  }
  if (period === "week") {
    const from = new Date(now); from.setDate(now.getDate() - 7); from.setHours(0, 0, 0, 0);
    const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - 7);
    const prevTo = new Date(from);
    return { from, prevFrom, prevTo };
  }
  if (period === "month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevTo = new Date(from);
    return { from, prevFrom, prevTo };
  }
  if (period === "year") {
    const from = new Date(now.getFullYear(), 0, 1);
    const prevFrom = new Date(now.getFullYear() - 1, 0, 1);
    const prevTo = new Date(from);
    return { from, prevFrom, prevTo };
  }
  // "all" — barcha vaqt
  return { from: null, prevFrom: null, prevTo: null };
}

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // KPI: Total Revenue, Orders, Customers, Conversion Rate
  // ?period=today|week|month|year|all
  app.get<{ Querystring: { period?: string } }>("/kpis", async (req) => {
    const tenantId = req.session.tenantId;
    const period = (req.query.period ?? "month") as Period;
    const { from, prevFrom, prevTo } = getPeriodRange(period);

    const baseWhere = from ? { gte: from } : undefined;
    const prevWhere = prevFrom ? { gte: prevFrom, lt: prevTo ?? new Date() } : undefined;

    const [revAgg, prevRevAgg, ordersThis, ordersPrev, customers, leadsTotal, leadsWon, cancelledOrders] =
      await Promise.all([
        app.prisma.order.aggregate({
          where: { tenantId, status: "COMPLETED", ...(baseWhere ? { createdAt: baseWhere } : {}) },
          _sum: { total: true },
        }),
        app.prisma.order.aggregate({
          where: { tenantId, status: "COMPLETED", ...(prevWhere ? { createdAt: prevWhere } : { id: "never" }) },
          _sum: { total: true },
        }),
        app.prisma.order.count({
          where: { tenantId, ...(baseWhere ? { createdAt: baseWhere } : {}) },
        }),
        app.prisma.order.count({
          where: { tenantId, ...(prevWhere ? { createdAt: prevWhere } : { id: "never" }) },
        }),
        app.prisma.customer.count({ where: { tenantId, ...(baseWhere ? { createdAt: baseWhere } : {}) } }),
        app.prisma.lead.count({ where: { tenantId, ...(baseWhere ? { createdAt: baseWhere } : {}) } }),
        app.prisma.lead.count({ where: { tenantId, status: "WON", ...(baseWhere ? { createdAt: baseWhere } : {}) } }),
        app.prisma.order.count({ where: { tenantId, status: "CANCELLED", ...(baseWhere ? { createdAt: baseWhere } : {}) } }),
      ]);

    const revenue = Number(revAgg._sum.total ?? 0);
    const prevRevenue = Number(prevRevAgg._sum.total ?? 0);
    const revChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange = ordersPrev > 0 ? ((ordersThis - ordersPrev) / ordersPrev) * 100 : 0;
    const conversion = leadsTotal > 0 ? (leadsWon / leadsTotal) * 100 : 0;
    const returnRate = ordersThis > 0 ? (cancelledOrders / ordersThis) * 100 : 0;
    const avgOrder = ordersThis > 0 ? revenue / ordersThis : 0;

    return {
      revenue: { value: revenue, change: revChange },
      orders: { value: ordersThis, change: ordersChange },
      customers: { value: customers, change: 0 },
      conversion: { value: conversion, change: 0 },
      returnRate: { value: returnRate, change: 0 },
      avgOrder: { value: avgOrder, change: 0 },
    };
  });

  // Revenue trend — oxirgi 12 oy
  // Avval har oy uchun alohida aggregate (12 query) edi → bitta GROUP BY query.
  app.get("/revenue-trend", async (req) => {
    const tenantId = req.session.tenantId;
    const now = new Date();
    // Eng eski bucket boshi — oraliq filtri uchun (12 oy oldingi oyning 1-sanasi)
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // bucket = 'YYYY-MM' (UTC) — JS bucket kaliti bilan mos (start.toISOString().slice(0,7))
    const rows = await app.prisma.$queryRaw<{ bucket: string; revenue: Prisma.Decimal | null; orders: bigint }[]>`
      SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM') AS bucket,
             SUM("total") AS revenue,
             COUNT(*) AS orders
      FROM "Order"
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'COMPLETED'::"OrderStatus"
        AND "createdAt" >= ${rangeStart}
      GROUP BY bucket
    `;
    const byBucket = new Map(rows.map((r) => [r.bucket, r]));

    const months: { month: string; revenue: number; orders: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = start.toISOString().slice(0, 7); // 'YYYY-MM'
      const row = byBucket.get(key);
      months.push({
        month: start.toLocaleString("en-US", { month: "short" }),
        revenue: Number(row?.revenue ?? 0),
        orders: Number(row?.orders ?? 0),
      });
    }
    return months;
  });

  // Weekly sales — oxirgi 7 kun
  // Avval har kun uchun alohida aggregate (7 query) edi → bitta GROUP BY query.
  app.get("/weekly-sales", async (req) => {
    const tenantId = req.session.tenantId;
    const now = new Date();
    // Eng eski bucket boshi (6 kun oldingi yarim tunni) — oraliq filtri uchun
    const rangeStart = new Date(now);
    rangeStart.setDate(now.getDate() - 6);
    rangeStart.setHours(0, 0, 0, 0);

    // bucket = 'YYYY-MM-DD' (UTC) — JS bucket kaliti bilan mos (start.toISOString().slice(0,10))
    const rows = await app.prisma.$queryRaw<{ bucket: string; sales: Prisma.Decimal | null }[]>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS bucket,
             SUM("total") AS sales
      FROM "Order"
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'COMPLETED'::"OrderStatus"
        AND "createdAt" >= ${rangeStart}
      GROUP BY bucket
    `;
    const byBucket = new Map(rows.map((r) => [r.bucket, r]));

    const days: { day: string; sales: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const key = start.toISOString().slice(0, 10); // 'YYYY-MM-DD'
      days.push({
        day: start.toLocaleDateString("en-US", { weekday: "short" }),
        sales: Number(byBucket.get(key)?.sales ?? 0),
      });
    }
    return days;
  });

  // Top products
  // ?period=today|week|month|year|all
  app.get<{ Querystring: { period?: string } }>("/top-products", async (req) => {
    const tenantId = req.session.tenantId;
    const { from } = getPeriodRange((req.query.period ?? "all") as Period);
    const items = await app.prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { tenantId, status: "COMPLETED", ...(from ? { createdAt: { gte: from } } : {}) } },
      _sum: { qty: true },
      orderBy: { _sum: { qty: "desc" } },
      take: 5,
    });
    const products = await app.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      include: { category: { select: { name: true } } },
    });
    return items.map((i) => {
      const p = products.find((p) => p.id === i.productId);
      return {
        id: p?.id,
        name: p?.name ?? "Unknown",
        category: p?.category?.name ?? null,
        price: Number(p?.price ?? 0),
        sold: i._sum.qty ?? 0,
        stock: p?.stock ?? 0,
      };
    });
  });

  // Traffic sources — orders by channel
  // ?period=today|week|month|year|all
  app.get<{ Querystring: { period?: string } }>("/traffic-sources", async (req) => {
    const tenantId = req.session.tenantId;
    const { from } = getPeriodRange((req.query.period ?? "all") as Period);
    const grouped = await app.prisma.order.groupBy({
      by: ["channelId"],
      where: { tenantId, ...(from ? { createdAt: { gte: from } } : {}) },
      _count: true,
    });
    const total = grouped.reduce((s, g) => s + g._count, 0);
    const channelIds = grouped.map((g) => g.channelId).filter((id): id is string => !!id);
    const channels = await app.prisma.channel.findMany({
      where: { id: { in: channelIds } },
      select: { id: true, name: true, type: true },
    });

    return grouped.map((g) => {
      const ch = channels.find((c) => c.id === g.channelId);
      return {
        channelId: g.channelId,
        source: ch?.name ?? "Other",
        type: ch?.type ?? null,
        visitors: g._count,
        percentage: total > 0 ? Math.round((g._count / total) * 100) : 0,
      };
    });
  });

  // Sales by category
  // ?period=today|week|month|year|all
  app.get<{ Querystring: { period?: string } }>("/sales-by-category", async (req) => {
    const tenantId = req.session.tenantId;
    const { from } = getPeriodRange((req.query.period ?? "all") as Period);
    // Avval barcha order qatorlari xotiraga yuklanardi → SQL'da kategoriya bo'yicha jamlash.
    // price * qty butun OrderItem jadvalida agregatlanadi (DB tomonda).
    const dateFilter = from ? Prisma.sql`AND o."createdAt" >= ${from}` : Prisma.empty;
    const rows = await app.prisma.$queryRaw<{ name: string; sales: Prisma.Decimal | null }[]>`
      SELECT COALESCE(c."name", 'Other') AS name,
             SUM(oi."price" * oi."qty") AS sales
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Product" p ON p."id" = oi."productId"
      LEFT JOIN "Category" c ON c."id" = p."categoryId"
      WHERE o."tenantId" = ${tenantId}
        AND o."status" = 'COMPLETED'::"OrderStatus"
        ${dateFilter}
      GROUP BY COALESCE(c."name", 'Other')
      ORDER BY sales DESC
    `;
    const arr = rows.map((r) => ({ name: r.name, sales: Number(r.sales ?? 0) }));
    const total = arr.reduce((s, c) => s + c.sales, 0);
    return arr.map((c) => ({
      name: c.name,
      sales: c.sales,
      value: total > 0 ? Math.round((c.sales / total) * 100) : 0,
    }));
  });

  // Recent orders
  app.get("/recent-orders", async (req) => {
    return app.prisma.order.findMany({
      where: { tenantId: req.session.tenantId },
      include: {
        customer: { select: { name: true, email: true } },
        items: {
          take: 1,
          include: { product: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
  });

  // Daily sales — oxirgi 30 kun (Analytics line chart uchun)
  app.get<{ Querystring: { days?: string } }>("/daily-sales", async (req) => {
    const tenantId = req.session.tenantId;
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 90);
    const now = new Date();

    // Eng eski bucket boshi (days-1 kun oldingi yarim tun) — oraliq filtri uchun
    const rangeStart = new Date(now);
    rangeStart.setDate(now.getDate() - (days - 1));
    rangeStart.setHours(0, 0, 0, 0);

    // Avval har kun uchun alohida aggregate (90 tagacha query) edi → bitta GROUP BY query.
    // bucket = 'YYYY-MM-DD' (UTC) — JS `date` maydoni bilan mos (start.toISOString().slice(0,10))
    const rows = await app.prisma.$queryRaw<{ bucket: string; sales: Prisma.Decimal | null; orders: bigint }[]>`
      SELECT to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS bucket,
             SUM("total") AS sales,
             COUNT(*) AS orders
      FROM "Order"
      WHERE "tenantId" = ${tenantId}
        AND "status" = 'COMPLETED'::"OrderStatus"
        AND "createdAt" >= ${rangeStart}
      GROUP BY bucket
    `;
    const byBucket = new Map(rows.map((r) => [r.bucket, r]));

    const result: { day: string; date: string; sales: number; orders: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const key = start.toISOString().slice(0, 10); // 'YYYY-MM-DD'
      const row = byBucket.get(key);
      result.push({
        day: start.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" }),
        date: key,
        sales: Number(row?.sales ?? 0),
        orders: Number(row?.orders ?? 0),
      });
    }
    return result;
  });

  // Geography — mijozlar joylashuvi bo'yicha buyurtmalar
  // ?period=today|week|month|year|all
  app.get<{ Querystring: { period?: string } }>("/geography", async (req) => {
    const tenantId = req.session.tenantId;
    const { from } = getPeriodRange((req.query.period ?? "all") as Period);
    // Order.shippingAddress yo'q bo'lsa Customer.location ishlatamiz
    const orders = await app.prisma.order.findMany({
      where: { tenantId, status: "COMPLETED", ...(from ? { createdAt: { gte: from } } : {}) },
      select: {
        total: true,
        shippingAddress: true,
        customer: { select: { location: true } },
      },
      take: 5000,
    });
    const byCity = new Map<string, { name: string; orders: number; revenue: number }>();
    for (const o of orders) {
      const city = (o.shippingAddress?.split(",")[0] || o.customer?.location || "Boshqalar").trim();
      const prev = byCity.get(city) ?? { name: city, orders: 0, revenue: 0 };
      prev.orders += 1;
      prev.revenue += Number(o.total);
      byCity.set(city, prev);
    }
    return [...byCity.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  });

  // Conversion funnel — storefront → buyurtma → yakuniylash
  // ?period=today|week|month|year|all
  app.get<{ Querystring: { period?: string } }>("/funnel", async (req) => {
    const tenantId = req.session.tenantId;
    const { from } = getPeriodRange((req.query.period ?? "month") as Period);
    const since = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [customers, ordersTotal, ordersCompleted, abandoned] = await Promise.all([
      app.prisma.customer.count({ where: { tenantId, createdAt: { gte: since } } }),
      app.prisma.order.count({ where: { tenantId, createdAt: { gte: since } } }),
      app.prisma.order.count({ where: { tenantId, createdAt: { gte: since }, status: "COMPLETED" } }),
      app.prisma.abandonedCart.count({ where: { tenantId, createdAt: { gte: since } } }),
    ]);
    const visitors = customers + abandoned; // taxminiy "engaged" foydalanuvchi
    return [
      { stage: "Tashrif buyurganlar", count: Math.max(visitors, ordersTotal), dropOff: 0 },
      { stage: "Savatga qo'shdi", count: ordersTotal + abandoned, dropOff: visitors - (ordersTotal + abandoned) },
      { stage: "Buyurtma berdi", count: ordersTotal, dropOff: abandoned },
      { stage: "Yakunlandi", count: ordersCompleted, dropOff: ordersTotal - ordersCompleted },
    ].map((s) => ({ ...s, dropOff: Math.max(0, s.dropOff) }));
  });

  // Customer segments — RFM-light (xarid soni va summasiga ko'ra)
  // Avval har bir mijoz + uning BARCHA buyurtmalari xotiraga yuklanardi →
  // SQL'da har mijoz uchun ixcham agregat (count/sum/max), keyin JS'da bucketing.
  app.get("/customer-segments", async (req) => {
    const tenantId = req.session.tenantId;
    // COMPLETED buyurtmalar bo'yicha LEFT JOIN — buyurtmasiz mijozlar ham (orderCount=0) qoladi.
    const rows = await app.prisma.$queryRaw<
      { orderCount: bigint; totalSpent: Prisma.Decimal | null; lastOrderAt: Date | null }[]
    >`
      SELECT COUNT(o."id") AS "orderCount",
             SUM(o."total") AS "totalSpent",
             MAX(o."createdAt") AS "lastOrderAt"
      FROM "Customer" c
      LEFT JOIN "Order" o
        ON o."customerId" = c."id"
       AND o."tenantId" = ${tenantId}
       AND o."status" = 'COMPLETED'::"OrderStatus"
      WHERE c."tenantId" = ${tenantId}
      GROUP BY c."id"
    `;
    let vip = 0, regular = 0, occasional = 0, lapsed = 0, newC = 0;
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
    for (const c of rows) {
      const orderCount = Number(c.orderCount);
      const totalSpent = Number(c.totalSpent ?? 0);
      const lastOrderTs = c.lastOrderAt ? c.lastOrderAt.getTime() : null;
      if (orderCount === 0) {
        newC++;
      } else if (lastOrderTs && lastOrderTs < sixMonthsAgo) {
        lapsed++;
      } else if (orderCount >= 5 || totalSpent > 5_000_000) {
        vip++;
      } else if (orderCount >= 2 && lastOrderTs && lastOrderTs > monthAgo) {
        regular++;
      } else {
        occasional++;
      }
    }
    return [
      { name: "VIP", count: vip, color: "#10b981" },
      { name: "Doimiy", count: regular, color: "#3b82f6" },
      { name: "Ba'zi-ba'zida", count: occasional, color: "#f59e0b" },
      { name: "Yangi", count: newC, color: "#8b5cf6" },
      { name: "Faolligini yo'qotgan", count: lapsed, color: "#ef4444" },
    ];
  });

  // Sidebar badge'lari — operator nimani ko'rishi kerakligini bir qarashda biladi
  // Bitta endpoint, hammasi parallel — bir nechta query'ni bittaga jamlaymiz
  app.get("/sidebar-counts", async (req) => {
    const tenantId = req.session.tenantId;
    const [pendingOrders, newLeads, activeChats, unreadMessages, abandonedCarts] = await Promise.all([
      app.prisma.order.count({ where: { tenantId, status: "PENDING" } }),
      app.prisma.lead.count({ where: { tenantId, status: "NEW" } }),
      app.prisma.conversation.count({ where: { tenantId, status: "ACTIVE" } }),
      app.prisma.conversationMessage.count({
        where: { conversation: { tenantId }, direction: "INBOUND", read: false },
      }),
      app.prisma.abandonedCart.count({
        where: { tenantId, remindersSent: { lt: 1 } },
      }),
    ]);
    return {
      orders: pendingOrders,     // PENDING — admin javob kutmoqda
      leads: newLeads,           // NEW — yangi mijozlar
      chat: unreadMessages,      // o'qilmagan xabarlar
      conversationsActive: activeChats,
      abandonedCarts,
    };
  });
};
