/**
 * MoySklad REST API minimal type'lari.
 * Mos kelishi: https://api.moysklad.ru/api/remap/1.2
 * Faqat o'qigan/yozgan maydonlar yoziladi; qolgani `unknown`.
 */

export interface MoyskladMeta {
  href: string;
  type: string;
  mediaType?: string;
  uuidHref?: string;
  metadataHref?: string;
}

export interface MoyskladListResponse<T> {
  context?: unknown;
  meta: { href: string; size: number; limit: number; offset: number };
  rows: T[];
}

export interface MoyskladSalePrice {
  value: number; // tiyinda (1 so'm = 100 kopek)
  currency?: { meta: MoyskladMeta };
  priceType: { meta: MoyskladMeta; name?: string };
}

export interface MoyskladProduct {
  id: string;
  accountId?: string;
  name: string;
  code?: string;
  externalCode?: string;
  description?: string;
  archived?: boolean;
  updated: string;
  created?: string;
  pathName?: string;
  productFolder?: { meta: MoyskladMeta };
  salePrices?: MoyskladSalePrice[];
  buyPrice?: { value: number; currency?: { meta: MoyskladMeta } };
  images?: { meta: MoyskladMeta };
  meta: MoyskladMeta;
}

export interface MoyskladProductFolder {
  id: string;
  name: string;
  pathName?: string;
  productFolder?: { meta: MoyskladMeta };
  archived?: boolean;
  updated?: string;
  meta: MoyskladMeta;
}

export interface MoyskladCounterparty {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  actualAddress?: string;
  archived?: boolean;
  updated: string;
  meta: MoyskladMeta;
}

export interface MoyskladStockRow {
  meta?: MoyskladMeta;
  name?: string;
  code?: string;
  externalCode?: string;
  product?: { meta: MoyskladMeta };
  assortment?: { meta: MoyskladMeta };
  stock?: number;
  quantity?: number;
}

export interface MoyskladCustomerOrder {
  id: string;
  name: string;
  moment: string;
  sum?: number; // tiyinda
  agent?: { meta: MoyskladMeta };
  state?: { meta: MoyskladMeta; name?: string };
  positions?: { meta: MoyskladMeta };
  updated: string;
  meta: MoyskladMeta;
}

export interface MoyskladWebhookSubscription {
  id: string;
  entityType: string;
  url: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  enabled: boolean;
  meta: MoyskladMeta;
}

export interface MoyskladTokenTestResult {
  ok: boolean;
  accountUuid?: string;
  accountName?: string;
  error?: string;
}
