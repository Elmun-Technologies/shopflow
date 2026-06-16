// Public API v1 — tashqi mijoz websaytlari uchun.
// Auth: `Authorization: Bearer sf_...` (API kalit → tenant).
// Kontrakt: docs/PUBLIC_API.md. Shakllar: lib/public-shape.ts.
//
// Endpointlar:
//   GET  /categories
//   GET  /products
//   GET  /products/:slug
//   GET  /products/:productId/upsells
//   GET  /promotions
//   POST /orders

import type { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  shapeProduct,
  shapeCategory,
  buildFreeShippingPromotion,
  upsellReason,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  type Locale,
  type ShapedReview,
  type RawProductForShape,
} from "../lib/public-shape.js";
import { fireWebhookEvent } from "../lib/outbound-webhook.js";
import { publishToTenant } from "../lib/sse-bus.js";
import { pushToTenantAdmins } from "../lib/web-push.js";
import { grantOrderPoints } from "./loyalty.js";
import { pushOrderToSalesDoctor } from "../lib/salesdoctor-push.js";

// Shaping uchun mahsulot bilan birga kerakli relation'lar.
const PRODUCT_INCLUDE = {
  category: { select: { id: true, slug: true } },
  saleCampaign: { select: { label: true, active: true, startsAt: true, endsAt: true } },
} as const;

const localeQuery = z.object({
  locale: z.string().optional(),
});

function parseLocale(raw: string | undefined): Locale {
  if (raw && (SUPPORTED_LOCALES as string[]).includes(raw)) return raw as Locale;
  return DEFAULT_LOCALE;
}

