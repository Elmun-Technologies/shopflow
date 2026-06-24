// To'lov reconciliation — sof logika (DB'siz testlanadi).
// Webhook'dan kelgan summa va buyurtma referensini buyurtma bilan solishtiradi.
// Imzo tekshiruvidan keyingi himoya: noto'g'ri summa/order uchun pul tasdiqlanmaydi.

export type ReconOutcome = "ok" | "no_order" | "amount_mismatch";

/** Webhook summasi buyurtma summasiga mos kelishi (1 so'm dumaloqlash toleransi). */
export function amountsMatch(webhookAmount: number, orderTotal: number): boolean {
  return Math.abs(webhookAmount - orderTotal) <= 1;
}

/**
 * Reconciliation qarori:
 * - orderRef berilgan-u order topilmasa → "no_order"
 * - order bor-u summa mos kelmasa → "amount_mismatch"
 * - aks holda → "ok"
 */
export function reconcileOutcome(
  orderRef: string | null | undefined,
  order: { total: number } | null,
  amount: number,
): ReconOutcome {
  if (orderRef && !order) return "no_order";
  if (order && !amountsMatch(amount, order.total)) return "amount_mismatch";
  return "ok";
}
