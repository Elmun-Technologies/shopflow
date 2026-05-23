// Public Storefront API — Mini App va web katalog uchun.
// Auth talab qilinmaydi. Tenant slug orqali topiladi.
// Bu endpointlar mijozlarga ko'rsatiladigan ma'lumotlarni qaytaradi.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { notifyCustomer } from "../lib/telegram-notify.js";
import { verifyTelegramInitData, getBotTokenForTenant } from "../lib/telegram-auth.js";
import type { PrismaClient } from "@prisma/client";

// Promo kodni inline tekshirish (import tsikli oldini olish)
async function applyPromoValidation(
  prisma: PrismaClient,
  tenantId: string,
  code: string,
  orderAmount: number,
  customerId?: string | null,
): Promise<{ valid: true; discount: number; promoCodeId: string } | { valid: false; error: string }> {
  const promo = await prisma.promoCode.findUnique({
    where: { tenantId_code: { tenantId, code: code.toUpperCase() } },
  });
  if (!promo || !promo.active) return { valid: false, error: "Promo kod topilmadi yoki faol emas" };
  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) return { valid: false, error: "Promo kod hali boshlanmagan" };
  if (promo.endsAt && promo.endsAt < now) return { valid: false, error: "Promo kod muddati tugagan" };
  if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
    return { valid: false, error: "Promo kod foydalanish limiti tugagan" };
  }
  if (promo.minOrderAmount && orderAmount < Number(promo.minOrderAmount)) {
    return { valid: false, error: `Minimal buyurtma: ${Number(promo.minOrderAmount).toLocaleString("uz-UZ")} so'm` };
  }
  if (customerId && promo.perUserLimit > 0) {
    const used = await prisma.promoUsage.count({ where: { promoCodeId: promo.id, customerId } });
    if (used >= promo.perUserLimit) return { valid: false, error: "Siz bu kodni allaqachon ishlatgansiz" };
  }
  let discount = 0;
  if (promo.discountType === "PERCENT") {
    discount = Math.round(orderAmount * (Number(promo.discountValue) / 100));
    if (promo.maxDiscount) discount = Math.min(discount, Number(promo.maxDiscount));
  } else {
    discount = Math.min(Number(promo.discountValue), orderAmount);
  }
  return { valid: true, discount, promoCodeId: promo.id };
}

