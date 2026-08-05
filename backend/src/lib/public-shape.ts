// Public API (v1) javob shakllantiruvchilari.
import { parsePriceTiers } from "./price-tier.js";
// Tashqi mijoz websaytlari uchun BARQAROR kontrakt — bu yerdagi shakl
// docs/PUBLIC_API.md bilan mos kelishi shart.
//
// Qoidalar:
//  - Pul: butun son, so'mda (UZS), kasrsiz. currency doim string.
//  - Rasm URL: absolyut HTTPS.
//  - Til: GET'da locale tanlanadi; matn bitta string bo'lib qaytadi.
//  - Product.content (JSON) flat yoki per-locale ({uz,ru,en}) bo'lishi mumkin.

export type Locale = "uz" | "ru" | "en";
export const SUPPORTED_LOCALES: Locale[] = ["uz", "ru", "en"];
export const DEFAULT_LOCALE: Locale = "uz";

const PUBLIC_BASE =
  process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ??
  `https://${process.env.DOMAIN ?? "shop-flow.uz"}`;

/** Nisbiy yo'lni ("/uploads/x.jpg") absolyut HTTPS URL'ga aylantiradi. */
export function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path.replace(/^http:\/\//i, "https://");
  return `${PUBLIC_BASE}/${path.replace(/^\/+/, "")}`;
}

// ── Kichik coercion yordamchilari (content JSON ishonchsiz bo'lishi mumkin) ──
type Dict = Record<string, unknown>;
const isObj = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);
const asString = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asBool = (v: unknown, d = false): boolean => (typeof v === "boolean" ? v : d);
function asNumOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

/** content JSON'ni tanlangan locale uchun yassi obyektga keltiradi. */
export function localizeContent(content: unknown, locale: Locale): Dict {
  if (!isObj(content)) return {};
  const hasLocaleKeys = SUPPORTED_LOCALES.some((l) => l in content && isObj(content[l]));
  if (!hasLocaleKeys) return content; // flat
  const base = isObj(content[DEFAULT_LOCALE]) ? (content[DEFAULT_LOCALE] as Dict) : {};
  const picked = isObj(content[locale]) ? (content[locale] as Dict) : {};
  return { ...base, ...picked };
}

// ── Tiplar (kontrakt) ──
export interface ShapedImage { url: string; alt: string; }
export interface ShapedReview { author: string; rating: number; date: string; text: string; }

/** Mahsulot varianti (o'lcham / rang / …). Variantsiz mahsulotda bo'sh massiv. */
export interface ShapedVariant {
  id: string;
  sku: string;
  name: string;
  /** O'q qiymatlari: { "hajm": "1kg" } — `options` bilan mos */
  options: Record<string, string>;
  price: number;
  oldPrice?: number;
  inStock: boolean;
  images: ShapedImage[];
  attributes: { label: string; value: string }[];
}

/** Variant o'qi — tanlagich qurish uchun. */
export interface ShapedOption {
  id: string;
  name: string;
  values: { id: string; label: string }[];
}
export interface ShapedProduct {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  categoryId: string | null;
  categorySlug: string | null;
  price: number;
  oldPrice?: number;
  currency: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  images: ShapedImage[];
  highlights: string[];
  benefits: { icon?: string; title: string; description: string }[];
  ingredients: { name: string; amount: string; dailyValue?: string }[];
  howToUse: string;
  faq: { question: string; answer: string }[];
  reviews: ShapedReview[];
  badges: string[];
  servings?: number;
  origin?: string;
  bespoke: boolean;
  /** Variant o'qlari (Hajm, Rang). Variantsiz mahsulotda bo'sh. */
  options: ShapedOption[];
  /**
   * Variantlar — narx o'sish tartibida. Bo'sh bo'lsa mahsulot variantsiz va
   * yuqoridagi `price` / `inStock` ishlatiladi.
   * `price` esa har doim **eng arzon sotib olinadigan** variantdan olinadi.
   */
  variants: ShapedVariant[];
  /** B2B/ulgurji narx pog'onalari (hajm bo'yicha). Bo'sh — flat narx. */
  priceTiers: { minQty: number; price: number }[];
  /** Minimal buyurtma miqdori (MOQ). Yo'q bo'lsa null. */
  moq: number | null;
  /** O'lchov birligi ("kg" / "l" / "dona"). Yo'q bo'lsa null. */
  unit: string | null;
}

