import type {
  MoyskladCounterparty,
  MoyskladCustomerOrder,
  MoyskladProduct,
  MoyskladProductFolder,
  MoyskladStockRow,
} from "./moysklad-types.js";

/**
 * MoySklad narxlari **tiyinda** (1 so'm = 100 kopek). Bizning DB so'mda turadi.
 */
function kopecksToSom(value: number | undefined): number {
  if (value === undefined || value === null) return 0;
  return Math.round(value) / 100;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** MoySklad meta.href oxiridagi UUID'ni ajratib oladi. */
function extractIdFromMeta(meta: { href: string } | undefined): string | null {
  if (!meta?.href) return null;
  const m = /\/([0-9a-f-]{36})(?:[/?]|$)/i.exec(meta.href);
  return m?.[1] ?? null;
}

export interface ProductUpsertData {
  moyskladId: string;
  moyskladUpdated: Date;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  oldPrice: number | null;
  currency: string;
  active: boolean;
  categoryMoyskladId: string | null;
  source: "MOYSKLAD";
}

export function mapMoyskladProduct(p: MoyskladProduct): ProductUpsertData {
  // Eng yuqori narx — asosiy narx; agar bir nechta priceType bo'lsa,
  // "Цена продажи" yoki birinchi mavjud bo'lganni olamiz.
  const sale = p.salePrices?.find((sp) => /продаж|sale/i.test(sp.priceType?.name ?? "")) ?? p.salePrices?.[0];
  const price = kopecksToSom(sale?.value);

  // SKU: code → externalCode → moyskladId (oxirgisi fallback)
  const sku = p.code?.trim() || p.externalCode?.trim() || p.id;

  return {
    moyskladId: p.id,
    moyskladUpdated: new Date(p.updated),
    sku,
    name: p.name,
    description: p.description ?? null,
    price,
    oldPrice: null,
    currency: "UZS",
    active: !p.archived,
    categoryMoyskladId: extractIdFromMeta(p.productFolder?.meta),
    source: "MOYSKLAD",
  };
}

export interface CategoryUpsertData {
  moyskladId: string;
  moyskladUpdated: Date | null;
  name: string;
  slug: string;
  parentMoyskladId: string | null;
}

export function mapMoyskladCategory(f: MoyskladProductFolder): CategoryUpsertData {
  return {
    moyskladId: f.id,
    moyskladUpdated: f.updated ? new Date(f.updated) : null,
    name: f.name,
    slug: slugify(f.pathName ? `${f.pathName}-${f.name}` : f.name) || f.id.slice(0, 8),
    parentMoyskladId: extractIdFromMeta(f.productFolder?.meta),
  };
}

export interface CustomerUpsertData {
  moyskladId: string;
  moyskladUpdated: Date;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
}

export function mapMoyskladCounterparty(c: MoyskladCounterparty): CustomerUpsertData {
  return {
    moyskladId: c.id,
    moyskladUpdated: new Date(c.updated),
    name: c.name,
    email: c.email?.trim() || null,
    phone: c.phone?.trim() || null,
    location: c.actualAddress?.trim() || null,
  };
}

export interface OrderUpsertData {
  moyskladId: string;
  moyskladUpdated: Date;
  code: string;
  total: number;
  currency: string;
  customerMoyskladId: string | null;
  statusName: string | null;
}

export function mapMoyskladOrder(o: MoyskladCustomerOrder): OrderUpsertData {
  return {
    moyskladId: o.id,
    moyskladUpdated: new Date(o.updated),
    code: o.name,
    total: kopecksToSom(o.sum),
    currency: "UZS",
    customerMoyskladId: extractIdFromMeta(o.agent?.meta),
    statusName: o.state?.name ?? null,
  };
}

/**
 * Stock report'ning bitta qatori (assortment) uchun MoySklad product UUID + qoldiq.
 */
export function mapStockRow(row: MoyskladStockRow): { productMoyskladId: string | null; stock: number } {
  return {
    productMoyskladId: extractIdFromMeta(row.assortment?.meta) ?? extractIdFromMeta(row.product?.meta),
    stock: Math.max(0, Math.floor(row.quantity ?? row.stock ?? 0)),
  };
}