// Bir nechta mahsulot uchun rating o'rtacha + son (faqat APPROVED sharhlar).
async function ratingMapFor(
  prisma: PrismaClient,
  tenantId: string,
  productIds: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  const map = new Map<string, { avg: number; count: number }>();
  if (productIds.length === 0) return map;
  const aggregates = await prisma.review.groupBy({
    by: ["productId"],
    where: { tenantId, status: "APPROVED", productId: { in: productIds } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const r of aggregates) {
    map.set(r.productId, { avg: r._avg.rating ?? 0, count: r._count._all });
  }
  return map;
}

const CACHE_300 = "public, max-age=300, stale-while-revalidate=60";

export const publicApiRoutes: FastifyPluginAsync = async (app) => {
  // Barcha v1 endpointlar API kalit talab qiladi.
  app.addHook("preHandler", app.authenticateApiKey);

  // ─────────────────────────── GET /categories ───────────────────────────
  app.get("/categories", async (req, reply) => {
    const { locale } = localeQuery.parse(req.query);
    const loc = parseLocale(locale);
    const tenantId = req.apiAuth.tenantId;

    const [categories, counts] = await Promise.all([
      app.prisma.category.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
        select: { id: true, slug: true, name: true, imageUrl: true },
      }),
      app.prisma.product.groupBy({
        by: ["categoryId"],
        where: { tenantId, active: true, categoryId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const countMap = new Map<string, number>();
    for (const c of counts) if (c.categoryId) countMap.set(c.categoryId, c._count._all);

    reply.header("Cache-Control", CACHE_300);
    return categories.map((c) => shapeCategory(c, countMap.get(c.id) ?? 0, loc));
  });

  // ──────────────────────────── GET /products ────────────────────────────
  const productsQuery = z.object({
    locale: z.string().optional(),
    category: z.string().optional(), // category SLUG
    search: z.string().max(100).optional(),
    origin: z.string().max(60).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sort: z.enum(["popular", "price_asc", "price_desc", "new"]).default("popular"),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  });

  app.get("/products", async (req, reply) => {
    const q = productsQuery.parse(req.query);
    const loc = parseLocale(q.locale);
    const tenantId = req.apiAuth.tenantId;

    // Kategoriya slug → id
    let categoryId: string | undefined;
    if (q.category) {
      const cat = await app.prisma.category.findFirst({
        where: { tenantId, slug: q.category },
        select: { id: true },
      });
      if (!cat) {
        // Mavjud bo'lmagan kategoriya — bo'sh natija (xato emas).
        reply.header("Cache-Control", CACHE_300);
        return { items: [], total: 0, page: q.page, pageSize: q.pageSize };
      }
      categoryId = cat.id;
    }

    const priceFilter =
      q.minPrice != null || q.maxPrice != null
        ? { price: { ...(q.minPrice != null ? { gte: q.minPrice } : {}), ...(q.maxPrice != null ? { lte: q.maxPrice } : {}) } }
        : {};

    const where = {
      tenantId,
      active: true,
      ...(categoryId ? { categoryId } : {}),
      ...(q.origin ? { origin: { equals: q.origin, mode: "insensitive" as const } } : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
      ...priceFilter,
    };

    const orderBy =
      q.sort === "price_asc"
        ? [{ price: "asc" as const }]
        : q.sort === "price_desc"
          ? [{ price: "desc" as const }]
          : q.sort === "new"
            ? [{ createdAt: "desc" as const }]
            : [{ featured: "desc" as const }, { createdAt: "desc" as const }]; // popular (proxy)

    const [total, products] = await Promise.all([
      app.prisma.product.count({ where }),
      app.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);

    const ratings = await ratingMapFor(app.prisma, tenantId, products.map((p) => p.id));
    const items = products.map((p) => {
      const r = ratings.get(p.id);
      return shapeProduct(p as unknown as RawProductForShape, {
        locale: loc,
        rating: r?.avg ?? 0,
        reviewCount: r?.count ?? 0,
      });
    });

    reply.header("Cache-Control", CACHE_300);
    return { items, total, page: q.page, pageSize: q.pageSize };
  });

  // ───────────────────────── GET /products/:slug ─────────────────────────
  app.get<{ Params: { slug: string } }>("/products/:slug", async (req, reply) => {
    const { locale } = localeQuery.parse(req.query);
    const loc = parseLocale(locale);
    const tenantId = req.apiAuth.tenantId;
    const ident = req.params.slug;

    // Slug bo'yicha, topilmasa id bo'yicha (fallback — slug yo'q mahsulotlar uchun).
    const product = await app.prisma.product.findFirst({
      where: { tenantId, active: true, OR: [{ slug: ident }, { id: ident }] },
      include: PRODUCT_INCLUDE,
    });
    if (!product) return reply.code(404).send({ error: "Mahsulot topilmadi" });

    const [ratings, reviewRows] = await Promise.all([
      ratingMapFor(app.prisma, tenantId, [product.id]),
      app.prisma.review.findMany({
        where: { tenantId, productId: product.id, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { customerName: true, rating: true, createdAt: true, text: true },
      }),
    ]);

    const reviews: ShapedReview[] = reviewRows.map((r) => ({
      author: r.customerName,
      rating: r.rating,
      date: r.createdAt.toISOString().slice(0, 10),
      text: r.text,
    }));
    const r = ratings.get(product.id);

    reply.header("Cache-Control", CACHE_300);
    return shapeProduct(product as unknown as RawProductForShape, {
      locale: loc,
      rating: r?.avg ?? 0,
      reviewCount: r?.count ?? 0,
      reviews,
    });
  });

  // ───────────────────── GET /products/:productId/upsells ─────────────────
  app.get<{ Params: { productId: string } }>("/products/:productId/upsells", async (req, reply) => {
    const { locale } = localeQuery.parse(req.query);
    const loc = parseLocale(locale);
    const tenantId = req.apiAuth.tenantId;

    const main = await app.prisma.product.findFirst({
      where: { tenantId, id: req.params.productId },
      select: { id: true },
    });
    if (!main) return reply.code(404).send({ error: "Mahsulot topilmadi" });

    const addons = await app.prisma.productAddon.findMany({
      where: { tenantId, mainProductId: main.id, addonProduct: { active: true } },
      orderBy: { position: "asc" },
      select: {
        discountPct: true,
        addonProduct: { include: PRODUCT_INCLUDE },
      },
    });

    const ratings = await ratingMapFor(app.prisma, tenantId, addons.map((a) => a.addonProduct.id));
    const reason = upsellReason(loc);

    reply.header("Cache-Control", CACHE_300);
    return addons.map((a) => {
      const r = ratings.get(a.addonProduct.id);
      return {
        product: shapeProduct(a.addonProduct as unknown as RawProductForShape, {
          locale: loc,
          rating: r?.avg ?? 0,
          reviewCount: r?.count ?? 0,
        }),
        discountPercent: a.discountPct,
        reason,
      };
    });
  });

  // ─────────────────────────── GET /promotions ───────────────────────────
  app.get("/promotions", async (req, reply) => {
    const { locale } = localeQuery.parse(req.query);
    const loc = parseLocale(locale);
    const tenantId = req.apiAuth.tenantId;

    // Eng kichik (eng oson erishiladigan) bepul yetkazib berish chegarasi.
    const methods = await app.prisma.deliveryMethod.findMany({
      where: { tenantId, active: true, freeAbove: { not: null, gt: 0 } },
      select: { freeAbove: true },
    });
    const thresholds = methods
      .map((m) => (m.freeAbove != null ? Number(m.freeAbove) : NaN))
      .filter((n) => Number.isFinite(n) && n > 0);

    const promotions = thresholds.length
      ? [buildFreeShippingPromotion(Math.min(...thresholds), loc)]
      : [];

    reply.header("Cache-Control", CACHE_300);
    return promotions;
  });

  // ──────────────────────────── POST /orders ─────────────────────────────
  const orderSchema = z.object({
    customer: z.object({
      name: z.string().min(1).max(120),
      phone: z.string().min(5).max(40),
    }),
    delivery: z.object({
      region: z.string().max(120).optional(),
      address: z.string().max(500).optional(),
      note: z.string().max(1000).optional(),
      method: z.enum(["courier", "pickup"]).default("courier"),
    }),
    items: z
      .array(
        z.object({
          productId: z.string().optional(),
          slug: z.string().optional(),
          name: z.string().optional(),
          quantity: z.number().int().positive(),
          unitPrice: z.number().nonnegative().optional(),
        }),
      )
      .min(1),
    appliedUpsells: z.array(z.string()).default([]),
    appliedPromotions: z.array(z.string()).default([]),
    totals: z
      .object({
        subtotal: z.number().optional(),
        discount: z.number().optional(),
        shipping: z.number().nonnegative().optional(),
        total: z.number().optional(),
      })
      .optional(),
    locale: z.string().optional(),
    attribution: z
      .object({
        utmSource: z.string().max(120).optional(),
        utmMedium: z.string().max(120).optional(),
        utmCampaign: z.string().max(120).optional(),
        landing: z.string().max(500).optional(),
        referrer: z.string().max(500).optional(),
      })
      .optional(),
  });

  app.post("/orders", async (req, reply) => {
    const data = orderSchema.parse(req.body);
    const tenantId = req.apiAuth.tenantId;

    const tenant = await app.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, currency: true, slug: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    // Har bir item uchun mahsulotni topish — productId (afzal) yoki slug bo'yicha.
    const resolved: { product: { id: string; name: string; price: unknown; stock: number }; quantity: number }[] = [];
    for (const item of data.items) {
      if (!item.productId && !item.slug) {
        return reply.code(400).send({ ok: false, message: "Har bir item'da productId yoki slug bo'lishi shart" });
      }
      const product = await app.prisma.product.findFirst({
        where: {
          tenantId,
          active: true,
          ...(item.productId ? { id: item.productId } : { slug: item.slug }),
        },
        select: { id: true, name: true, price: true, stock: true },
      });
      if (!product) {
        return reply.code(400).send({ ok: false, message: `Mahsulot topilmadi: ${item.productId ?? item.slug}` });
      }
      resolved.push({ product, quantity: item.quantity });
    }

    // Stock tekshiruvi (atomic decrement transaction ichida ham qayta tekshiriladi).
    const stockErrors = resolved
      .filter((r) => r.product.stock < r.quantity)
      .map((r) => `"${r.product.name}" — yetarli emas (mavjud: ${r.product.stock})`);
    if (stockErrors.length) {
      return reply.code(409).send({ ok: false, message: stockErrors.join("; ") });
    }

    // Upsell chegirmalari — appliedUpsells'dagi mahsulotga ProductAddon.discountPct.
    const upsellSet = new Set(data.appliedUpsells);
    const discountMap = new Map<string, number>();
    if (upsellSet.size) {
      const addonRows = await app.prisma.productAddon.findMany({
        where: { tenantId, addonProductId: { in: [...upsellSet] } },
        select: { addonProductId: true, discountPct: true },
      });
      for (const a of addonRows) {
        discountMap.set(a.addonProductId, Math.max(discountMap.get(a.addonProductId) ?? 0, a.discountPct));
      }
    }

    // Server-side narx hisobi — client totals'ga ishonmaymiz.
    const lineItems = resolved.map((r) => {
      const base = Math.round(Number(r.product.price));
      const pct = discountMap.get(r.product.id) ?? 0;
      const unit = pct > 0 ? Math.round(base * (1 - pct / 100)) : base;
      return { productId: r.product.id, qty: r.quantity, price: unit, stock: r.product.stock };
    });
    const subtotal = lineItems.reduce((s, i) => s + i.qty * i.price, 0);

    // Yetkazib berish — pickup bepul; aks holda free-shipping chegarasi yoki client qiymati.
    let shipping = 0;
    if (data.delivery.method === "courier") {
      const freeMethods = await app.prisma.deliveryMethod.findMany({
        where: { tenantId, active: true, freeAbove: { not: null, gt: 0 } },
        select: { freeAbove: true },
      });
      const minFree = freeMethods
        .map((m) => (m.freeAbove != null ? Number(m.freeAbove) : Infinity))
        .reduce((a, b) => Math.min(a, b), Infinity);
      if (Number.isFinite(minFree) && subtotal >= minFree) {
        shipping = 0;
      } else {
        // Merchant client-tomonda hisoblagan yetkazish narxini hurmat qilamiz (clamp).
        const claimed = data.totals?.shipping ?? 0;
        shipping = Math.max(0, Math.min(Math.round(claimed), 100_000_000));
      }
    }
    const total = subtotal + shipping;

    // Mijozni topish/yaratish — telefon bo'yicha.
    let customer = await app.prisma.customer.findFirst({
      where: { tenantId, phone: data.customer.phone },
      select: { id: true },
    });
    if (!customer) {
      customer = await app.prisma.customer.create({
        data: { tenantId, name: data.customer.name, phone: data.customer.phone, language: parseLocale(data.locale) },
        select: { id: true },
      });
    }

    // Kanal — websaytdan kelgan deb WEBSITE kanaliga bog'laymiz (mavjud bo'lsa).
    const websiteChannel = await app.prisma.channel.findFirst({
      where: { tenantId, type: "WEBSITE", active: true },
      select: { id: true },
    });

    // Izoh — operator uchun: yetkazish, attributsiya, qo'llanган offerlar.
    const a = data.attribution;
    const noteParts = [
      data.delivery.method === "pickup" ? "Olib ketish (pickup)" : "Kuryer",
      data.delivery.region && `Region: ${data.delivery.region}`,
      data.delivery.note,
      a?.utmSource && `utm_source=${a.utmSource}`,
      a?.utmMedium && `utm_medium=${a.utmMedium}`,
      a?.utmCampaign && `utm_campaign=${a.utmCampaign}`,
      a?.landing && `landing=${a.landing}`,
      data.appliedUpsells.length && `upsells: ${data.appliedUpsells.join(", ")}`,
      data.appliedPromotions.length && `promos: ${data.appliedPromotions.join(", ")}`,
    ].filter(Boolean) as string[];
    const shippingAddress = [data.delivery.region, data.delivery.address].filter(Boolean).join(", ") || null;

    // Buyurtma + stock kamaytirish — atomic.
    let order: { id: string; code: string };
    try {
      order = await app.prisma.$transaction(async (tx) => {
        const prefix = "ORD-";
        const last = await tx.order.findFirst({
          where: { tenantId, code: { startsWith: prefix } },
          orderBy: { createdAt: "desc" },
          select: { code: true },
        });
        const lastNum = last ? Number(last.code.slice(prefix.length)) || 7000 : 7000;
        const code = `${prefix}${lastNum + 1}`;

        for (const i of lineItems) {
          const res = await tx.product.updateMany({
            where: { id: i.productId, tenantId, stock: { gte: i.qty } },
            data: { stock: { decrement: i.qty } },
          });
          if (res.count === 0) throw new Error(`OUT_OF_STOCK:${i.productId}`);
        }

        const created = await tx.order.create({
          data: {
            tenantId,
            code,
            status: "PENDING",
            total,
            currency: tenant.currency,
            notes: noteParts.join(" | ") || null,
            customerId: customer!.id,
            channelId: websiteChannel?.id,
            shippingAddress,
            items: { create: lineItems.map((i) => ({ productId: i.productId, qty: i.qty, price: i.price })) },
          },
          select: { id: true, code: true },
        });
        return created;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.startsWith("OUT_OF_STOCK:")) {
        return reply.code(409).send({ ok: false, message: "Mahsulot zaxiradan tugadi" });
      }
      throw err;
    }

    // Yon ta'sirlar — fonda (javobni kechiktirmaydi).
    grantOrderPoints(app.prisma, tenantId, customer.id, order.id, subtotal).catch(() => undefined);
    pushOrderToSalesDoctor(app.prisma, tenantId, order.id).catch((e) =>
      app.log.warn({ err: e, orderId: order.id }, "SD push failed"),
    );
    fireWebhookEvent(app.prisma, tenantId, "order.created", {
      order: { id: order.id, code: order.code, total, currency: tenant.currency, status: "PENDING", source: "website" },
    }).catch((e) => app.log.warn({ err: e, orderId: order.id }, "webhook fire failed"));
    publishToTenant(tenantId, { type: "order.created", orderId: order.id, code: order.code, total, currency: tenant.currency });
    pushToTenantAdmins(app.prisma, tenantId, {
      title: "Websaytdan yangi buyurtma",
      body: `#${order.code} · ${total.toLocaleString("ru-RU")} ${tenant.currency}`,
      url: "/",
    }).catch(() => undefined);

    return reply.code(201).send({ ok: true, orderId: order.id, message: `Buyurtma #${order.code} qabul qilindi` });
  });
};