// Prisma'dan keladigan xom mahsulot (kerakli maydonlar bilan).
export interface RawProductForShape {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  price: unknown; // Prisma.Decimal
  oldPrice: unknown | null;
  currency: string;
  stock: number;
  imageUrl: string | null;
  images: string[];
  origin: string | null;
  content: unknown;
  categoryId: string | null;
  category?: { id: string; slug: string } | null;
  saleCampaign?: {
    label: string; active: boolean; startsAt: Date | null; endsAt: Date | null;
  } | null;
  /** Xom variant qatorlari (ixtiyoriy — variantsiz mahsulotda yo'q) */
  variants?: Array<{
    id: string; sku: string; name: string; optionValues: unknown;
    price: unknown; oldPrice: unknown | null; stock: number; active: boolean;
    images: string[]; attributes: unknown; sortOrder: number;
  }>;
  /** Xom `Product.options` JSON */
  options?: unknown;
  /** Xom `Product.priceTiers` JSON */
  priceTiers?: unknown;
  moq?: number | null;
  unit?: string | null;
}

export interface ShapeProductOpts {
  locale: Locale;
  rating: number;
  reviewCount: number;
  reviews?: ShapedReview[];
}

function buildImages(p: RawProductForShape, altName: string): ShapedImage[] {
  const urls = [p.imageUrl, ...(p.images ?? [])].filter((u): u is string => !!u);
  const seen = new Set<string>();
  const out: ShapedImage[] = [];
  for (const u of urls) {
    const abs = absoluteUrl(u);
    if (abs && !seen.has(abs)) {
      seen.add(abs);
      out.push({ url: abs, alt: altName });
    }
  }
  return out;
}

function campaignActive(c: RawProductForShape["saleCampaign"]): boolean {
  if (!c || !c.active) return false;
  const now = Date.now();
  if (c.startsAt && c.startsAt.getTime() > now) return false;
  if (c.endsAt && c.endsAt.getTime() < now) return false;
  return true;
}

function pickLocalized(v: unknown, locale: Locale): string {
  if (typeof v === "string") return v;
  if (!isObj(v)) return "";
  // Public API'da "en" bo'lmasa uz'ga tushamiz (variant matnlari uz/ru da)
  const order: string[] = locale === "en" ? ["uz", "ru"] : [locale, locale === "uz" ? "ru" : "uz"];
  for (const key of order) {
    const val = v[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return "";
}

function shapeVariants(p: RawProductForShape, locale: Locale, altName: string): ShapedVariant[] {
  const rows = (p.variants ?? []).filter((v) => v.active);
  return [...rows]
    .sort((a, b) => a.sortOrder - b.sortOrder || Number(a.price) - Number(b.price))
    .map((v) => {
      const oldPrice = v.oldPrice != null ? Math.round(Number(v.oldPrice)) : undefined;
      const images = v.images.length
        ? v.images
            .map((u) => absoluteUrl(u))
            .filter((u): u is string => Boolean(u))
            .map((url) => ({ url, alt: `${altName} — ${v.name}` }))
        : [];
      const attributes = asArray(v.attributes)
        .filter(isObj)
        .map((a) => ({ label: pickLocalized(a.label, locale), value: pickLocalized(a.value, locale) }))
        .filter((a) => a.label || a.value);

      return {
        id: v.id,
        sku: v.sku,
        name: v.name,
        options: isObj(v.optionValues) ? (v.optionValues as Record<string, string>) : {},
        price: Math.round(Number(v.price)),
        ...(oldPrice != null ? { oldPrice } : {}),
        inStock: v.stock > 0,
        images,
        attributes,
      };
    });
}

function shapeOptions(raw: unknown, locale: Locale): ShapedOption[] {
  return asArray(raw)
    .filter(isObj)
    .map((o) => ({
      id: asString(o.id),
      name: pickLocalized(o.name, locale),
      values: asArray(o.values)
        .filter(isObj)
        .map((v) => ({ id: asString(v.id), label: pickLocalized(v.label, locale) }))
        .filter((v) => v.id),
    }))
    .filter((o) => o.id && o.values.length > 0);
}

/** Mahsulotni public Product shakliga keltiradi (list ham, detail ham). */
export function shapeProduct(p: RawProductForShape, opts: ShapeProductOpts): ShapedProduct {
  const lc = localizeContent(p.content, opts.locale);
  const name = asString(lc.name) || p.name;

  const badges: string[] = [];
  if (campaignActive(p.saleCampaign) && p.saleCampaign?.label) badges.push(p.saleCampaign.label);
  for (const b of asArray(lc.badges)) if (typeof b === "string" && !badges.includes(b)) badges.push(b);

  const benefits = asArray(lc.benefits)
    .filter(isObj)
    .map((b) => {
      const icon = asString(b.icon);
      return { ...(icon ? { icon } : {}), title: asString(b.title), description: asString(b.description) };
    })
    .filter((b) => b.title || b.description);

  const ingredients = asArray(lc.ingredients)
    .filter(isObj)
    .map((g) => {
      const dailyValue = asString(g.dailyValue);
      return { name: asString(g.name), amount: asString(g.amount), ...(dailyValue ? { dailyValue } : {}) };
    })
    .filter((g) => g.name);

  const faq = asArray(lc.faq)
    .filter(isObj)
    .map((f) => ({ question: asString(f.question), answer: asString(f.answer) }))
    .filter((f) => f.question || f.answer);

  const highlights = asArray(lc.highlights).filter((h): h is string => typeof h === "string");

  const servings = asNumOrUndef(lc.servings);
  const origin = p.origin ?? (asString(lc.origin) || undefined);

  const variants = shapeVariants(p, opts.locale, name);
  const options = shapeOptions(p.options, opts.locale);

  // Variantli mahsulotda karta narxi eng arzon **sotib olinadigan** variantdan,
  // zaxira esa istalgan variantda tovar borligidan kelib chiqadi. Shu qoida
  // storefront va admin bilan bir xil (`lib/variant-shape.ts`).
  const purchasable = variants.filter((v) => v.inStock);
  const anchor = (purchasable.length ? purchasable : variants).reduce<ShapedVariant | null>(
    (cheapest, v) => (cheapest === null || v.price < cheapest.price ? v : cheapest),
    null,
  );

  const price = anchor ? anchor.price : Math.round(Number(p.price));
  const rawOldPrice = anchor ? anchor.oldPrice : p.oldPrice != null ? Number(p.oldPrice) : undefined;
  const oldPrice = rawOldPrice != null ? Math.round(rawOldPrice) : undefined;
  const inStock = variants.length > 0 ? variants.some((v) => v.inStock) : p.stock > 0;

  return {
    id: p.id,
    slug: p.slug ?? p.id, // slug yo'q bo'lsa id bilan addressable
    name,
    tagline: asString(lc.tagline),
    description: asString(lc.description) || p.description || "",
    categoryId: p.categoryId,
    categorySlug: p.category?.slug ?? null,
    price,
    ...(oldPrice != null ? { oldPrice } : {}),
    currency: p.currency,
    rating: Math.round(opts.rating * 10) / 10,
    reviewCount: opts.reviewCount,
    inStock,
    images: buildImages(p, name),
    highlights,
    benefits,
    ingredients,
    howToUse: asString(lc.howToUse),
    faq,
    reviews: opts.reviews ?? [],
    badges,
    ...(servings != null ? { servings } : {}),
    ...(origin ? { origin } : {}),
    bespoke: asBool(lc.bespoke),
    options,
    variants,
    priceTiers: parsePriceTiers(p.priceTiers),
    moq: p.moq ?? null,
    unit: p.unit ?? null,
  };
}

// ── Kategoriya ──
export interface ShapedCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  image?: string;
  productCount?: number;
}
export function shapeCategory(
  c: { id: string; slug: string; name: string; imageUrl: string | null },
  productCount: number | undefined,
  _locale: Locale,
): ShapedCategory {
  const image = absoluteUrl(c.imageUrl);
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    ...(image ? { image } : {}),
    ...(productCount != null ? { productCount } : {}),
  };
}

