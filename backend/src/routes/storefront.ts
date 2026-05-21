// Public Storefront API — Mini App va web katalog uchun.
// Auth talab qilinmaydi. Tenant slug orqali topiladi.
// Bu endpointlar mijozlarga ko'rsatiladigan ma'lumotlarni qaytaradi.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { notifyCustomer } from "../lib/telegram-notify.js";

export const storefrontRoutes: FastifyPluginAsync = async (app) => {
  // Tenant'ning to'liq Vitrina ma'lumotlari:
  // layout (bloklar), brand, mahsulotlar, kategoriyalar
  app.get("/:tenantSlug", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, name: true, slug: true, currency: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const [storefront, products, categories, weeklyOrderItems] = await Promise.all([
      app.prisma.storefront.findUnique({
        where: { tenantId: tenant.id },
      }),
      app.prisma.product.findMany({
        where: { tenantId: tenant.id, active: true },
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
      }),
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
    ]);

    if (storefront && !storefront.published) {
      return reply.code(403).send({ error: "Do'kon yopiq" });
    }

    const weeklyBuyersMap = new Map<string, number>();
    for (const item of weeklyOrderItems) {
      weeklyBuyersMap.set(item.productId, item._count._all);
    }

    return {
      tenant,
      layout: storefront?.blocks ?? [],
      brand: storefront?.brand ?? {},
      products: products.map((p) => ({ ...p, weeklyBuyers: weeklyBuyersMap.get(p.id) ?? 0 })),
      categories,
    };
  });

  // Buyurtma yaratish (mijoz Mini App orqali)
  const checkoutSchema = z.object({
    customer: z.object({
      name: z.string().min(1).max(120),
      phone: z.string().min(5).max(40),
      email: z.string().email().optional().or(z.literal("")),
      address: z.string().max(500).optional(),
      notes: z.string().max(1000).optional(),
    }),
    items: z
      .array(
        z.object({
          productId: z.string(),
          qty: z.number().int().positive(),
        }),
      )
      .min(1),
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

    const items = data.items.map((i) => {
      const p = products.find((pp) => pp.id === i.productId)!;
      return {
        productId: i.productId,
        qty: i.qty,
        price: Number(p.price),
      };
    });
    const total = items.reduce((s, i) => s + i.qty * i.price, 0);

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

    // Order kodi
    const prefix = "ORD-";
    const last = await app.prisma.order.findFirst({
      where: { tenantId: tenant.id, code: { startsWith: prefix } },
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const lastNum = last ? Number(last.code.slice(prefix.length)) : 7000;
    const code = `${prefix}${lastNum + 1}`;

    const noteParts = [
      data.customer.address && `Manzil: ${data.customer.address}`,
      data.customer.notes,
      data.telegram?.username && `Telegram: @${data.telegram.username}`,
    ].filter(Boolean);

    const order = await app.prisma.order.create({
      data: {
        tenantId: tenant.id,
        code,
        status: "PENDING",
        total,
        currency: tenant.currency,
        notes: noteParts.join(" | ") || null,
        customerId: customer.id,
        channelId,
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

    // Mijozga Telegram orqali tasdiqlash xabari — fonda, kutmaymiz
    if (customer.telegramUserId) {
      const totalStr = tenant.currency === "UZS"
        ? `${total.toLocaleString("uz-UZ")} so'm`
        : `${total} ${tenant.currency}`;
      const text =
        `🆕 <b>Buyurtmangiz qabul qilindi!</b>\n\n` +
        `Buyurtma: <b>#${order.code}</b>\n` +
        `Summa: ${totalStr}\n\n` +
        `Tez orada operatorimiz siz bilan bog'lanadi.`;
      notifyCustomer(app.prisma, tenant.id, customer.id, text)
        .catch((err) => app.log.warn({ err, orderId: order.id }, "Checkout TG notify failed"));
    }

    return reply.code(201).send({
      id: order.id,
      code: order.code,
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
  // GET /api/storefront/:tenantSlug/profile?tgUserId=12345&firstName=...&lastName=...&username=...
  const profileQuerySchema = z.object({
    tgUserId: z.coerce.number().int().positive(),
    firstName: z.string().max(80).optional(),
    lastName: z.string().max(80).optional(),
    username: z.string().max(80).optional(),
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

    // Birinchi marta — avto-ro'yxat (firstName/lastName Telegram'dan)
    if (!customer) {
      const displayName = [q.firstName, q.lastName].filter(Boolean).join(" ") || "Mijoz";
      customer = await app.prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: displayName,
          firstName: q.firstName ?? null,
          lastName: q.lastName ?? null,
          telegramUserId: tgId,
          telegramUsername: q.username ?? null,
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
    firstName: z.string().max(80).optional().nullable(),
    lastName: z.string().max(80).optional().nullable(),
    patronymic: z.string().max(80).optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
    gender: z.enum(["male", "female"]).optional().nullable().or(z.literal("")),
    language: z.enum(["uz", "ru"]).optional(),
  });
  app.patch("/:tenantSlug/profile", async (req, reply) => {
    const { tenantSlug } = z.object({ tenantSlug: z.string() }).parse(req.params);
    const data = profilePatchSchema.parse(req.body);

    const tenant = await app.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    if (!tenant) return reply.code(404).send({ error: "Do'kon topilmadi" });

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
