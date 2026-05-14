import { Injectable } from "@nestjs/common";
import type {
  MoyskladCounterparty,
  MoyskladCustomerOrder,
  MoyskladPriceType,
  MoyskladProduct,
  MoyskladProductFolder,
  MoyskladStore,
  MoyskladVariant,
} from "./moysklad.types.js";

/**
 * Field-level translators between MoySklad payloads and ShopFlow DB rows.
 *
 * Money is stored in MoySklad as **kopecks** (UZS *100 by convention for UZ
 * accounts), so the values pass through unchanged. Stock quantities are
 * fractional and stored as `Float` in Postgres.
 */
@Injectable()
export class MoyskladMappers {
  /** Extract the UUID part out of a MoySklad `meta.href`. */
  static idFromMeta(href: string | undefined): string | null {
    if (!href) return null;
    const m = href.match(/[0-9a-f-]{36}$/i);
    return m ? m[0] : null;
  }

  mapProduct(p: MoyskladProduct, categoryId: string | null, defaultPriceTypeId: string | null) {
    const defaultPrice = p.salePrices?.find(
      (sp) => MoyskladMappers.idFromMeta(sp.priceType.meta.href) === defaultPriceTypeId,
    ) ?? p.salePrices?.[0];

    const barcode = p.barcodes?.[0]?.ean13 ?? p.barcodes?.[0]?.gtin ?? null;

    return {
      moyskladId: p.id,
      name: p.name,
      slug: slugify(p.name) + "-" + p.id.slice(0, 6),
      sku: p.code ?? p.externalCode ?? p.id.slice(0, 8),
      categoryId,
      priceKopecks: Math.round(defaultPrice?.value ?? 0),
      costPriceKopecks: Math.round(p.buyPrice?.value ?? 0),
      barcode,
      vatPercent: p.vat ?? 0,
      description: p.description ?? null,
      weight: p.weight ?? null,
      archived: Boolean(p.archived),
      status: (p.archived ? "DISCONTINUED" : "ACTIVE") as "ACTIVE" | "DISCONTINUED",
      version: BigInt(new Date(p.updated).getTime()),
      syncedAt: new Date(),
      moyskladMeta: { href: p.meta.href, updated: p.updated },
    };
  }

  mapVariant(v: MoyskladVariant, productId: string) {
    const characteristics: Record<string, string> = {};
    for (const c of v.characteristics ?? []) characteristics[c.name] = c.value;
    return {
      moyskladId: v.id,
      productId,
      sku: v.code ?? v.id.slice(0, 8),
      barcode: v.barcodes?.[0]?.ean13 ?? v.barcodes?.[0]?.gtin ?? null,
      characteristics: characteristics as never,
      priceOverrideKopecks: v.salePrices?.[0]?.value ? Math.round(v.salePrices[0].value) : null,
      version: BigInt(new Date(v.updated).getTime()),
      syncedAt: new Date(),
    };
  }

  mapCategory(f: MoyskladProductFolder, parentId: string | null) {
    return {
      moyskladId: f.id,
      parentId,
      name: f.name,
      slug: slugify(f.pathName ?? f.name),
      pathName: f.pathName ?? null,
    };
  }

  mapWarehouse(s: MoyskladStore) {
    return {
      moyskladId: s.id,
      name: s.name,
      location: s.address ?? null,
      status: "ACTIVE" as const,
    };
  }

  mapPriceType(pt: MoyskladPriceType) {
    return {
      moyskladId: pt.id,
      name: pt.name,
      currency: "UZS",
    };
  }

  mapCounterparty(c: MoyskladCounterparty) {
    return {
      moyskladId: c.id,
      name: c.name,
      phone: c.phone ?? null,
      email: c.email ?? null,
      address: c.actualAddress ?? c.legalAddress ?? null,
      tags: (c.tags ?? []) as never,
      version: BigInt(new Date(c.updated).getTime()),
      syncedAt: new Date(),
    };
  }

  mapCustomerOrderUpdate(o: MoyskladCustomerOrder) {
    return {
      moyskladId: o.id,
      number: o.name,
      totalKopecks: Math.round(o.sum),
      moyskladMeta: { state: o.state?.name ?? null, moment: o.moment } as never,
      version: BigInt(new Date(o.updated).getTime()),
      syncedAt: new Date(),
    };
  }
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}
