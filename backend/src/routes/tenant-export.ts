// Tenant data export — admin'ga o'z do'koni ma'lumotlarini JSON sifatida
// yuklab olish imkonini beradi (GDPR-uslubi, backup, migratsiya).
// Faqat OWNER/ADMIN, faqat o'z tenant'i.

import type { FastifyPluginAsync, FastifyRequest } from "fastify";

export const tenantExportRoutes: FastifyPluginAsync = async (app) => {
  // <a download> link Authorization header yubora olmaydi — token query'dan ham qabul
  app.addHook("preHandler", async (req: FastifyRequest) => {
    const q = req.query as { token?: string } | undefined;
    if (q?.token && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${q.token}`;
    }
  });
  app.addHook("preHandler", app.authenticate);

  app.get("/", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const tenantId = req.session.tenantId;
    const [tenant, customers, products, categories, orders, leads, channels] = await Promise.all([
      app.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, slug: true, name: true, currency: true, timezone: true, locale: true, createdAt: true },
      }),
      app.prisma.customer.findMany({
        where: { tenantId },
        select: {
          id: true, name: true, email: true, phone: true, location: true, notes: true,
          tags: true, telegramUserId: true, createdAt: true,
        },
      }),
      app.prisma.product.findMany({
        where: { tenantId },
        select: {
          id: true, sku: true, name: true, description: true, price: true, oldPrice: true,
          currency: true, stock: true, active: true, featured: true, imageUrl: true,
          images: true, categoryId: true, createdAt: true,
        },
      }),
      app.prisma.category.findMany({
        where: { tenantId },
        select: { id: true, name: true, slug: true, parentId: true, createdAt: true },
      }),
      app.prisma.order.findMany({
        where: { tenantId },
        select: {
          id: true, code: true, status: true, total: true, currency: true, notes: true,
          shippingAddress: true, customerId: true, channelId: true, paid: true, paidAt: true,
          createdAt: true,
          items: { select: { productId: true, qty: true, price: true } },
        },
      }),
      app.prisma.lead.findMany({
        where: { tenantId },
        select: {
          id: true, code: true, name: true, phone: true, email: true, company: true,
          status: true, priority: true, value: true, currency: true, notes: true,
          createdAt: true,
        },
      }),
      app.prisma.channel.findMany({
        where: { tenantId },
        select: { id: true, type: true, name: true, active: true, createdAt: true },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: 1,
      tenant,
      stats: {
        customers: customers.length,
        products: products.length,
        categories: categories.length,
        orders: orders.length,
        leads: leads.length,
        channels: channels.length,
      },
      customers: customers.map((c) => ({ ...c, telegramUserId: c.telegramUserId?.toString() ?? null })),
      products,
      categories,
      orders,
      leads,
      channels,
    };

    // JSON faylga yuklab olish uchun Content-Disposition
    const date = new Date().toISOString().slice(0, 10);
    const slug = tenant?.slug ?? "shopflow";
    reply.header("Content-Type", "application/json; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="${slug}-export-${date}.json"`);
    return exportData;
  });
};
