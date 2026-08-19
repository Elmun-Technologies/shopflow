import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { logAudit } from "../lib/audit.js";
import { pushProductToSD } from "../lib/salesdoctor-push.js";
import { uniqueCategorySlug, uniqueProductSku, uniqueProductSlug } from "../lib/slug.js";
import {
  buildVariantLabel,
  parseOptions,
  productOptionsSchema,
  productPricing,
  toVariantLike,
  validateVariants,
  variantAttributesSchema,
} from "../lib/variant-shape.js";
import { parsePriceTiers, priceTiersSchema, validatePriceTiers } from "../lib/price-tier.js";

const variantInSchema = z.object({
  /** Mavjud variantni yangilash uchun. Bo'sh — yangi variant. */
  id: z.string().optional(),
  sku: z.string().min(1).max(60),
  /** Bo'sh bo'lsa o'q qiymatlaridan yig'iladi ("1 kg", "Qora / XL") */
  name: z.string().max(120).optional(),
  optionValues: z.record(z.string().max(40)).default({}),
  price: z.number().nonnegative(),
  oldPrice: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().default(0),
  active: z.boolean().default(true),
  images: z.array(z.string().max(500)).max(12).default([]),
  attributes: variantAttributesSchema.optional(),
  sortOrder: z.number().int().default(0),
});

/** Excel/CSV import va forma "14,500,000" / "14 500" ni ham qabul qiladi. */
const coerceMoney = z.preprocess((v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[\s,]/g, ""));
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().nonnegative());

const coerceStock = z.preprocess((v) => {
  if (typeof v === "string") {
    const n = Number(v.replace(/[\s,]/g, ""));
    return Number.isFinite(n) ? Math.trunc(n) : v;
  }
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  return v;
}, z.number().int().nonnegative());

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const productSchema = z.object({
  // Bo'sh SKU — nomdan avto-generatsiya. Import ko'pincha artikulsiz keladi.
  sku: z.preprocess(emptyToUndef, z.string().min(1).max(60).optional()),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  price: coerceMoney,
  oldPrice: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    coerceMoney.nullable().optional(),
  ),
  currency: z.string().default("UZS"),
  stock: coerceStock.optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  // Local upload paths ("/uploads/...") yoki absolute URL — har ikkalasi ham qabul
  imageUrl: z.string().max(500).optional().nullable(),
  images: z.array(z.string().max(500)).optional(),
  categoryId: z.string().optional().nullable(),
  // Public API (v1) maydonlari — ixtiyoriy. slug bo'sh bo'lsa name'dan generatsiya.
  slug: z.preprocess(emptyToUndef, z.string().max(80).regex(/^[a-z0-9-]+$/).optional()),
  origin: z.string().max(60).optional().nullable(),
  content: z.unknown().optional().nullable(),
  // Variant o'qlari (Hajm / Rang / …). Bo'sh massiv — variantsiz mahsulot.
  options: productOptionsSchema.optional(),
  // Variantlar. `id` berilgan bo'lsa mavjudi yangilanadi, aks holda yangisi
  // yaratiladi. Ro'yxatda yo'q variantlar o'chiriladi.
  variants: z.array(variantInSchema).max(100).optional(),
  // B2B narx pog'onalari (hajm bo'yicha) + MOQ + o'lchov birligi.
  priceTiers: priceTiersSchema.optional(),
  moq: z.number().int().positive().max(10_000_000).nullable().optional(),
  unit: z.string().max(16).nullable().optional(),
});

// content (ixtiyoriy JSON) ni Prisma input'ga keltirish.
// - undefined  → maydonga tegilmaydi (patch'da o'zgarmaydi)
// - null       → JSON NULL (admin kontentni tozalaganda). Prisma nullable Json
//                maydoni uchun JS `null` emas, `Prisma.JsonNull` talab qiladi.
function toJsonInput(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (v === undefined) return undefined;
  if (v === null) return Prisma.JsonNull;
  return v as Prisma.InputJsonValue;
}

const LOW_STOCK_THRESHOLD = 5; // Dashboard LowStockAlert bilan bir xil

type VariantInput = z.infer<typeof variantInSchema>;

