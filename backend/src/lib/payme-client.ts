// Payme (Paycom) Merchant API integratsiyasi.
//
// Payme'da ham ikki turdagi API mavjud:
//
// 1) Checkout URL (mijozni yo'naltirish) — eng oddiy: base64 encoded params
//    `https://checkout.paycom.uz/<base64>` ga otkazasiz, qaytib kelganda
//    webhook orqali natija keladi (allaqachon payments.ts ichida).
//
// 2) Merchant API (receipts) — server-to-server: receipts.create, receipts.pay,
//    receipts.cancel, receipts.check. Auth: `X-Auth: MERCHANT_ID:KEY`.
//    Payme tiyin'da hisoblaydi (so'm * 100).

const CHECKOUT_BASE = "https://checkout.paycom.uz";
const MERCHANT_API_BASE = "https://checkout.paycom.uz/api";

/** Payme checkout URL'ini yasaydi. amount so'mda berilsa, biz tiyin'ga aylantiramiz. */
export function buildPaymeCheckoutUrl(args: {
  merchantId: string;
  orderRef: string; // order.code
  amountSom: number;
  accountField?: string; // default "order_id" — Payme account params nomi
  callbackUrl?: string;
  language?: "uz" | "ru" | "en";
}): string {
  const field = args.accountField ?? "order_id";
  const amountTiyin = Math.round(args.amountSom * 100);
  // Payme params format: `m=MID;ac.FIELD=VAL;a=AMOUNT_TIYIN;c=CALLBACK;l=LANG`
  const parts = [
    `m=${args.merchantId}`,
    `ac.${field}=${args.orderRef}`,
    `a=${amountTiyin}`,
  ];
  if (args.callbackUrl) parts.push(`c=${args.callbackUrl}`);
  if (args.language) parts.push(`l=${args.language}`);
  const encoded = Buffer.from(parts.join(";"), "utf8").toString("base64");
  return `${CHECKOUT_BASE}/${encoded}`;
}

/** Payme Merchant API (receipts) uchun X-Auth header. */
export function buildPaymeAuthHeader(merchantId: string, key: string): { "X-Auth": string } {
  return { "X-Auth": `${merchantId}:${key}` };
}

interface PaymeReceipt {
  _id: string;
  amount: number;
  state: number;
  pay_time?: number;
  create_time?: number;
  cancel_time?: number;
  account?: Array<{ name: string; value: string }>;
}

interface PaymeRpcResponse<T> {
  jsonrpc?: string;
  id?: number;
  result?: T;
  error?: { code: number; message: { ru?: string; uz?: string; en?: string }; data?: unknown };
}

async function paymeRpc<T>(args: {
  merchantId: string;
  key: string;
  method: string;
  params: Record<string, unknown>;
}): Promise<PaymeRpcResponse<T>> {
  const res = await fetch(MERCHANT_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...buildPaymeAuthHeader(args.merchantId, args.key),
    },
    body: JSON.stringify({
      id: Date.now(),
      method: args.method,
      params: args.params,
    }),
  });
  const data = await res.json().catch(() => ({ error: { code: -32700, message: { en: "Parse failed" } } }));
  return data as PaymeRpcResponse<T>;
}

/** Yangi receipt yaratish — to'lov uchun "qog'oz" hisob-faktura. */
export function createPaymeReceipt(args: {
  merchantId: string;
  key: string;
  amountSom: number;
  orderRef: string;
  accountField?: string;
}): Promise<PaymeRpcResponse<{ receipt: PaymeReceipt }>> {
  return paymeRpc({
    merchantId: args.merchantId,
    key: args.key,
    method: "receipts.create",
    params: {
      amount: Math.round(args.amountSom * 100),
      account: { [args.accountField ?? "order_id"]: args.orderRef },
    },
  });
}

/** Receipt holatini tekshirish (state: 0=yaratilgan, 1=tasdiqlangan, ...). */
export function checkPaymeReceipt(args: {
  merchantId: string;
  key: string;
  receiptId: string;
}): Promise<PaymeRpcResponse<{ receipt: PaymeReceipt; state: number }>> {
  return paymeRpc({
    merchantId: args.merchantId,
    key: args.key,
    method: "receipts.check",
    params: { id: args.receiptId },
  });
}

/** Receipt'ni bekor qilish. */
export function cancelPaymeReceipt(args: {
  merchantId: string;
  key: string;
  receiptId: string;
}): Promise<PaymeRpcResponse<{ receipt: PaymeReceipt }>> {
  return paymeRpc({
    merchantId: args.merchantId,
    key: args.key,
    method: "receipts.cancel",
    params: { id: args.receiptId },
  });
}
