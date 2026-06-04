// Click.uz Shop API integratsiyasi — to'lov URL generatsiyasi va Merchant API
// orqali invoice yaratish.
//
// Click ikki turdagi API berad:
//
// 1) Shop API (URL redirect) — eng oddiy. Mijozni
//    https://my.click.uz/services/pay?... ga yo'naltirasiz, u qaytib keladi.
//    Hech qanday backend so'rov yo'q. Webhook orqali natija keladi.
//
// 2) Merchant API (server-to-server) — invoice yaratish (mijozga SMS),
//    transaction status tekshirish, refund/reverse. Auth: SHA1(timestamp + secret).
//
// ShopFlow ikkalasini ham qo'llab-quvvatlaydi: oddiy holatda Shop URL yetarli,
// rasmiy invoice (SMS bilan) kerak bo'lsa Merchant API ishlatiladi.

import { createHash } from "node:crypto";

const SHOP_PAY_URL = "https://my.click.uz/services/pay";
const MERCHANT_API_BASE = "https://api.click.uz/v2/merchant";

/**
 * Click to'lov sahifasi URL'ini yasaydi. Mijoz shu URL'ga otadi, kartasini
 * kiritadi, to'lagach `returnUrl`'ga qaytariladi.
 *
 * @param amount - so'mda (Click tiyin emas, so'm qabul qiladi Shop API'da)
 * @param transactionParam - merchant_trans_id (odatda order.code, masalan ORD-1234)
 */
export function buildClickPaymentUrl(args: {
  merchantId: string;
  serviceId: string;
  amount: number;
  transactionParam: string;
  returnUrl?: string;
}): string {
  const params = new URLSearchParams({
    service_id: args.serviceId,
    merchant_id: args.merchantId,
    amount: String(args.amount),
    transaction_param: args.transactionParam,
  });
  if (args.returnUrl) params.set("return_url", args.returnUrl);
  return `${SHOP_PAY_URL}?${params.toString()}`;
}

/**
 * Click Merchant API uchun autentifikatsiya headerini yasaydi.
 * Format: `merchant_user_id:digest:timestamp` — digest = sha1(timestamp + secret_key)
 */
export function buildClickAuthHeader(merchantUserId: string, secretKey: string): {
  Auth: string;
} {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const digest = createHash("sha1").update(timestamp + secretKey).digest("hex");
  return { Auth: `${merchantUserId}:${digest}:${timestamp}` };
}

export interface ClickInvoiceResult {
  error_code: number;
  error_note?: string;
  invoice_id?: number;
}

/**
 * Click Merchant API orqali invoice yaratadi — mijozga Click ilovasida
 * "to'lash" so'rovi paydo bo'ladi (SMS ham yuborilishi mumkin).
 * Faqat opsional: oddiy URL redirect yetarli bo'lsa, buni chaqirish shart emas.
 */
export async function createClickInvoice(args: {
  merchantId: string;
  serviceId: string;
  merchantUserId: string;
  secretKey: string;
  amount: number;
  phoneNumber: string; // 998901234567 formatda
  merchantTransId: string; // order.code
}): Promise<ClickInvoiceResult> {
  const auth = buildClickAuthHeader(args.merchantUserId, args.secretKey);
  const res = await fetch(`${MERCHANT_API_BASE}/invoice/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...auth,
    },
    body: JSON.stringify({
      service_id: Number(args.serviceId),
      amount: args.amount,
      phone_number: args.phoneNumber,
      merchant_trans_id: args.merchantTransId,
    }),
  });
  const data = await res.json().catch(() => ({})) as ClickInvoiceResult;
  return data;
}

/**
 * Click'da to'lov holatini tekshirish (Merchant API). Webhook bo'lib o'tmagan
 * bo'lsa yoki tasdiqlash uchun kerak bo'lsa.
 */
export async function checkClickPaymentStatus(args: {
  merchantId: string;
  serviceId: string;
  merchantUserId: string;
  secretKey: string;
  paymentId: string;
}): Promise<{ error_code: number; error_note?: string; payment_status?: number }> {
  const auth = buildClickAuthHeader(args.merchantUserId, args.secretKey);
  const url = `${MERCHANT_API_BASE}/payment/status/${args.serviceId}/${args.paymentId}`;
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json", ...auth } });
  const data = await res.json().catch(() => ({ error_code: -9999, error_note: "Parse failed" }));
  return data as { error_code: number; error_note?: string; payment_status?: number };
}

/**
 * Tranzaksiyani Click tomonidan bekor qilish (refund/reverse) — Merchant API.
 */
export async function reverseClickPayment(args: {
  merchantId: string;
  serviceId: string;
  merchantUserId: string;
  secretKey: string;
  paymentId: string;
}): Promise<{ error_code: number; error_note?: string; payment_id?: number }> {
  const auth = buildClickAuthHeader(args.merchantUserId, args.secretKey);
  const url = `${MERCHANT_API_BASE}/payment/reversal/${args.serviceId}/${args.paymentId}`;
  const res = await fetch(url, { method: "DELETE", headers: { Accept: "application/json", ...auth } });
  const data = await res.json().catch(() => ({ error_code: -9999, error_note: "Parse failed" }));
  return data as { error_code: number; error_note?: string; payment_id?: number };
}