export const storefrontRoutes: FastifyPluginAsync = async (app) => {
  // Tenant'ning to'liq Vitrina ma'lumotlari:
  // layout (bloklar), brand, mahsulotlar, kategoriyalar
  // ?page=1&limit=50&categoryId=xxx&q=search
  app.get("/:tenantSlug", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const query = z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().min(1).max(200).default(100),
      categoryId: z.string().optional(),
      q: z.string().max(100).optional(),
    }).parse(req.query);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true, currency: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const productWhere = {
      tenantId: tenant.id,
      active: true,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.q ? { name: { contains: query.q, mode: "insensitive" as const } } : {}),
    };

    const [storefront, products, productTotal, categories, weeklyOrderItems, ratingAggregates] = await Promise.all([
      app.prisma.storefront.findUnique({
        where: { tenantId: tenant.id },
      }),
      app.prisma.product.findMany({
        where: productWhere,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          saleCampaign: {
            select: { id: true, label: true, badgeColor: true, active: true, startsAt: true, endsAt: true },
          },
          comboAddons: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              position: true,
              discountPct: true,
              defaultSelected: true,
              addonProduct: {
                select: { id: true, name: true, sku: true, price: true, imageUrl: true, stock: true, active: true },
              },
            },
          },
        },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      app.prisma.product.count({ where: productWhere }),
      app.prisma.category.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: "asc" },
      }),
      // Social proof — oxirgi 7 kun ichidagi har bir mahsulot uchun unique
      // mijoz buyurtmalari soni
      app.prisma.orderItem.groupBy({
        by: ["productId"],
        where: {
          order: {
            tenantId: tenant.id,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        _count: { _all: true },
      }),
      // Rating aggregate — har mahsulot uchun avg + count (faqat APPROVED)
      app.prisma.review.groupBy({
        by: ["productId"],
        where: { tenantId: tenant.id, status: "APPROVED" },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    if (storefront && !storefront.published) {
      return reply.code(403).send({ error: "Do'kon yopiq" });
    }

    const weeklyBuyersMap = new Map<string, number>();
    for (const item of weeklyOrderItems) {
      weeklyBuyersMap.set(item.productId, item._count._all);
    }
    const ratingMap = new Map<string, { avg: number; count: number }>();
    for (const r of ratingAggregates) {
      ratingMap.set(r.productId, {
        avg: r._avg.rating ?? 0,
        count: r._count._all,
      });
    }

    // Cache-Control — storefront ma'lumotlari sekundlar miqyosida o'zgarmaydi.
    // 30 soniya client-side + 60 soniya stale-while-revalidate Caddy/CDN uchun.
    reply.header("Cache-Control", "public, max-age=30, stale-while-revalidate=60");

    return {
      tenant,
      layout: storefront?.blocks ?? [],
      brand: storefront?.brand ?? {},
      products: products.map((p) => ({
        ...p,
        weeklyBuyers: weeklyBuyersMap.get(p.id) ?? 0,
        avgRating: ratingMap.get(p.id)?.avg ?? 0,
        reviewCount: ratingMap.get(p.id)?.count ?? 0,
      })),
      categories,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: productTotal,
        pages: Math.ceil(productTotal / query.limit),
      },
    };
  });

  // Promo kod tekshirish endpoint
  app.post<{ Params: { tenantSlug: string }; Body: { code: string; total: number; tgUserId?: number } }>(
    "/:tenantSlug/promo/validate",
    async (req, reply) => {
      const { tenantSlug } = req.params;
      const { code, total, tgUserId } = req.body ?? {};
      if (!code || !total) return reply.code(400).send({ error: "code va total talab qilinadi" });

      const tenant = await app.prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true },
      });
      if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

      let customerId: string | null = null;
      if (tgUserId) {
        const cust = await app.prisma.customer.findFirst({
          where: { tenantId: tenant.id, telegramUserId: BigInt(tgUserId) },
          select: { id: true },
        });
        customerId = cust?.id ?? null;
      }

      const result = await applyPromoValidation(app.prisma, tenant.id, code, total, customerId);
      if (!result.valid) return reply.code(422).send({ error: result.error });
      return { discount: result.discount, promoCodeId: result.promoCodeId };
    },
  );

  // Buyurtma yaratish (mijoz Mini App orqali)
  const checkoutSchema = z.object({
    customer: z.object({
      name: z.string().min(1).max(120),
      phone: z.string().min(5).max(40),
      email: z.string().email().optional().or(z.literal("")),
      address: z.string().max(500).optional(),
      notes: z.string().max(1000).optional(),
      // GPS koordinatalari — Mini App'da "📍 Joriy joylashuvni olish" tugmasi
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    }),
    items: z
      .array(
        z.object({
          productId: z.string(),
          qty: z.number().int().positive(),
        }),
      )
      .min(1),
    // Promo kod
    promoCode: z.string().max(40).optional(),
    // Telegram'dan kelgan ma'lumotlar (auth uchun)
    telegram: z
      .object({
        userId: z.union([z.number(), z.string()]).optional(),
        username: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      })
      .optional(),
    // Kanal — qaysi kanal orqali kelgan (Mini App link UTM'ida bo'lishi mumkin)
    channelSlug: z.string().optional(),
  });

  app.post("/:tenantSlug/checkout", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const data = checkoutSchema.parse(req.body);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    // Mahsulotlarni topish va narxlarni snapshot qilish
    const productIds = data.items.map((i) => i.productId);
    const products = await app.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: tenant.id, active: true },
    });
    if (products.length !== productIds.length) {
      return reply.code(400).send({ error: "Ba'zi mahsulotlar topilmadi yoki sotuvda emas" });
    }

    // Stock tekshiruvi — null yoki undefined stock cheksiz deb hisoblanadi
    const stockErrors: string[] = [];
    for (const item of data.items) {
      const p = products.find((pp) => pp.id === item.productId)!;
      if (p.stock !== null && p.stock !== undefined && p.stock < item.qty) {
        stockErrors.push(`"${p.name}" uchun yetarli tovar yo'q (mavjud: ${p.stock}, so'ralgan: ${item.qty})`);
      }
    }
    if (stockErrors.length > 0) {
      return reply.code(400).send({ error: "Yetarli tovar yo'q", details: stockErrors });
    }

    const items = data.items.map((i) => {
      const p = products.find((pp) => pp.id === i.productId)!;
      return {
        productId: i.productId,
        qty: i.qty,
        price: Number(p.price),
        stock: p.stock,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);

    // Promo kod tekshiruvi
    let promoCodeId: string | null = null;
    let promoDiscount = 0;
    if (data.promoCode) {
      const promoResult = await applyPromoValidation(
        app.prisma, tenant.id, data.promoCode, subtotal,
        null, // customerId keyinroq aniqlanadi
      );
      if (promoResult.valid) {
        promoCodeId = promoResult.promoCodeId;
        promoDiscount = promoResult.discount;
      }
      // Noto'g'ri promo kod checkout'ni to'xtatmaydi — shunchaki e'tiborsiz qoldiriladi
    }

    const total = subtotal - promoDiscount;

    // Mijozni topish yoki yaratish — avval Telegram userId bo'yicha, keyin telefon bo'yicha
    const tgUserId = data.telegram?.userId ? BigInt(data.telegram.userId) : null;
    let customer = null as Awaited<ReturnType<typeof app.prisma.customer.findFirst>> | null;
    if (tgUserId) {
      customer = await app.prisma.customer.findFirst({
        where: { tenantId: tenant.id, telegramUserId: tgUserId },
      });
    }
    if (!customer && data.customer.phone) {
      customer = await app.prisma.customer.findFirst({
        where: { tenantId: tenant.id, phone: data.customer.phone },
      });
    }
    if (!customer) {
      customer = await app.prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: data.customer.name,
          phone: data.customer.phone,
          email: data.customer.email || null,
          notes: data.customer.notes,
          telegramUserId: tgUserId,
        },
      });
    } else if (tgUserId && customer.telegramUserId !== tgUserId) {
      // Mavjud mijozga Telegram userId ni bog'lab qo'yamiz
      customer = await app.prisma.customer.update({
        where: { id: customer.id },
        data: { telegramUserId: tgUserId },
      });
    }

    // Kanal — agar mavjud bo'lsa
    let channelId: string | undefined;
    if (data.channelSlug) {
      const channel = await app.prisma.channel.findFirst({
        where: { tenantId: tenant.id, type: "TELEGRAM" },
      });
      if (channel) channelId = channel.id;
    } else if (data.telegram) {
      // Telegram'dan kelganini avtomatik aniqlash
      const channel = await app.prisma.channel.findFirst({
        where: { tenantId: tenant.id, type: "TELEGRAM", active: true },
      });
      if (channel) channelId = channel.id;
    }

    const noteParts = [
      data.customer.address && `Manzil: ${data.customer.address}`,
      data.customer.notes,
      data.telegram?.username && `Telegram: @${data.telegram.username}`,
    ].filter(Boolean);

    // Order yaratish + stock kamaytirish — atomic transaction ichida.
    // Order kodi ham shu transaction ichida hisoblanadi (race condition yo'q).
    const order = await app.prisma.$transaction(async (tx) => {
      // Order kodi — tenant uchun oxirgi ORD-NNNN ni LOCK bilan olamiz
      const prefix = "ORD-";
      const last = await tx.order.findFirst({
        where: { tenantId: tenant.id, code: { startsWith: prefix } },
        orderBy: { createdAt: "desc" },
        select: { code: true },
      });
      const lastNum = last ? Number(last.code.slice(prefix.length)) || 7000 : 7000;
      const code = `${prefix}${lastNum + 1}`;

      // Stock kamaytirish — faqat track qilinadigan mahsulotlar uchun
      for (const item of items) {
        if (item.stock !== null && item.stock !== undefined) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.qty } },
          });
        }
      }

      const order = await tx.order.create({
        data: {
          tenantId: tenant.id,
          code,
          status: "PENDING",
          total,
          currency: tenant.currency,
          notes: noteParts.join(" | ") || null,
          customerId: customer.id,
          channelId,
          shippingAddress: data.customer.address || null,
          shippingLat: data.customer.lat ?? null,
          shippingLng: data.customer.lng ?? null,
          promoCodeId,
          promoDiscount: promoDiscount > 0 ? promoDiscount : null,
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              qty: i.qty,
              price: i.price,
            })),
          },
        },
        include: { items: true },
      });

      // Promo foydalanishini yozib qo'yamiz + usageCount oshiramiz
      if (promoCodeId && promoDiscount > 0) {
        await tx.promoUsage.create({
          data: {
            tenantId: tenant.id,
            promoCodeId,
            customerId: customer.id,
            orderId: order.id,
          },
        });
        await tx.promoCode.update({
          where: { id: promoCodeId },
          data: { usageCount: { increment: 1 } },
        });
      }

      return order;
    });

    // Mijozga Telegram orqali tasdiqlash xabari — fonda, kutmaymiz
    if (customer.telegramUserId) {
      const totalStr = tenant.currency === "UZS"
        ? `${total.toLocaleString("uz-UZ")} so'm`
        : `${total} ${tenant.currency}`;
      const text =
        `✅ <b>Buyurtma yaratildi!</b>\n\n` +
        `Buyurtma: <b>#${order.code}</b>\n` +
        `Summa: ${totalStr}\n\n` +
        `Mahsulotlar tayyorlanmoqda. Holat o'zgarganda shu yerda xabar yuboramiz — buyurtmangizni "Buyurtmalarim" bo'limidan kuzating.`;
      notifyCustomer(app.prisma, tenant.id, customer.id, text)
        .catch((err) => app.log.warn({ err, orderId: order.id }, "Checkout TG notify failed"));
    }

    return reply.code(201).send({
      id: order.id,
      code: order.code,
      subtotal,
      promoDiscount: promoDiscount > 0 ? promoDiscount : null,
      total,
      currency: tenant.currency,
    });
  });

  // Mijozning shu do'kondagi buyurtmalari — Telegram userId orqali aniqlanadi.
  // GET /api/storefront/:tenantSlug/orders?tgUserId=12345
  app.get("/:tenantSlug/orders", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const { tgUserId } = z.object({ tgUserId: z.coerce.number().int().positive() }).parse(req.query);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, currency: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: BigInt(tgUserId) },
      select: { id: true },
    });
    if (!customer) {
      return { orders: [] };
    }

    const orders = await app.prisma.order.findMany({
      where: { tenantId: tenant.id, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        items: {
          select: {
            id: true,
            qty: true,
            price: true,
            product: { select: { id: true, name: true, imageUrl: true, sku: true } },
          },
        },
      },
    });

    return {
      orders: orders.map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        total: Number(o.total),
        currency: o.currency,
        notes: o.notes,
        createdAt: o.createdAt.toISOString(),
        items: o.items.map((it) => ({
          id: it.id,
          qty: it.qty,
          price: Number(it.price),
          product: it.product,
        })),
      })),
    };
  });

  // Mijoz profilini topish (yoki birinchi marta avto-yaratish).
  // Mini App ochilganda chaqiriladi — foydalanuvchi checkout'gacha kutmasdan
  // tizimga ro'yxat oladi (telegramUserId orqali identifikatsiya).
  // GET /api/storefront/:tenantSlug/profile?tgUserId=12345&firstName=...&lastName=...&username=...&ref=referrerTgId
  const profileQuerySchema = z.object({
    tgUserId: z.coerce.number().int().positive(),
    firstName: z.string().max(80).optional(),
    lastName: z.string().max(80).optional(),
    username: z.string().max(80).optional(),
    ref: z.coerce.number().int().positive().optional(),
  });
  app.get("/:tenantSlug/profile", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const q = profileQuerySchema.parse(req.query);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const tgId = BigInt(q.tgUserId);
    let customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: tgId },
      include: { addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] } },
    });

    // Birinchi marta — avto-ro'yxat (firstName/lastName Telegram'dan).
    // ?ref=<referrerTgId> bo'lsa, referral grafini bog'laymiz (faqat birinchi marta,
    // o'zini o'zi taklif qila olmaydi).
    if (!customer) {
      const displayName = [q.firstName, q.lastName].filter(Boolean).join(" ") || "Mijoz";

      let referredByCustomerId: string | null = null;
      if (q.ref && q.ref !== q.tgUserId) {
        const referrer = await app.prisma.customer.findFirst({
          where: { tenantId: tenant.id, telegramUserId: BigInt(q.ref) },
          select: { id: true },
        });
        if (referrer) referredByCustomerId = referrer.id;
      }

      customer = await app.prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: displayName,
          firstName: q.firstName ?? null,
          lastName: q.lastName ?? null,
          telegramUserId: tgId,
          telegramUsername: q.username ?? null,
          referredByCustomerId,
        },
        include: { addresses: true },
      });
    }

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        firstName: customer.firstName,
        lastName: customer.lastName,
        patronymic: customer.patronymic,
        phone: customer.phone,
        email: customer.email,
        birthDate: customer.birthDate?.toISOString().slice(0, 10) ?? null,
        gender: customer.gender,
        language: customer.language,
        avatar: customer.avatar,
        notifyOrderUpdates: customer.notifyOrderUpdates,
        notifyCartAbandonment: customer.notifyCartAbandonment,
        notifyPromotions: customer.notifyPromotions,
        telegramUserId: customer.telegramUserId?.toString() ?? null,
        telegramUsername: customer.telegramUsername,
        createdAt: customer.createdAt.toISOString(),
      },
      addresses: customer.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        city: a.city,
        street: a.street,
        apartment: a.apartment,
        notes: a.notes,
        isDefault: a.isDefault,
      })),
    };
  });

  // Mijoz profilini yangilash
  const profilePatchSchema = z.object({
    tgUserId: z.coerce.number().int().positive(),
    // initData — Telegram Mini App dan keladi, HMAC tekshiruvi uchun
    // Agar berilmasa — legacy rejim (pastroq xavfsizlik)
    initData: z.string().optional(),
    firstName: z.string().max(80).optional().nullable(),
    lastName: z.string().max(80).optional().nullable(),
    patronymic: z.string().max(80).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
    gender: z.enum(["male", "female"]).optional().nullable().or(z.literal("")),
    language: z.enum(["uz", "ru"]).optional(),
    notifyOrderUpdates: z.boolean().optional(),
    notifyCartAbandonment: z.boolean().optional(),
    notifyPromotions: z.boolean().optional(),
  });
  app.patch("/:tenantSlug/profile", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const data = profilePatchSchema.parse(req.body);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    // initData berilgan bo'lsa — HMAC tekshiruvi
    if (data.initData) {
      const botToken = await getBotTokenForTenant(app.prisma as never, tenant.id);
      if (botToken) {
        const result = verifyTelegramInitData(data.initData, botToken);
        if (!result.valid) {
          return reply.code(401).send({ error: "Telegram autentifikatsiya muvaffaqiyatsiz" });
        }
        // initData dagi userId va so'rovdagi tgUserId mos kelishi shart
        if (result.userId && result.userId !== data.tgUserId) {
          return reply.code(403).send({ error: "Foydalanuvchi mos kelmadi" });
        }
      }
    }

    const tgId = BigInt(data.tgUserId);
    const customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: tgId },
      select: { id: true },
    });
    if (!customer) return reply.code(404).send({ error: "Mijoz topilmadi" });

    // Display name = firstName + lastName (mavjudlarini birlashtirib)
    const displayParts = [data.firstName, data.lastName].filter(Boolean) as string[];

    const updated = await app.prisma.customer.update({
      where: { id: customer.id },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName || null }),
        ...(data.lastName !== undefined && { lastName: data.lastName || null }),
        ...(data.patronymic !== undefined && { patronymic: data.patronymic || null }),
        ...(data.phone !== undefined && { phone: data.phone || null }),
        ...(data.email !== undefined && { email: data.email || null }),
        ...(data.birthDate !== undefined && {
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
        }),
        ...(data.gender !== undefined && { gender: data.gender || null }),
        ...(data.language !== undefined && { language: data.language }),
        ...(data.notifyOrderUpdates !== undefined && { notifyOrderUpdates: data.notifyOrderUpdates }),
        ...(data.notifyCartAbandonment !== undefined && { notifyCartAbandonment: data.notifyCartAbandonment }),
        ...(data.notifyPromotions !== undefined && { notifyPromotions: data.notifyPromotions }),
        ...(displayParts.length > 0 && { name: displayParts.join(" ") }),
      },
    });

    return {
      customer: {
        id: updated.id,
        name: updated.name,
        firstName: updated.firstName,
        lastName: updated.lastName,
        patronymic: updated.patronymic,
        phone: updated.phone,
        email: updated.email,
        birthDate: updated.birthDate?.toISOString().slice(0, 10) ?? null,
        gender: updated.gender,
        language: updated.language,
        avatar: updated.avatar,
        notifyOrderUpdates: updated.notifyOrderUpdates,
        notifyCartAbandonment: updated.notifyCartAbandonment,
        notifyPromotions: updated.notifyPromotions,
      },
    };
  });

  // Manzillar kitobi — CRUD (telegramUserId orqali identifikatsiya)
  const addressSchema = z.object({
    tgUserId: z.coerce.number().int().positive(),
    label: z.string().min(1).max(40),
    city: z.string().max(80).optional().nullable(),
    street: z.string().min(1).max(200),
    apartment: z.string().max(40).optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
    isDefault: z.boolean().optional(),
  });

  app.post("/:tenantSlug/addresses", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const data = addressSchema.parse(req.body);
    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: BigInt(data.tgUserId) },
      select: { id: true },
    });
    if (!customer) return reply.code(404).send({ error: "Mijoz topilmadi" });

    if (data.isDefault) {
      // Boshqalardan default'ni olib tashlash
      await app.prisma.customerAddress.updateMany({
        where: { customerId: customer.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await app.prisma.customerAddress.create({
      data: {
        customerId: customer.id,
        tenantId: tenant.id,
        label: data.label,
        city: data.city || null,
        street: data.street,
        apartment: data.apartment || null,
        notes: data.notes || null,
        isDefault: data.isDefault ?? false,
      },
    });

    return reply.code(201).send({ address });
  });

  app.patch("/:tenantSlug/addresses/:id", async (req, reply) => {
    const params = z.object({ tenantSlug: z.string(), id: z.string() }).parse(req.params);
    const data = addressSchema.partial({ label: true, street: true }).parse(req.body);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: params.tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const tgUserId = data.tgUserId;
    if (tgUserId == null) return reply.code(400).send({ error: "tgUserId kerak" });

    const customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: BigInt(tgUserId) },
      select: { id: true },
    });
    if (!customer) return reply.code(404).send({ error: "Mijoz topilmadi" });

    const existing = await app.prisma.customerAddress.findFirst({
      where: { id: params.id, customerId: customer.id },
      select: { id: true },
    });
    if (!existing) return reply.code(404).send({ error: "Manzil topilmadi" });

    if (data.isDefault) {
      await app.prisma.customerAddress.updateMany({
        where: { customerId: customer.id, isDefault: true, id: { not: params.id } },
        data: { isDefault: false },
      });
    }

    const address = await app.prisma.customerAddress.update({
      where: { id: params.id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.street !== undefined && { street: data.street }),
        ...(data.city !== undefined && { city: data.city || null }),
        ...(data.apartment !== undefined && { apartment: data.apartment || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });
    return { address };
  });

  app.delete("/:tenantSlug/addresses/:id", async (req, reply) => {
    const params = z.object({ tenantSlug: z.string(), id: z.string() }).parse(req.params);
    const { tgUserId } = z.object({ tgUserId: z.coerce.number().int().positive() }).parse(req.query);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: params.tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: BigInt(tgUserId) },
      select: { id: true },
    });
    if (!customer) return reply.code(404).send({ error: "Mijoz topilmadi" });

    const existing = await app.prisma.customerAddress.findFirst({
      where: { id: params.id, customerId: customer.id },
      select: { id: true },
    });
    if (!existing) return reply.code(404).send({ error: "Manzil topilmadi" });

    await app.prisma.customerAddress.delete({ where: { id: params.id } });
    return { ok: true };
  });

  // Wishlist / favorites — Mini App "Sevimlilar" tab
  // GET /api/storefront/:tenantSlug/wishlist?tgUserId=12345
  // Returns full product objects so the cabinet renders without a join
  app.get("/:tenantSlug/wishlist", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const { tgUserId } = z.object({ tgUserId: z.coerce.number().int().positive() }).parse(req.query);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: BigInt(tgUserId) },
      select: { id: true },
    });
    if (!customer) return { items: [] };

    const items = await app.prisma.wishlistItem.findMany({
      where: { customerId: customer.id, tenantId: tenant.id },
      include: {
        product: {
          select: {
            id: true, sku: true, name: true, price: true, oldPrice: true,
            currency: true, stock: true, imageUrl: true, active: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      items: items.map((w) => ({
        id: w.id,
        productId: w.productId,
        createdAt: w.createdAt.toISOString(),
        product: w.product
          ? {
              id: w.product.id, sku: w.product.sku, name: w.product.name,
              price: Number(w.product.price),
              oldPrice: w.product.oldPrice != null ? Number(w.product.oldPrice) : null,
              currency: w.product.currency,
              stock: w.product.stock,
              imageUrl: w.product.imageUrl,
              active: w.product.active,
            }
          : null,
      })),
    };
  });

  // Referrals — mijoz tomonidan taklif qilinganlar va ularning faolligi
  // GET /api/storefront/:tenantSlug/referrals?tgUserId=12345
  app.get("/:tenantSlug/referrals", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const { tgUserId } = z.object({ tgUserId: z.coerce.number().int().positive() }).parse(req.query);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const me = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: BigInt(tgUserId) },
      select: { id: true },
    });
    if (!me) return { invited: [], totals: { invitedCount: 0, withOrdersCount: 0 } };

    const invited = await app.prisma.customer.findMany({
      where: { tenantId: tenant.id, referredByCustomerId: me.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      totals: {
        invitedCount: invited.length,
        withOrdersCount: invited.filter((c) => c._count.orders > 0).length,
      },
      invited: invited.map((c) => ({
        id: c.id,
        // Maxfiylik — to'liq ism o'rniga faqat birinchi ism + familiya bosh harfi
        displayName: c.firstName || c.lastName
          ? `${c.firstName ?? ""}${c.lastName ? " " + c.lastName.slice(0, 1) + "." : ""}`.trim()
          : c.name.slice(0, 12),
        createdAt: c.createdAt.toISOString(),
        ordersCount: c._count.orders,
      })),
    };
  });

  // Wishlist — qo'shish (idempotent — upsert orqali)
  app.post("/:tenantSlug/wishlist", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const data = z
      .object({ tgUserId: z.coerce.number().int().positive(), productId: z.string() })
      .parse(req.body);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: BigInt(data.tgUserId) },
      select: { id: true },
    });
    if (!customer) return reply.code(404).send({ error: "Mijoz topilmadi" });

    // Mahsulot shu tenant'ga tegishliligini tekshiramiz
    const product = await app.prisma.product.findFirst({
      where: { id: data.productId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!product) return reply.code(404).send({ error: "Mahsulot topilmadi" });

    const item = await app.prisma.wishlistItem.upsert({
      where: { customerId_productId: { customerId: customer.id, productId: data.productId } },
      create: {
        customerId: customer.id,
        productId: data.productId,
        tenantId: tenant.id,
      },
      update: {},
    });
    return reply.code(201).send({ id: item.id });
  });

  // Wishlist — o'chirish (productId orqali, idempotent)
  app.delete("/:tenantSlug/wishlist/:productId", async (req, reply) => {
    const params = z.object({ tenantSlug: z.string(), productId: z.string() }).parse(req.params);
    const { tgUserId } = z.object({ tgUserId: z.coerce.number().int().positive() }).parse(req.query);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: params.tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: BigInt(tgUserId) },
      select: { id: true },
    });
    if (!customer) return { ok: true };

    await app.prisma.wishlistItem.deleteMany({
      where: { customerId: customer.id, productId: params.productId },
    });
    return { ok: true };
  });

  // ─── PRODUCT REVIEWS ──────────────────────────────────────────────
  // GET /:slug/products/:productId/reviews — public approved list + avg
  app.get("/:tenantSlug/products/:productId/reviews", async (req, reply) => {
    const params = z.object({ tenantSlug: z.string(), productId: z.string() }).parse(req.params);
    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: params.tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const [items, agg] = await Promise.all([
      app.prisma.review.findMany({
        where: { tenantId: tenant.id, productId: params.productId, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          customerName: true,
          rating: true,
          text: true,
          photos: true,
          createdAt: true,
        },
      }),
      app.prisma.review.aggregate({
        where: { tenantId: tenant.id, productId: params.productId, status: "APPROVED" },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);
    return {
      avg: agg._avg.rating ?? 0,
      count: agg._count._all,
      items: items.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  // POST /:slug/reviews — mijoz yangi sharh yuboradi (PENDING — admin moderatsiyasi)
  const reviewSubmitSchema = z.object({
    tgUserId: z.coerce.number().int().positive(),
    productId: z.string(),
    rating: z.number().int().min(1).max(5),
    text: z.string().min(5).max(2000),
    photos: z.array(z.string().max(500)).max(6).optional(),
  });
  app.post("/:tenantSlug/reviews", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const data = reviewSubmitSchema.parse(req.body);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, telegramUserId: BigInt(data.tgUserId) },
      select: { id: true, name: true },
    });
    if (!customer) return reply.code(404).send({ error: "Mijoz topilmadi" });

    // Mijoz shu mahsulotni xarid qilganini tekshirish — spam reviewlardan himoya
    const purchased = await app.prisma.orderItem.findFirst({
      where: {
        productId: data.productId,
        order: { tenantId: tenant.id, customerId: customer.id },
      },
      select: { id: true },
    });
    if (!purchased) {
      return reply.code(403).send({ error: "Sharh yozish uchun bu mahsulotni xarid qilgan bo'lishingiz kerak" });
    }

    // Bir mahsulotga bir mijoz bitta sharh
    const existing = await app.prisma.review.findFirst({
      where: { tenantId: tenant.id, productId: data.productId, customerId: customer.id },
      select: { id: true },
    });
    if (existing) {
      return reply.code(409).send({ error: "Bu mahsulot uchun allaqachon sharh yozgansiz" });
    }

    const product = await app.prisma.product.findFirst({
      where: { id: data.productId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!product) return reply.code(404).send({ error: "Mahsulot topilmadi" });

    const review = await app.prisma.review.create({
      data: {
        tenantId: tenant.id,
        productId: data.productId,
        customerId: customer.id,
        customerName: customer.name,
        rating: data.rating,
        text: data.text,
        photos: data.photos ?? [],
        status: "PENDING",
      },
      select: { id: true },
    });
    return reply.code(201).send({ id: review.id, status: "PENDING" });
  });

  /**
   * Mini App ochilganda ko'rsatish uchun aktiv popup'lar ro'yxati.
   * GET /api/storefront/:tenantSlug/popups?trigger=ON_OPEN
   *
   * Faqat:
   *   - active = true
   *   - startsAt <= now <= endsAt (yoki belgilanmagan)
   *   - sorted by priority desc
   * Frequency/cooldown tekshiruvi clientda localStorage orqali (yengilroq).
   */
  app.get("/:tenantSlug/popups", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const { trigger } = z
      .object({ trigger: z.enum(["ON_OPEN", "AFTER_DELAY", "ON_TAB_CHANGE", "ON_CART_ABANDON"]).optional() })
      .parse(req.query);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const now = new Date();
    const popups = await app.prisma.popup.findMany({
      where: {
        tenantId: tenant.id,
        active: true,
        ...(trigger ? { trigger } : {}),
        OR: [
          { startsAt: null, endsAt: null },
          { startsAt: { lte: now }, endsAt: null },
          { startsAt: null, endsAt: { gte: now } },
          { startsAt: { lte: now }, endsAt: { gte: now } },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        title: true,
        body: true,
        imageUrl: true,
        ctaText: true,
        ctaUrl: true,
        kind: true,
        trigger: true,
        triggerDelaySec: true,
        maxImpressionsPerUser: true,
        cooldownHours: true,
        priority: true,
      },
    });

    return { popups };
  });

  /**
   * Popup ko'rsatildi / bosildi — analitika uchun.
   * POST /api/storefront/:tenantSlug/popups/:popupId/event
   * Body: { kind: "impression" | "click" }
   */
  app.post<{ Params: { tenantSlug: string; popupId: string } }>(
    "/:tenantSlug/popups/:popupId/event",
    async (req, reply) => {
      const { tenantSlug, popupId } = req.params;
      const { kind } = z.object({ kind: z.enum(["impression", "click"]) }).parse(req.body);

      const tenant = await app.prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
      if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

      const popup = await app.prisma.popup.findFirst({ where: { id: popupId, tenantId: tenant.id } });
      if (!popup) return reply.code(404).send({ error: "Popup topilmadi" });

      await app.prisma.popup.update({
        where: { id: popupId },
        data: kind === "impression" ? { impressions: { increment: 1 } } : { clicks: { increment: 1 } },
      });
      return { ok: true };
    },
  );

  /**
   * Mijoz savatini saqlash (cart abandonment uchun).
   * POST /api/storefront/:tenantSlug/cart
   * Body: { telegram: { userId, firstName?, lastName? }, items: [...], total, currency }
   *
   * Mijoz Mini App ichida cart'ga mahsulot qo'shgan har safari upsert qilamiz.
   * Backend scheduler 1 soatdan ortiq tinch turgan savatlarga Telegram'dan eslatma yuboradi.
   */
  const cartUpsertSchema = z.object({
    telegram: z.object({
      userId: z.union([z.number(), z.string()]),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    }),
    items: z
      .array(
        z.object({
          productId: z.string(),
          qty: z.number().int().positive(),
          name: z.string(),
          price: z.number().nonnegative(),
          imageUrl: z.string().nullable().optional(),
        }),
      )
      .min(0),
    total: z.number().nonnegative(),
    currency: z.string().optional(),
  });

  app.post("/:tenantSlug/cart", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const data = cartUpsertSchema.parse(req.body);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, currency: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const tgUserId = BigInt(data.telegram.userId);
    const customerName = [data.telegram.firstName, data.telegram.lastName].filter(Boolean).join(" ").trim() || null;

    if (data.items.length === 0) {
      // Bo'sh cart — yozuvni o'chiramiz (checkout muvaffaqiyatli yoki mijoz tozalagan)
      await app.prisma.abandonedCart.deleteMany({
        where: { tenantId: tenant.id, telegramUserId: tgUserId },
      });
      return { ok: true, cleared: true };
    }

    await app.prisma.abandonedCart.upsert({
      where: { tenantId_telegramUserId: { tenantId: tenant.id, telegramUserId: tgUserId } },
      create: {
        tenantId: tenant.id,
        telegramUserId: tgUserId,
        customerName,
        items: data.items as never,
        total: data.total,
        currency: data.currency ?? tenant.currency,
        lastActiveAt: new Date(),
      },
      update: {
        items: data.items as never,
        total: data.total,
        currency: data.currency ?? tenant.currency,
        lastActiveAt: new Date(),
        customerName: customerName ?? undefined,
        // Mijoz qaytib kelib o'zgartirdi — reminder hisoblagichini saqlaymiz
        // (toki bir martalik yuborilgan reminder qayta yuborilmasin)
      },
    });

    return { ok: true };
  });
};
