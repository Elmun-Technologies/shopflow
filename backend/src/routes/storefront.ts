// Public Storefront API — Mini App va web katalog uchun.
// Auth talab qilinmaydi. Tenant slug orqali topiladi.
// Bu endpointlar mijozlarga ko'rsatiladigan ma'lumotlarni qaytaradi.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

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

    const [storefront, products, categories] = await Promise.all([
      app.prisma.storefront.findUnique({
        where: { tenantId: tenant.id },
      }),
      app.prisma.product.findMany({
        where: { tenantId: tenant.id, active: true },
        include: { category: { select: { id: true, name: true, slug: true } } },
        orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      }),
      app.prisma.category.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: "asc" },
      }),
    ]);

    if (storefront && !storefront.published) {
      return reply.code(403).send({ error: "Do'kon yopiq" });
    }

    return {
      tenant,
      layout: storefront?.blocks ?? [],
      brand: storefront?.brand ?? {},
      products,
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

    // Mijozni topish yoki yaratish (telefon bo'yicha)
    let customer = await app.prisma.customer.findFirst({
      where: { tenantId: tenant.id, phone: data.customer.phone },
    });
    if (!customer) {
      customer = await app.prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: data.customer.name,
          phone: data.customer.phone,
          email: data.customer.email || null,
          notes: data.customer.notes,
        },
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

    return reply.code(201).send({
      id: order.id,
      code: order.code,
      total,
      currency: tenant.currency,
    });
  });
};