const VARIANT_SELECT = {
  id: true, sku: true, name: true, optionValues: true, price: true, oldPrice: true,
  stock: true, active: true, images: true, attributes: true, sortOrder: true,
} as const;

/**
 * Variantlarni mahsulotga moslashtiradi: berilganini yaratadi/yangilaydi,
 * ro'yxatda yo'qini o'chiradi.
 *
 * **O'chirish o'rniga yangilash** muhim: `OrderItem.variantId` variantga ishora
 * qiladi, delete-then-create qilinsa buyurtma tarixi variantdan uziladi.
 * Shuning uchun `id` bo'yicha upsert qilinadi.
 */
async function syncVariants(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productId: string,
  options: ReturnType<typeof parseOptions>,
  variants: VariantInput[],
): Promise<void> {
  const existing = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((v) => v.id));
  const keepIds = new Set(variants.map((v) => v.id).filter((id): id is string => Boolean(id)));

  const staleIds = [...existingIds].filter((id) => !keepIds.has(id));
  if (staleIds.length) {
    await tx.productVariant.deleteMany({ where: { id: { in: staleIds }, productId } });
  }

  for (const [index, v] of variants.entries()) {
    const label = v.name?.trim() || buildVariantLabel(options, v.optionValues) || v.sku;
    const data = {
      sku: v.sku.trim(),
      name: label.slice(0, 120),
      optionValues: v.optionValues as Prisma.InputJsonValue,
      price: v.price,
      oldPrice: v.oldPrice ?? null,
      stock: v.stock,
      active: v.active,
      images: v.images,
      attributes: (v.attributes ?? []) as unknown as Prisma.InputJsonValue,
      sortOrder: v.sortOrder || index,
    };

    if (v.id && existingIds.has(v.id)) {
      await tx.productVariant.update({ where: { id: v.id }, data });
    } else {
      await tx.productVariant.create({ data: { ...data, productId, tenantId } });
    }
  }
}

/** Ro'yxat/detal javobiga hisoblangan narx va zaxirani qo'shadi. */
function withPricing<T extends { price: unknown; oldPrice: unknown; stock: number; imageUrl?: string | null; images?: string[] }>(
  product: T,
  variantRows: Array<Parameters<typeof toVariantLike>[0]>,
) {
  const variants = variantRows.map(toVariantLike);
  const pricing = productPricing(
    {
      price: Number(product.price ?? 0),
      oldPrice: product.oldPrice === null || product.oldPrice === undefined ? null : Number(product.oldPrice),
      stock: product.stock,
      imageUrl: product.imageUrl ?? null,
      images: product.images ?? [],
    },
    variants,
  );
  return { ...product, variants, pricing };
}

