import type { FastifyPluginAsync } from "fastify";

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // KPI: Total Revenue, Orders, Customers, Conversion Rate
  app.get("/kpis", async (req) => {
    const tenantId = req.session.tenantId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [revAgg, prevRevAgg, ordersThis, ordersPrev, customers, leadsTotal, leadsWon] =
      await Promise.all([
        app.prisma.order.aggregate({
          where: { tenantId, status: "COMPLETED", createdAt: { gte: monthStart } },
          _sum: { total: true },
        }),
        app.prisma.order.aggregate({
          where: {
            tenantId,
            status: "COMPLETED",
            createdAt: { gte: prevMonthStart, lt: monthStart },
          },
          _sum: { total: true },
        }),
        app.prisma.order.count({
          where: { tenantId, createdAt: { gte: monthStart } },
        }),
        app.prisma.order.count({
          where: { tenantId, createdAt: { gte: prevMonthStart, lt: monthStart } },
        }),
        app.prisma.customer.count({ where: { tenantId } }),
        app.prisma.lead.count({ where: { tenantId } }),
        app.prisma.lead.count({ where: { tenantId, status: "WON" } }),
      ]);

    const revenue = Number(revAgg._sum.total ?? 0);
    const prevRevenue = Number(prevRevAgg._sum.total ?? 0);
    const revChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
    const ordersChange = ordersPrev > 0 ? ((ordersThis - ordersPrev) / ordersPrev) * 100 : 0;
    const conversion = leadsTotal > 0 ? (leadsWon / leadsTotal) * 100 : 0;

    return {
      revenue: { value: revenue, change: revChange },
      orders: { value: ordersThis, change: ordersChange },
      customers: { value: customers, change: 0 },
      conversion: { value: conversion, change: 0 },
    };
  });

  // Revenue trend — oxirgi 12 oy
  app.get("/revenue-trend", async (req) => {
    const tenantId = req.session.tenantId;
    const now = new Date();
    const months: { month: string; revenue: number; orders: number }[] = [];

    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const agg = await app.prisma.order.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: start, lt: end },
        },
        _sum: { total: true },
        _count: true,
      });
      months.push({
        month: start.toLocaleString("en-US", { month: "short" }),
        revenue: Number(agg._sum.total ?? 0),
        orders: agg._count,
      });
    }
    return months;
  });

  // Weekly sales — oxirgi 7 kun
  app.get("/weekly-sales", async (req) => {
    const tenantId = req.session.tenantId;
    const now = new Date();
    const days: { day: string; sales: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      const agg = await app.prisma.order.aggregate({
        where: {
          tenantId,
          status: "COMPLETED",
          createdAt: { gte: start, lt: end },
        },
        _sum: { total: true },
      });
      days.push({
        day: start.toLocaleDateString("en-US", { weekday: "short" }),
        sales: Number(agg._sum.total ?? 0),
      });
    }
    return days;
  });

  // Top products
  app.get("/top-products", async (req) => {
    const tenantId = req.session.tenantId;
    const items = await app.prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { tenantId, status: "COMPLETED" } },
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
  app.get("/traffic-sources", async (req) => {
    const tenantId = req.session.tenantId;
    const grouped = await app.prisma.order.groupBy({
      by: ["channelId"],
      where: { tenantId },
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
  app.get("/sales-by-category", async (req) => {
    const tenantId = req.session.tenantId;
    const items = await app.prisma.orderItem.findMany({
      where: { order: { tenantId, status: "COMPLETED" } },
      include: { product: { include: { category: true } } },
    });
    const byCat = new Map<string, { name: string; sales: number }>();
    for (const item of items) {
      const cat = item.product.category?.name ?? "Other";
      const prev = byCat.get(cat) ?? { name: cat, sales: 0 };
      prev.sales += Number(item.price) * item.qty;
      byCat.set(cat, prev);
    }
    const arr = [...byCat.values()];
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
