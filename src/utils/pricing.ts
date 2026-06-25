// Narxlash breakdown — mahsulot narxidan yetkazib berish va xizmat xarajatlarini
// hisoblaydi (management ko'rinishi). Foizlar tenant sozlamasidan (default 3% / 15%).

export interface PriceBreakdown {
  product: number; // baza narx
  delivery: number; // yetkazib berish (deliveryPct%)
  service: number; // xizmat ko'rsatish (servicePct%)
  total: number; // jami (product + delivery + service)
}

export const DEFAULT_DELIVERY_PCT = 3;
export const DEFAULT_SERVICE_PCT = 15;

export function priceBreakdown(
  product: number,
  deliveryPct?: number | null,
  servicePct?: number | null,
): PriceBreakdown {
  const dPct = deliveryPct ?? DEFAULT_DELIVERY_PCT;
  const sPct = servicePct ?? DEFAULT_SERVICE_PCT;
  const delivery = Math.round((product * dPct) / 100);
  const service = Math.round((product * sPct) / 100);
  return { product, delivery, service, total: product + delivery + service };
}