const listQuery = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  // Ko'rinish holati: barchasi / faol (sotuvda) / yashirin
  status: z.enum(["all", "active", "inactive"]).default("all"),
  // Zaxira holati: barchasi / kam qolgan (<5, 0 ni ham) / tugagan (0)
  stock: z.enum(["all", "low", "out"]).default("all"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const q = listQuery.parse(req.query);
    const where = {
      tenantId: req.session.tenantId,
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(q.status === "active" && { active: true }),
      ...(q.status === "inactive" && { active: false }),
      ...(q.stock === "low" && { stock: { lt: LOW_STOCK_THRESHOLD } }),
      ...(q.stock === "out" && { stock: { lte: 0 } }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: "insensitive" as const } },
          { sku: { contains: q.search, mode: "insensitive" as const } },
        ],
      }),
    };
    const [total, items] = await Promise.all([
      app.prisma.product.count({ where }),
      app.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          variants: { select: VARIANT_SELECT, orderBy: { sortOrder: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    // Kartadagi narx/zaxira variantlardan hisoblanadi — ro'yxat va PDP bir xil
    // qiymatni ko'rsatishi uchun (variantsiz mahsulotda hech nima o'zgarmaydi).
    const withDerived = items.map(({ variants, ...p }) => withPricing(p, variants));
    return { total, page: q.page, pageSize: q.pageSize, items: withDerived };
  });

  app.post("/", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const data = productSchema.parse(req.body);
    const { content, options, variants, priceTiers, ...rest } = data;
    const tenantId = req.session.tenantId;

    const parsedOptions = parseOptions(options ?? []);
    const variantErrors = validateVariants(parsedOptions, (variants ?? []).map((v) => ({
      sku: v.sku, name: v.name ?? "", optionValues: v.optionValues,
    })));
    if (variantErrors.length) {
      return reply.code(400).send({ error: "Variantlarda xato", issues: variantErrors });
    }
    if (priceTiers) {
      const tierErrors = validatePriceTiers(priceTiers);
      if (tierErrors.length) return reply.code(400).send({ error: "Narx pog'onalarida xato", issues: tierErrors });
    }

    const sku = data.sku?.trim()
      ? data.sku.trim()
      : await uniqueProductSku(app.prisma, tenantId, data.name);
    if (data.sku?.trim()) {
      const clash = await app.prisma.product.findFirst({
        where: { tenantId, sku },
        select: { id: true },
      });
      if (clash) return reply.code(409).send({ error: "Bu SKU allaqachon mavjud" });
    }

    const slug = await uniqueProductSlug(app.prisma, tenantId, data.slug || data.name);
    const created = await app.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...rest,
          sku,
          description: data.description || null,
          stock: data.stock ?? 0,
          slug,
          imageUrl: data.imageUrl || null,
          oldPrice: data.oldPrice ?? null,
          categoryId: data.categoryId || null,
          origin: data.origin || null,
          content: toJsonInput(content ?? undefined),
          options: parsedOptions as unknown as Prisma.InputJsonValue,
          // Pog'onalarni saralab saqlaymiz — narx hisoblash tartibga tayanadi
          ...(priceTiers !== undefined && { priceTiers: parsePriceTiers(priceTiers) as unknown as Prisma.InputJsonValue }),
          tenantId,
        },
      });
      if (variants?.length) {
        await syncVariants(tx, tenantId, product.id, parsedOptions, variants);
      }
      return product;
    });
    const actor = await app.prisma.user.findUnique({ where: { id: req.session.userId }, select: { name: true } });
    await logAudit({
      prisma: app.prisma,
      tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "CREATE",
      resourceType: "product",
      resourceId: created.id,
      summary: `Mahsulot yaratildi: ${created.name}${variants?.length ? ` (${variants.length} variant)` : ""}`,
    });
    pushProductToSD(app.prisma, tenantId, created.id)
      .catch((err) => app.log.warn({ err, productId: created.id }, "SD push failed"));
    const full = await app.prisma.product.findFirstOrThrow({
      where: { id: created.id },
      include: { variants: { select: VARIANT_SELECT, orderBy: { sortOrder: "asc" } } },
    });
    const { variants: createdVariants, ...createdRest } = full;
    return withPricing(createdRest, createdVariants);
  });

  // CSV/Excel paste import — kategoriya avto-yaratiladi, SKU ixtiyoriy,
  // mavjud SKU yangilanadi (katalogni qayta yuklash).
  const importItemSchema = z.object({
    sku: z.preprocess(emptyToUndef, z.string().min(1).max(60).optional()),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    price: coerceMoney,
    oldPrice: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : v),
      coerceMoney.nullable().optional(),
    ),
    stock: coerceStock.optional().default(0),
    categoryName: z.string().max(80).optional().nullable(),
    categoryId: z.string().optional().nullable(),
    active: z.boolean().optional().default(true),
    featured: z.boolean().optional().default(false),
  });
  const importSchema = z.object({
    items: z.array(importItemSchema).min(1).max(500),
    updateExisting: z.boolean().optional().default(true),
  });

  app.post(
    "/import",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req) => {
      const body = importSchema.parse(req.body);
      const tenantId = req.session.tenantId;
      const tenant = await app.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { currency: true },
      });
      const currency = tenant?.currency ?? "UZS";

      const categories = await app.prisma.category.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      });
      const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));

      const results: Array<{
        row: number;
        ok: boolean;
        action?: "created" | "updated";
        id?: string;
        sku?: string;
        error?: string;
      }> = [];
      let created = 0;
      let updated = 0;
      let categoriesCreated = 0;

      const resolveCategory = async (name: string | null | undefined, id: string | null | undefined) => {
        if (id) return id;
        const trimmed = name?.trim();
        if (!trimmed) return null;
        const key = trimmed.toLowerCase();
        const existing = catByName.get(key);
        if (existing) return existing;
        const slug = await uniqueCategorySlug(app.prisma, tenantId, trimmed);
        const cat = await app.prisma.category.create({
          data: { tenantId, name: trimmed.slice(0, 80), slug },
        });
        catByName.set(key, cat.id);
        categoriesCreated += 1;
        return cat.id;
      };

      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        try {
          const categoryId = await resolveCategory(item.categoryName, item.categoryId);
          const givenSku = item.sku?.trim();
          const existing = givenSku
            ? await app.prisma.product.findFirst({
                where: { tenantId, sku: givenSku },
                select: { id: true },
              })
            : null;

          if (existing && body.updateExisting) {
            await app.prisma.product.update({
              where: { id: existing.id },
              data: {
                name: item.name,
                description: item.description || null,
                price: item.price,
                oldPrice: item.oldPrice ?? null,
                stock: item.stock ?? 0,
                categoryId,
                active: item.active,
                featured: item.featured,
              },
            });
            updated += 1;
            results.push({ row: i + 1, ok: true, action: "updated", id: existing.id, sku: givenSku });
            continue;
          }

          const sku = existing && !body.updateExisting
            ? await uniqueProductSku(app.prisma, tenantId, givenSku || item.name)
            : givenSku || (await uniqueProductSku(app.prisma, tenantId, item.name));
          const slug = await uniqueProductSlug(app.prisma, tenantId, item.name);
          const product = await app.prisma.product.create({
            data: {
              tenantId,
              sku,
              name: item.name,
              description: item.description || null,
              price: item.price,
              oldPrice: item.oldPrice ?? null,
              stock: item.stock ?? 0,
              currency,
              categoryId,
              active: item.active,
              featured: item.featured,
              slug,
              source: "MANUAL",
            },
          });
          created += 1;
          results.push({ row: i + 1, ok: true, action: "created", id: product.id, sku: product.sku });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Yaratib bo'lmadi";
          results.push({ row: i + 1, ok: false, error: message });
        }
      }

      const actor = await app.prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { name: true },
      });
      await logAudit({
        prisma: app.prisma,
        tenantId,
        actorId: req.session.userId,
        actorName: actor?.name ?? null,
        action: "IMPORT",
        resourceType: "product",
        resourceId: results.find((r) => r.id)?.id ?? tenantId,
        summary: `Import: ${created} yaratildi, ${updated} yangilandi, ${body.items.length - created - updated} xato`,
        changes: { created, updated, failed: body.items.length - created - updated, categoriesCreated },
      });

      return {
        created,
        updated,
        failed: body.items.length - created - updated,
        categoriesCreated,
        results,
        summary: `${created} ta yaratildi, ${updated} ta yangilandi`,
      };
    },
  );

  app.patch("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = productSchema.partial().parse(req.body);
    const product = await app.prisma.product.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!product) return reply.code(404).send({ error: "Not found" });

    const { content, options, variants, priceTiers, ...rest } = data;

    if (priceTiers) {
      const tierErrors = validatePriceTiers(priceTiers);
      if (tierErrors.length) return reply.code(400).send({ error: "Narx pog'onalarida xato", issues: tierErrors });
    }

    // O'qlar berilmasa mavjudi qoladi — variantlar ularga solishtiriladi
    const parsedOptions = options !== undefined ? parseOptions(options) : parseOptions(product.options);

    // Tekshiriladigan variantlar: yuborilganlari, yoki (faqat o'qlar
    // o'zgartirilayotgan bo'lsa) DB'dagi mavjudlari. Aks holda o'qdan qiymat
    // olib tashlansa, unga tayangan variantlar jimgina yaroqsiz bo'lib qolardi
    // va PDP tanlagichi ishlamay qo'yardi.
    const variantsToCheck = variants !== undefined
      ? variants.map((v) => ({ sku: v.sku, name: v.name ?? "", optionValues: v.optionValues }))
      : options !== undefined
        ? (await app.prisma.productVariant.findMany({
            where: { productId: id },
            select: { sku: true, name: true, optionValues: true },
          })).map((v) => ({
            sku: v.sku,
            name: v.name,
            optionValues: (v.optionValues ?? {}) as Record<string, string>,
          }))
        : [];

    if (variantsToCheck.length > 0) {
      const variantErrors = validateVariants(parsedOptions, variantsToCheck);
      if (variantErrors.length) {
        return reply.code(400).send({ error: "Variantlarda xato", issues: variantErrors });
      }
    }

    // Slug barqaror — rename'da o'zgartirmaymiz. Faqat aniq berilsa yoki
    // mahsulotda hali slug bo'lmasa (legacy) generatsiya qilamiz.
    let slug: string | undefined;
    if (data.slug !== undefined) {
      slug = await uniqueProductSlug(app.prisma, req.session.tenantId, data.slug, id);
    } else if (!product.slug) {
      slug = await uniqueProductSlug(app.prisma, req.session.tenantId, data.name ?? product.name, id);
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { id, tenantId: req.session.tenantId },
        data: {
          ...rest,
          ...(slug !== undefined && { slug }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId || null }),
          ...(data.origin !== undefined && { origin: data.origin || null }),
          ...(content !== undefined && { content: toJsonInput(content) }),
          ...(options !== undefined && { options: parsedOptions as unknown as Prisma.InputJsonValue }),
          ...(priceTiers !== undefined && { priceTiers: parsePriceTiers(priceTiers) as unknown as Prisma.InputJsonValue }),
        },
      });
      if (variants !== undefined) {
        await syncVariants(tx, req.session.tenantId, id, parsedOptions, variants);
      }
    });
    const updated = await app.prisma.product.findFirstOrThrow({
      where: { id, tenantId: req.session.tenantId },
      include: { variants: { select: VARIANT_SELECT, orderBy: { sortOrder: "asc" } } },
    });
    const actor = await app.prisma.user.findUnique({ where: { id: req.session.userId }, select: { name: true } });
    const changedKeys = (Object.keys(data) as Array<keyof typeof data>).filter((k) => data[k] !== undefined);
    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "UPDATE",
      resourceType: "product",
      resourceId: id,
      summary: `Tahrirlandi: ${changedKeys.length ? changedKeys.join(", ") : "—"}`,
    });
    pushProductToSD(app.prisma, req.session.tenantId, id)
      .catch((err) => app.log.warn({ err, productId: id }, "SD push failed"));
    const { variants: updatedVariants, ...updatedRest } = updated;
    return withPricing(updatedRest, updatedVariants);
  });

  // Bulk operations — admin tomondan ko'p mahsulotni bir vaqtda boshqarish
  // Hozir qo'llab-quvvatlangan: delete | setCategory | toggleActive | toggleFeatured
  const bulkSchema = z.object({
    ids: z.array(z.string()).min(1).max(500),
    action: z.enum(["delete", "setCategory", "setActive", "setFeatured"]),
    categoryId: z.string().nullable().optional(),
    value: z.boolean().optional(),
  });
  app.post(
    "/bulk",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const data = bulkSchema.parse(req.body);
      // tenant scope tekshiruvi — boshqa tenant mahsulotlariga ta'sir qilmaslik
      const owned = await app.prisma.product.findMany({
        where: { id: { in: data.ids }, tenantId: req.session.tenantId },
        select: { id: true, name: true },
      });
      const ownedIds = owned.map((p) => p.id);
      if (ownedIds.length === 0) return { affected: 0 };

      const actor = await app.prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { name: true },
      });

      let affected = 0;
      let summary = "";

      if (data.action === "delete") {
        const res = await app.prisma.product.deleteMany({
          where: { id: { in: ownedIds }, tenantId: req.session.tenantId },
        });
        affected = res.count;
        summary = `${affected} ta mahsulot o'chirildi`;
      } else if (data.action === "setCategory") {
        const res = await app.prisma.product.updateMany({
          where: { id: { in: ownedIds }, tenantId: req.session.tenantId },
          data: { categoryId: data.categoryId || null },
        });
        affected = res.count;
        const catName = data.categoryId
          ? (await app.prisma.category.findUnique({ where: { id: data.categoryId }, select: { name: true } }))?.name ?? "?"
          : "Kategoriyasiz";
        summary = `${affected} ta mahsulot kategoriyasi → ${catName}`;
      } else if (data.action === "setActive") {
        const res = await app.prisma.product.updateMany({
          where: { id: { in: ownedIds }, tenantId: req.session.tenantId },
          data: { active: data.value ?? false },
        });
        affected = res.count;
        summary = `${affected} ta mahsulot ${data.value ? "yoqildi" : "o'chirildi (active)"}`;
      } else if (data.action === "setFeatured") {
        const res = await app.prisma.product.updateMany({
          where: { id: { in: ownedIds }, tenantId: req.session.tenantId },
          data: { featured: data.value ?? false },
        });
        affected = res.count;
        summary = `${affected} ta mahsulot ${data.value ? "Vitrina'ga" : "Vitrina'dan"} qo'yildi/olindi`;
      }

      // Audit yozuvi — bitta umumiy bulk yozuv (har bir mahsulot uchun emas, log spam'ga aylanmasin)
      await logAudit({
        prisma: app.prisma,
        tenantId: req.session.tenantId,
        actorId: req.session.userId,
        actorName: actor?.name ?? null,
        action: "BULK_" + data.action.toUpperCase(),
        resourceType: "product",
        resourceId: ownedIds[0],
        summary,
        changes: { ids: ownedIds, action: data.action, value: data.value, categoryId: data.categoryId },
      });

      return reply.send({ affected, summary });
    },
  );

  app.delete("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const product = await app.prisma.product.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!product) return reply.code(404).send({ error: "Not found" });
    await app.prisma.product.deleteMany({ where: { id, tenantId: req.session.tenantId } });
    const actor = await app.prisma.user.findUnique({ where: { id: req.session.userId }, select: { name: true } });
    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "DELETE",
      resourceType: "product",
      resourceId: id,
      summary: `Mahsulot o'chirildi: ${product.name}`,
    });
    return { ok: true };
  });

  // Restock — kam qolgan mahsulot uchun tezkor stok qo'shish.
  // Mavjud stockka qo'shadi (set emas, add). Audit log'da kim, qancha, sabab.
  const restockSchema = z.object({
    quantity: z.number().int().positive().max(100_000),
    note: z.string().max(500).optional(),
    /** Variantli mahsulotda aynan qaysi variantga qo'shiladi */
    variantId: z.string().optional(),
  });
  app.post(
    "/:id/restock",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const data = restockSchema.parse(req.body);
      const product = await app.prisma.product.findFirst({
        where: { id, tenantId: req.session.tenantId },
      });
      if (!product) return reply.code(404).send({ error: "Not found" });

      // Variantli mahsulotda zaxira variantda turadi — mahsulot ustunini
      // oshirish mijozga ko'rinmaydi va noto'g'ri ma'lumot beradi.
      if (data.variantId) {
        const variant = await app.prisma.productVariant.findFirst({
          where: { id: data.variantId, productId: id, tenantId: req.session.tenantId },
        });
        if (!variant) return reply.code(404).send({ error: "Variant topilmadi" });

        const updatedVariant = await app.prisma.productVariant.update({
          where: { id: variant.id },
          data: { stock: { increment: data.quantity } },
        });

        const variantActor = await app.prisma.user.findUnique({
          where: { id: req.session.userId },
          select: { name: true },
        });
        await logAudit({
          prisma: app.prisma,
          tenantId: req.session.tenantId,
          actorId: req.session.userId,
          actorName: variantActor?.name ?? null,
          action: "RESTOCK",
          resourceType: "product",
          resourceId: id,
          summary: `Stok qo'shildi (${variant.name}): +${data.quantity} (${variant.stock} → ${updatedVariant.stock})${data.note ? ` — ${data.note}` : ""}`,
          changes: {
            variantId: variant.id, variantName: variant.name,
            from: variant.stock, to: updatedVariant.stock, added: data.quantity, note: data.note ?? null,
          },
        });

        return { id, variantId: updatedVariant.id, stock: updatedVariant.stock, added: data.quantity };
      }

      const variantCount = await app.prisma.productVariant.count({ where: { productId: id } });
      if (variantCount > 0) {
        return reply.code(400).send({
          error: "Bu mahsulotda variantlar bor — qaysi variantga qo'shilishini tanlang",
        });
      }

      const updated = await app.prisma.product.update({
        where: { id },
        data: { stock: { increment: data.quantity } },
      });

      const actor = await app.prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { name: true },
      });
      await logAudit({
        prisma: app.prisma,
        tenantId: req.session.tenantId,
        actorId: req.session.userId,
        actorName: actor?.name ?? null,
        action: "RESTOCK",
        resourceType: "product",
        resourceId: id,
        summary: `Stok qo'shildi: +${data.quantity} (${product.stock} → ${updated.stock})${data.note ? ` — ${data.note}` : ""}`,
        changes: { from: product.stock, to: updated.stock, added: data.quantity, note: data.note ?? null },
      });

      return { id: updated.id, stock: updated.stock, added: data.quantity };
    },
  );

  // Duplicate — mavjud mahsulotdan nusxa (shablon sifatida). Boy kontent/rasm/narx
  // ko'chiriladi, lekin yangi nusxa QORALAMA bo'ladi: active=false, stock=0, yangi
  // SKU/slug. Tashqi sync id'lari (moysklad/salesDoctor) ko'chirilmaydi.
  app.post(
    "/:id/duplicate",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const tenantId = req.session.tenantId;
      const src = await app.prisma.product.findFirst({
        where: { id, tenantId },
        include: { variants: { orderBy: { sortOrder: "asc" } } },
      });
      if (!src) return reply.code(404).send({ error: "Not found" });

      // Unique SKU: "<sku>-COPY", band bo'lsa -COPY-2, -COPY-3 ...
      const skuRoot = `${src.sku}-COPY`.slice(0, 60);
      let newSku = skuRoot;
      for (let i = 2; ; i++) {
        const clash = await app.prisma.product.findFirst({
          where: { tenantId, sku: newSku },
          select: { id: true },
        });
        if (!clash) break;
        newSku = `${skuRoot}-${i}`.slice(0, 60);
      }
      const newName = `${src.name} (nusxa)`.slice(0, 200);
      const newSlug = await uniqueProductSlug(app.prisma, tenantId, src.slug ? `${src.slug}-copy` : newName);

      const created = await app.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            tenantId,
            sku: newSku,
            name: newName,
            slug: newSlug,
            description: src.description,
            price: src.price,
            oldPrice: src.oldPrice,
            currency: src.currency,
            stock: 0,
            active: false, // qoralama — operator ko'rib chiqib yoqadi
            featured: false,
            imageUrl: src.imageUrl,
            images: src.images,
            categoryId: src.categoryId,
            origin: src.origin,
            content: toJsonInput(src.content ?? undefined),
            options: (src.options ?? []) as Prisma.InputJsonValue,
            priceTiers: (src.priceTiers ?? []) as Prisma.InputJsonValue,
            moq: src.moq,
            unit: src.unit,
            saleCampaignId: src.saleCampaignId,
            source: "MANUAL",
          },
        });

        // Variantlar ham ko'chiriladi — nusxa shablon sifatida ishlatiladi.
        // Zaxira 0 (qoralama), tashqi sync id'lari ko'chirilmaydi.
        for (const [i, v] of src.variants.entries()) {
          await tx.productVariant.create({
            data: {
              productId: product.id,
              tenantId,
              sku: `${v.sku}-COPY${i === 0 ? "" : `-${i + 1}`}`.slice(0, 60),
              name: v.name,
              optionValues: v.optionValues as Prisma.InputJsonValue,
              price: v.price,
              oldPrice: v.oldPrice,
              stock: 0,
              active: v.active,
              images: v.images,
              attributes: v.attributes as Prisma.InputJsonValue,
              sortOrder: v.sortOrder,
            },
          });
        }
        return product;
      });

      const actor = await app.prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { name: true },
      });
      await logAudit({
        prisma: app.prisma,
        tenantId,
        actorId: req.session.userId,
        actorName: actor?.name ?? null,
        action: "DUPLICATE",
        resourceType: "product",
        resourceId: created.id,
        summary: `Mahsulot nusxalandi: ${src.name} → ${created.name}${src.variants.length ? ` (${src.variants.length} variant)` : ""}`,
        changes: { sourceId: src.id, newId: created.id, variants: src.variants.length },
      });
      return created;
    },
  );
};