// ── Upsell reason (lokalizatsiya) ──
const UPSELL_REASON: Record<Locale, string> = {
  uz: "Ko'pincha birga olishadi",
  ru: "Часто покупают вместе",
  en: "Frequently bought together",
};
export function upsellReason(locale: Locale): string {
  return UPSELL_REASON[locale] ?? UPSELL_REASON[DEFAULT_LOCALE];
}

// ── Promotions ──
export interface ShapedPromotion {
  id: string;
  type: "free_shipping_over" | "percent_off" | "buy_x_get_y";
  title: string;
  description: string;
  threshold?: number;
  percent?: number;
}

const FREE_SHIP_TEXT: Record<Locale, (t: string) => { title: string; description: string }> = {
  uz: (t) => ({ title: "Bepul yetkazib berish", description: `${t} so'mdan yuqori buyurtmalarga bepul yetkazib berish` }),
  ru: (t) => ({ title: "Бесплатная доставка", description: `Бесплатная доставка при заказе от ${t} сум` }),
  en: (t) => ({ title: "Free shipping", description: `Free shipping on orders over ${t} UZS` }),
};

/** Eng kichik freeAbove qiymatidan free_shipping_over promotion yasaydi. */
export function buildFreeShippingPromotion(
  threshold: number,
  locale: Locale,
): ShapedPromotion {
  const fmt = threshold.toLocaleString("ru-RU");
  const text = (FREE_SHIP_TEXT[locale] ?? FREE_SHIP_TEXT[DEFAULT_LOCALE])(fmt);
  return {
    id: "free-shipping",
    type: "free_shipping_over",
    title: text.title,
    description: text.description,
    threshold,
  };
}
