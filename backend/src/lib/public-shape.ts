// Public API (v1) javob shakllantiruvchilari.
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

  const oldPrice = p.oldPrice != null ? Number(p.oldPrice) : undefined;
  const servings = asNumOrUndef(lc.servings);
  const origin = p.origin ?? (asString(lc.origin) || undefined);

  return {
    id: p.id,
    slug: p.slug ?? p.id, // slug yo'q bo'lsa id bilan addressable
    name,
    tagline: asString(lc.tagline),
    description: asString(lc.description) || p.description || "",
    categoryId: p.categoryId,
    categorySlug: p.category?.slug ?? null,
    price: Math.round(Number(p.price)),
    ...(oldPrice != null ? { oldPrice: Math.round(oldPrice) } : {}),
    currency: p.currency,
    rating: Math.round(opts.rating * 10) / 10,
    reviewCount: opts.reviewCount,
    inStock: p.stock > 0,
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
