// CSV Export — admin panel uchun ma'lumotlarni yuklab olish
// GET /api/export/orders.csv
// GET /api/export/customers.csv
// GET /api/export/products.csv

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n"); // BOM for Excel
}

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // ─── Buyurtmalar CSV ─────────────────────────────────────────────────────
  app.get("/orders.csv", async (req, reply) => {
    const q = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      status: z.string().optional(),
    }).parse(req.query);

    const tenantId = req.session.tenantId;

    const orders = await app.prisma.order.findMany({
      where: {
        tenantId,
        ...(q.status ? { status: q.status as never } : {}),
        ...(q.from || q.to
          ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        items: {
          include: { product: { select: { name: true, sku: true } } },
        },
        promoCode: { select: { code: true } },
      },
      take: 10000,
    });

    const headers = [
      "Buyurtma raqami", "Sana", "Holat", "Jami summa", "Valyuta",
      "Chegirma", "Promo kod",
      "Mijoz ismi", "Telefon", "Email",
      "Manzil", "Mahsulotlar", "Izoh",
    ];

    const rows = orders.map((o) => [
      o.code,
      o.createdAt.toISOString().slice(0, 16).replace("T", " "),
      o.status,
      Number(o.total).toLocaleString("uz-UZ"),
      o.currency,
      o.promoDiscount ? Number(o.promoDiscount).toLocaleString("uz-UZ") : "",
      o.promoCode?.code ?? "",
      o.customer?.name ?? "",
      o.customer?.phone ?? "",
      o.customer?.email ?? "",
      o.shippingAddress ?? "",
      o.items.map((i) => `${i.product.name} x${i.qty}`).join("; "),
      o.notes ?? "",
    ]);

    const csv = toCSV(headers, rows);
    const filename = `orders-${new Date().toISOString().slice(0, 10)}.csv`;

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(csv);
  });

  // ─── Mijozlar CSV ────────────────────────────────────────────────────────
  app.get("/customers.csv", async (req, reply) => {
    const q = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(req.query);

    const tenantId = req.session.tenantId;

    const customers = await app.prisma.customer.findMany({
      where: {
        tenantId,
        ...(q.from || q.to
          ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { orders: true } },
        orders: {
          where: { status: "COMPLETED" },
          select: { total: true },
        },
      },
      take: 50000,
    });

    const headers = [
      "ID", "Ism", "Telefon", "Email", "Tug'ilgan sana", "Til",
      "Telegram username", "Joylashuv",
      "Buyurtmalar soni", "Jami xarid summasi",
      "Ro'yxatdan o'tgan sana",
    ];

    const rows = customers.map((c) => {
      const totalSpent = c.orders.reduce((s, o) => s + Number(o.total), 0);
      return [
        c.id,
        c.name,
        c.phone ?? "",
        c.email ?? "",
        c.birthDate ? c.birthDate.toISOString().slice(0, 10) : "",
        c.language,
        c.telegramUsername ?? "",
        c.location ?? "",
        String(c._count.orders),
        totalSpent.toLocaleString("uz-UZ"),
        c.createdAt.toISOString().slice(0, 16).replace("T", " "),
      ];
    });

    const csv = toCSV(headers, rows);
    const filename = `customers-${new Date().toISOString().slice(0, 10)}.csv`;

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(csv);
  });

  // ─── Mahsulotlar CSV ─────────────────────────────────────────────────────
  app.get("/products.csv", async (req, reply) => {
    const tenantId = req.session.tenantId;

    const products = await app.prisma.product.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: {
        category: { select: { name: true } },
        _count: { select: { orderItems: true } },
      },
      take: 50000,
    });

    const headers = [
      "SKU", "Nomi", "Kategoriya", "Narx", "Eski narx", "Zaxira",
      "Faol", "Tavsiya etilgan", "Sotilgan miqdor", "Izoh",
    ];

    const rows = products.map((p) => [
      p.sku,
      p.name,
      p.category?.name ?? "",
      Number(p.price).toLocaleString("uz-UZ"),
      p.oldPrice ? Number(p.oldPrice).toLocaleString("uz-UZ") : "",
      p.stock != null ? String(p.stock) : "Cheksiz",
      p.active ? "Ha" : "Yo'q",
      p.featured ? "Ha" : "Yo'q",
      String(p._count.orderItems),
      p.description ?? "",
    ]);

    const csv = toCSV(headers, rows);
    const filename = `products-${new Date().toISOString().slice(0, 10)}.csv`;

    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(csv);
  });
};
