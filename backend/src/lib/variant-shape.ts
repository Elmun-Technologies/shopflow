// Mahsulot variantlari — umumiy qoidalar.
//
// Marketplace mantiqi: bitta mahsulot kartasi, ichida bir nechta variant
// (50 gr / 1 kg / 5 kg, rang, …). Bu fayl **yagona haqiqat manbai** — narx,
// zaxira va standart variant tanlash qoidalari storefront, admin, public API
// va bot uchun bir xil bo'lishi shart, aks holda kartada bir narx, PDP'da
// boshqa narx ko'rinadi.
//
// Asosiy qoidalar:
//   • Varianti yo'q mahsulot avvalgidek `Product.price` / `Product.stock` bilan
//     ishlaydi — hech qanday migratsiya kerak emas.
//   • Variant bo'lsa: karta narxi = **eng arzon sotib olinadigan** variant,
//     zaxira = aktiv variantlar yig'indisi.
//   • PDP ochilganda **eng arzon, zaxirada bor** variant tanlangan bo'ladi.
//     Hammasi tugagan bo'lsa — shunchaki eng arzoni (mijoz narxni ko'rsin).

import { z } from "zod";

// ─── Kontrakt ───────────────────────────────────────────────────────────────

export const localizedTextSchema = z.object({
  uz: z.string().max(200).default(""),
  ru: z.string().max(200).default(""),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

/** Bitta o'q qiymati — "1 kg", "Qora". */
export const optionValueSchema = z.object({
  /** Barqaror kalit — variantlarning `optionValues` ida ishlatiladi */
  id: z.string().min(1).max(40),
  label: localizedTextSchema,
});

/** O'q — "Hajm", "Rang". */
export const productOptionSchema = z.object({
  id: z.string().min(1).max(40),
  name: localizedTextSchema,
  values: z.array(optionValueSchema).min(1).max(40),
});
export type ProductOption = z.infer<typeof productOptionSchema>;

/** Mahsulotning o'qlari. Bo'sh massiv — variantsiz oddiy mahsulot. */
export const productOptionsSchema = z.array(productOptionSchema).max(3).default([]);

/** Variantga xos xarakteristika qatori. */
export const variantAttributeSchema = z.object({
  label: localizedTextSchema,
  value: localizedTextSchema,
});
export const variantAttributesSchema = z.array(variantAttributeSchema).max(30).default([]);
export type VariantAttribute = z.infer<typeof variantAttributeSchema>;

// ─── Runtime shakllar ───────────────────────────────────────────────────────

/** DB'dan o'qilgan variant (Decimal → number aylantirilgan). */
export interface VariantLike {
  id: string;
  sku: string;
  name: string;
  optionValues: Record<string, string>;
  price: number;
  oldPrice: number | null;
  stock: number;
  active: boolean;
  images: string[];
  attributes: VariantAttribute[];
  sortOrder: number;
}

export interface ProductLike {
  price: number;
  oldPrice?: number | null;
  stock: number;
  images?: string[];
  imageUrl?: string | null;
}

/** Mahsulot kartasi uchun hisoblangan qiymatlar. */
export interface ProductPricing {
  /** Kartada ko'rsatiladigan narx */
  price: number;
  oldPrice: number | null;
  /** Sotib olish mumkin bo'lgan umumiy zaxira */
  stock: number;
  /** Variantlar narxi turlichami — kartada "… dan" ko'rsatish uchun */
  priceVaries: boolean;
  /** Eng qimmat variant (diapazon ko'rsatish uchun) */
  maxPrice: number;
  variantCount: number;
}

// ─── Hisoblash ──────────────────────────────────────────────────────────────

/** Sotib olinadigan variantlar — aktiv va zaxirada bor. */
export function purchasableVariants(variants: VariantLike[]): VariantLike[] {
  return variants.filter((v) => v.active && v.stock > 0);
}

/** Ko'rsatiladigan variantlar — aktiv (zaxirasi tugagani ham ko'rinadi, lekin o'chirilgani yo'q). */
export function visibleVariants(variants: VariantLike[]): VariantLike[] {
  return [...variants]
    .filter((v) => v.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price);
}

/**
 * PDP ochilganda tanlangan bo'ladigan variant: **eng arzon, zaxirada bor**.
 * Hammasi tugagan bo'lsa — eng arzoni (narx baribir ko'rinsin).
 * Aktiv variant umuman bo'lmasa — null.
 */
export function defaultVariant(variants: VariantLike[]): VariantLike | null {
  const visible = visibleVariants(variants);
  if (visible.length === 0) return null;
  const inStock = visible.filter((v) => v.stock > 0);
  const pool = inStock.length > 0 ? inStock : visible;
  return pool.reduce((cheapest, v) => (v.price < cheapest.price ? v : cheapest), pool[0]);
}

/**
 * Kartada ko'rsatiladigan narx va zaxira.
 *
 * Variant yo'q bo'lsa mahsulotning o'z qiymatlari qaytadi — mavjud ekranlar
 * hech qanday o'zgarishsiz ishlayveradi.
 */
export function productPricing(product: ProductLike, variants: VariantLike[]): ProductPricing {
  const visible = visibleVariants(variants);

  if (visible.length === 0) {
    return {
      price: product.price,
      oldPrice: product.oldPrice ?? null,
      stock: product.stock,
      priceVaries: false,
      maxPrice: product.price,
      variantCount: 0,
    };
  }

  // Narx eng arzon **sotib olinadigan** variantdan — mijoz ko'rgan narxni
  // haqiqatda sotib ololsin. Hammasi tugagan bo'lsa umumiy eng arzoni.
  const anchor = defaultVariant(visible)!;
  const prices = visible.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  return {
    price: anchor.price,
    oldPrice: anchor.oldPrice ?? null,
    stock: visible.reduce((sum, v) => sum + Math.max(0, v.stock), 0),
    priceVaries: minPrice !== maxPrice,
    maxPrice,
    variantCount: visible.length,
  };
}

/** Variant rasmlari bo'lmasa mahsulot rasmlariga tushadi. */
export function variantImages(product: ProductLike, variant: VariantLike | null): string[] {
  if (variant && variant.images.length > 0) return variant.images;
  const fallback = [product.imageUrl, ...(product.images ?? [])].filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  return [...new Set(fallback)];
}

/**
 * `optionValues` dan ko'rinadigan nom yig'adi ("Qora / XL").
 * Variant `name` i bo'sh bo'lganda ishlatiladi.
 */
export function buildVariantLabel(
  options: ProductOption[],
  optionValues: Record<string, string>,
  lang: "uz" | "ru" = "uz",
): string {
  const parts: string[] = [];
  for (const opt of options) {
    const valueId = optionValues[opt.id];
    if (!valueId) continue;
    const value = opt.values.find((v) => v.id === valueId);
    if (!value) continue;
    parts.push(value.label[lang]?.trim() || value.label.uz?.trim() || value.label.ru?.trim() || valueId);
  }
  return parts.join(" / ");
}

/**
 * Variantlar o'qlarga mos kelishini tekshiradi — admin saqlashdan oldin.
 * Xato matnlari admin panelida ko'rsatiladi.
 */
export function validateVariants(
  options: ProductOption[],
  variants: Array<{ sku: string; optionValues: Record<string, string>; name: string }>,
): string[] {
  const errors: string[] = [];

  if (variants.length === 0) return errors;

  if (options.length === 0) {
    errors.push("Variantlar bor, lekin o'q (Hajm, Rang…) belgilanmagan");
    return errors;
  }

  const optionIds = new Set(options.map((o) => o.id));
  if (optionIds.size !== options.length) errors.push("O'q ID'lari takrorlangan");

  const seenSku = new Set<string>();
  const seenCombo = new Set<string>();

  for (const v of variants) {
    const sku = v.sku.trim();
    if (!sku) {
      errors.push(`"${v.name || "?"}" variantida artikul (SKU) yo'q`);
    } else if (seenSku.has(sku.toLowerCase())) {
      errors.push(`Artikul takrorlangan: "${sku}"`);
    } else {
      seenSku.add(sku.toLowerCase());
    }

    // Har bir o'q uchun qiymat bo'lishi shart, aks holda tanlagich ishlamaydi
    const parts: string[] = [];
    for (const opt of options) {
      const valueId = v.optionValues[opt.id];
      if (!valueId) {
        errors.push(`"${v.name || sku}" variantida "${opt.name.uz || opt.name.ru || opt.id}" tanlanmagan`);
        continue;
      }
      if (!opt.values.some((val) => val.id === valueId)) {
        errors.push(`"${v.name || sku}" variantida noma'lum qiymat: "${valueId}"`);
        continue;
      }
      parts.push(`${opt.id}=${valueId}`);
    }

    if (parts.length === options.length) {
      const combo = parts.join("&");
      if (seenCombo.has(combo)) {
        errors.push(`Bir xil kombinatsiyali ikkita variant: "${v.name || sku}"`);
      }
      seenCombo.add(combo);
    }
  }

  return errors;
}

// ─── DB qatoridan runtime shaklga ───────────────────────────────────────────

/** Prisma qatorini (Decimal, Json) runtime shaklga aylantiradi. */
export function toVariantLike(row: {
  id: string;
  sku: string;
  name: string;
  optionValues: unknown;
  price: unknown;
  oldPrice: unknown;
  stock: number;
  active: boolean;
  images: string[];
  attributes: unknown;
  sortOrder: number;
}): VariantLike {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    optionValues: (row.optionValues ?? {}) as Record<string, string>,
    price: Number(row.price ?? 0),
    oldPrice: row.oldPrice === null || row.oldPrice === undefined ? null : Number(row.oldPrice),
    stock: row.stock,
    active: row.active,
    images: row.images ?? [],
    attributes: Array.isArray(row.attributes) ? (row.attributes as VariantAttribute[]) : [],
    sortOrder: row.sortOrder,
  };
}

/** `Product.options` JSON'ini xavfsiz o'qiydi — buzuq bo'lsa bo'sh massiv. */
export function parseOptions(raw: unknown): ProductOption[] {
  const parsed = productOptionsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}
