// B2B/ulgurji narx pog'onalari — hajm oshgani sari narx arzonlashadi.
//
// Yagona haqiqat manbai: storefront, admin, public API va bot bir xil qoidani
// ishlatadi — aks holda kartada bir narx, PDP'da boshqa narx ko'rinadi.
//
// Maʼlumot xarakterida: pog'onalar mijozga ko'rsatiladi. B2B rejimda buyurtma
// so'rov→lid orqali ketadi va yakuniy narxni menejer tasdiqlaydi; chakana
// rejimda esa `priceForQty` savatdagi miqdorga mos narxni beradi.

import { z } from "zod";

// ─── Kontrakt ───────────────────────────────────────────────────────────────

export const priceTierSchema = z.object({
  /** Shu miqdordan boshlab ( va undan yuqori) narx qo'llanadi */
  minQty: z.number().int().positive().max(10_000_000),
  /** Birlik narxi, butun UZS */
  price: z.number().int().nonnegative().max(100_000_000_000),
});
export type PriceTier = z.infer<typeof priceTierSchema>;

export const priceTiersSchema = z.array(priceTierSchema).max(12).default([]);

export interface PriceTierLike {
  minQty: number;
  price: number;
}

// ─── O'qish / normallashtirish ───────────────────────────────────────────────

/**
 * `Product.priceTiers` JSON'ini xavfsiz o'qiydi va **minQty bo'yicha o'sish
 * tartibida** qaytaradi. Buzuq bo'lsa bo'sh massiv (mavjud ekranlar o'lmaydi).
 */
export function parsePriceTiers(raw: unknown): PriceTier[] {
  const parsed = priceTiersSchema.safeParse(raw);
  if (!parsed.success) return [];
  // minQty bo'yicha saralaymiz — kiritish tartibiga ishonmaymiz
  return [...parsed.data].sort((a, b) => a.minQty - b.minQty);
}

// ─── Hisoblash ────────────────────────────────────────────────────────────────

/**
 * Berilgan miqdor uchun birlik narxini qaytaradi.
 *
 * Pog'onalar `minQty` bo'yicha o'sish tartibida bo'lishi kutiladi (parsePriceTiers
 * kafolatlaydi). Miqdorga **mos keluvchi eng yuqori** pog'ona tanlanadi.
 * Miqdor eng kichik pog'onadan ham past bo'lsa — `basePrice` qaytadi
 * (pog'onalar odatda 1 dan boshlanadi, lekin kafolatlanmaydi).
 *
 * @param basePrice pog'onasiz narx (variant yoki mahsulot narxi)
 * @param tiers     o'sish tartibidagi pog'onalar
 * @param qty       miqdor (≥1)
 */
export function priceForQty(basePrice: number, tiers: PriceTierLike[], qty: number): number {
  if (tiers.length === 0 || qty < 1) return basePrice;
  let price = basePrice;
  let matched = false;
  for (const tier of tiers) {
    if (qty >= tier.minQty) {
      price = tier.price;
      matched = true;
    } else {
      break; // tartiblangan — keyingilari ham baland
    }
  }
  return matched ? price : basePrice;
}

/**
 * Kartada/PDP'da ko'rsatiladigan "eng arzon (eng katta hajm) narxi" —
 * marketplace uslubidagi "… dan" uchun. Pog'onasiz bo'lsa null.
 */
export function lowestTierPrice(tiers: PriceTierLike[]): number | null {
  if (tiers.length === 0) return null;
  return tiers.reduce((min, t) => Math.min(min, t.price), tiers[0].price);
}

/**
 * Miqdorni MOQ va qadoq qadamiga moslaydi (chakana savat uchun).
 * step berilmasa (null) — faqat MOQ pastki chegara.
 */
export function clampQtyToMoq(qty: number, moq: number | null, step: number | null): number {
  let q = Math.max(1, Math.floor(qty));
  if (moq && q < moq) q = moq;
  if (step && step > 1) {
    // MOQ'dan yuqoriga step bo'yicha yaxlitlaymiz
    const base = moq && moq > 0 ? moq : 0;
    const over = q - base;
    q = base + Math.ceil(over / step) * step;
  }
  return q;
}

/**
 * Pog'onalarni tekshiradi — admin saqlashdan oldin. Xato matnlari UI'da chiqadi.
 * (Storefront/public bu funksiyani ishlatmaydi — u yerda buzuqlar jimgina
 * tashlanadi, chunki narx ko'rsatish mijozga tegishli.)
 */
export function validatePriceTiers(tiers: Array<{ minQty: number; price: number }>): string[] {
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const t of tiers) {
    if (!Number.isInteger(t.minQty) || t.minQty < 1) {
      errors.push(`Pog'ona miqdori butun va ≥1 bo'lishi kerak: ${t.minQty}`);
      continue;
    }
    if (seen.has(t.minQty)) errors.push(`Bir xil miqdorli ikkita pog'ona: ${t.minQty}`);
    seen.add(t.minQty);
    if (!Number.isInteger(t.price) || t.price < 0) {
      errors.push(`Pog'ona narxi butun va ≥0 bo'lishi kerak: ${t.price}`);
    }
  }
  return errors;
}
