/**
 * Click.uz Merchant API integratsiyasi.
 * Docs: https://docs.click.uz/click-api-merchant-shopping-cart/
 *
 * Click 2 ta callback yuboradi:
 *   - Prepare (action=0)  : ShopFlow tasdiqlaydi yoki rad etadi
 *   - Complete (action=1) : Click to'lov holatini bildiradi
 */
import { createHash } from "node:crypto";

export interface ClickConfig {
  merchantId: string;
  serviceId: string;
  secretKey: string;
  /** Click foydalanuvchi koshelek uchun (ixtiyoriy, ba'zi merchantlar uchun) */
  merchantUserId?: string;
}

interface ClickRequestBase {
  click_trans_id: string;
  service_id: string;
  click_paydoc_id: string;
  merchant_trans_id: string;
  amount: string;
  error: string;
  error_note: string;
  sign_time: string;
  sign_string: string;
}

export interface ClickPrepareRequest extends ClickRequestBase {
  action: "0";
}

export interface ClickCompleteRequest extends ClickRequestBase {
  action: "1";
  merchant_prepare_id: string;
}

export type ClickAction = "prepare" | "complete";

export const CLICK_ERRORS = {
  SUCCESS: 0,
  SIGN_INVALID: -1,
  AMOUNT_INVALID: -2,
  ACTION_INVALID: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  TRANSACTION_FAILED: -7,
  REQUEST_INVALID: -8,
  TRANSACTION_CANCELLED: -9,
};

export function verifyClickSign(req: ClickPrepareRequest | ClickCompleteRequest, secretKey: string): boolean {
  // Click signature: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id +
  //   [merchant_prepare_id (only for complete)] + amount + action + sign_time)
  const isComplete = req.action === "1";
  const parts = [
    req.click_trans_id,
    req.service_id,
    secretKey,
    req.merchant_trans_id,
    isComplete ? (req as ClickCompleteRequest).merchant_prepare_id : "",
    req.amount,
    req.action,
    req.sign_time,
  ].join("");
  const expected = createHash("md5").update(parts).digest("hex");
  return expected === req.sign_string;
}

export function buildPaymentUrl(config: ClickConfig, opts: {
  amount: number;
  transactionParam: string;
  returnUrl?: string;
}): string {
  const params = new URLSearchParams({
    service_id: config.serviceId,
    merchant_id: config.merchantId,
    amount: String(opts.amount),
    transaction_param: opts.transactionParam,
  });
  if (opts.returnUrl) params.set("return_url", opts.returnUrl);
  return `https://my.click.uz/services/pay?${params.toString()}`;
}
