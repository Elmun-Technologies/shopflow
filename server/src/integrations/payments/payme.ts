/**
 * Payme Merchant API integratsiyasi.
 * Docs: https://developer.help.paycom.uz/protokol-merchant-api
 * Auth: Basic base64("Paycom:" + merchantKey)
 * Format: JSON-RPC 2.0
 */

export interface PaymeConfig {
  merchantId: string;
  merchantKey: string;
  /** UI checkout link prefix — production: https://checkout.paycom.uz */
  checkoutUrl?: string;
}

export const PAYME_ERRORS = {
  TRANSPORT: -32300,
  ACCESS: -32504,
  REQUEST_FORMAT: -32700,
  REQUIRED_FIELD: -32600,
  INVALID_AMOUNT: -31001,
  INVALID_ACCOUNT: -31050,
  ORDER_NOT_FOUND: -31050,
  ORDER_ALREADY_PAID: -31099,
  TRANSACTION_NOT_FOUND: -31003,
  CANT_PERFORM: -31008,
};

export interface PaymeRequest {
  jsonrpc: "2.0";
  method: "CheckPerformTransaction" | "CreateTransaction" | "PerformTransaction" | "CancelTransaction" | "CheckTransaction" | "GetStatement";
  params: Record<string, unknown>;
  id: number;
}

export interface PaymeResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string | { ru: string; uz: string; en: string }; data?: string };
}

export function verifyPaymeAuth(authHeader: string | undefined, merchantKey: string): boolean {
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;
  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  const [user, key] = decoded.split(":");
  return user === "Paycom" && key === merchantKey;
}

/** Buyurtma uchun Payme checkout URL yaratish (base64-encoded params) */
export function buildPaymentUrl(config: PaymeConfig, opts: {
  amount: number; // som
  orderId: string; // ShopFlow order id
  callbackUrl?: string;
}): string {
  // Payme amount tiyin (1/100 so'm) bo'ladi
  const tiyin = Math.round(opts.amount * 100);
  const params = `m=${config.merchantId};ac.order_id=${opts.orderId};a=${tiyin}${opts.callbackUrl ? `;c=${opts.callbackUrl}` : ""}`;
  const b64 = Buffer.from(params).toString("base64");
  const base = config.checkoutUrl ?? "https://checkout.paycom.uz";
  return `${base}/${b64}`;
}

export function makeError(code: number, message: string): NonNullable<PaymeResponse["error"]> {
  return { code, message: { ru: message, uz: message, en: message } };
}
