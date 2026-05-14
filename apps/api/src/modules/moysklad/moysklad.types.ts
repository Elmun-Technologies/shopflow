/**
 * Minimal MoySklad REST API types used by ShopFlow. These mirror the
 * https://api.moysklad.ru/api/remap/1.2 documented payloads — only the fields
 * we read or write are typed; the rest is `unknown`.
 */

export interface MoyskladMeta {
  href: string;
  type: string;
  mediaType: string;
  uuidHref?: string;
  metadataHref?: string;
}

export interface MoyskladListResponse<T> {
  context?: unknown;
  meta: { href: string; type: string; mediaType: string; size: number; limit: number; offset: number };
  rows: T[];
}

export interface MoyskladProduct {
  id: string;
  accountId: string;
  name: string;
  code?: string;
  externalCode?: string;
  description?: string;
  vat?: number;
  vatEnabled?: boolean;
  weight?: number;
  archived?: boolean;
  updated: string;
  created: string;
  pathName?: string;
  productFolder?: { meta: MoyskladMeta };
  uom?: { meta: MoyskladMeta };
  salePrices?: Array<{ value: number; currency?: { meta: MoyskladMeta }; priceType: { meta: MoyskladMeta; name?: string } }>;
  buyPrice?: { value: number; currency?: { meta: MoyskladMeta } };
  barcodes?: Array<{ ean13?: string; ean8?: string; upc?: string; code128?: string; gtin?: string }>;
  images?: { meta: MoyskladMeta };
  meta: MoyskladMeta;
}

export interface MoyskladVariant {
  id: string;
  name: string;
  code?: string;
  externalCode?: string;
  product: { meta: MoyskladMeta };
  characteristics?: Array<{ id: string; name: string; value: string }>;
  barcodes?: Array<{ ean13?: string; gtin?: string }>;
  salePrices?: Array<{ value: number; priceType: { meta: MoyskladMeta; name?: string } }>;
  updated: string;
  meta: MoyskladMeta;
}

export interface MoyskladProductFolder {
  id: string;
  name: string;
  pathName?: string;
  productFolder?: { meta: MoyskladMeta };
  updated: string;
  meta: MoyskladMeta;
}

export interface MoyskladStore {
  id: string;
  name: string;
  address?: string;
  updated: string;
  meta: MoyskladMeta;
}

export interface MoyskladPriceType {
  id: string;
  name: string;
  externalCode?: string;
  meta: MoyskladMeta;
}

export interface MoyskladStockRow {
  assortmentId?: string;
  storeId?: string;
  productId?: string;
  variantId?: string;
  stock: number;
  reserve: number;
  inTransit: number;
  quantity: number;
  meta?: MoyskladMeta;
}

export interface MoyskladCounterparty {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  legalAddress?: string;
  actualAddress?: string;
  tags?: string[];
  updated: string;
  meta: MoyskladMeta;
}

export interface MoyskladCustomerOrder {
  id: string;
  name: string;
  moment: string;
  sum: number;
  agent?: { meta: MoyskladMeta };
  store?: { meta: MoyskladMeta };
  positions?: { meta: MoyskladMeta };
  state?: { meta: MoyskladMeta; name?: string };
  organization?: { meta: MoyskladMeta };
  description?: string;
  updated: string;
  meta: MoyskladMeta;
}

export interface MoyskladWebhookSubscription {
  id: string;
  entityType: string;
  url: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  method: "POST";
  enabled: boolean;
  meta: MoyskladMeta;
}

export interface MoyskladWebhookPayload {
  auditContext: { meta: MoyskladMeta; uid?: string; moment?: string };
  events: Array<{
    meta: MoyskladMeta;
    updatedFields?: string[];
    action: "CREATE" | "UPDATE" | "DELETE";
    accountId: string;
  }>;
}

export type MoyskladEntityKind =
  | "product"
  | "variant"
  | "productfolder"
  | "store"
  | "pricetype"
  | "counterparty"
  | "customerorder"
  | "demand"
  | "retaildemand"
  | "salesreturn"
  | "uom";
