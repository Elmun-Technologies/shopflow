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

// Ichki to'lov holati (PaymentTxStatus qiymatlari) → Payme JSON-RPC state kodi.
//   1  = yaratilgan (pending)
//   2  = bajarilgan (paid)
//  -1  = bajarilmasdan bekor / xato
//  -2  = bajarilgandan keyin bekor / qaytarilgan
// Eslatma: yozuvda bekor-oldi/keyingi holat alohida saqlanmaydi; CancelTransaction
// javobi bilan mos (-2) bo'lishi uchun CANCELLED → -2 map qilinadi.
export type PaymentTxStatusName = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "CANCELLED";
export function paymeStateForStatus(status: PaymentTxStatusName): number {
  switch (status) {
    case "SUCCESS":
      return 2;
    case "CANCELLED":
    case "REFUNDED":
      return -2;
    case "FAILED":
      return -1;
    default:
      return 1; // PENDING
  }
}
