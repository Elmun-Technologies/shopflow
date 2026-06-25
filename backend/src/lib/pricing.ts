// Narxlash breakdown — mahsulot narxidan yetkazib berish (deliveryPct%) va
// xizmat (servicePct%) xarajatlarini hisoblaydi. Hisobotlarda ishlatiladi.

export interface PriceBreakdown {
  product: number;
  delivery: number;
  service: number;
  total: number;
}

export function priceBreakdown(
  product: number,
  deliveryPct = 3,
  servicePct = 15,
): PriceBreakdown {
  const delivery = Math.round((product * deliveryPct) / 100);
  const service = Math.round((product * servicePct) / 100);
  return { product, delivery, service, total: product + delivery + service };
}
