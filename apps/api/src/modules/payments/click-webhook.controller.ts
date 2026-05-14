import { Body, Controller, HttpCode, Logger, Param, Post } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PaymentsService } from "./payments.service.js";
import { Public } from "../../common/auth/auth.decorators.js";

/**
 * Click Shop API callback endpoint. Click POSTs URL-encoded form data twice
 * per transaction:
 *   1. action=0 (prepare)  — we validate the order exists and respond with our
 *      `merchant_prepare_id`.
 *   2. action=1 (complete) — Click confirms the payment; we mark Order PAID.
 *
 * Signature check follows Click's documented MD5 scheme:
 *
 *   prepare:  md5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)
 *   complete: md5(click_trans_id + service_id + secret_key + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
 *
 * Per the spec, errors are reported via `error` and `error_note` in a 200 OK
 * response — not via HTTP status codes.
 */
@Controller("webhooks/click")
export class ClickWebhookController {
  private readonly logger = new Logger(ClickWebhookController.name);

  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @HttpCode(200)
  @Post(":tenantId")
  async handle(@Param("tenantId") tenantId: string, @Body() body: Record<string, string>) {
    const action = Number(body.action ?? -1);
    const orderId = String(body.merchant_trans_id ?? "");

    const secret = await this.payments.decryptedSecret(tenantId, "CLICK");
    if (!secret) return clickError(-9, "Provider not configured");

    if (!this.verifyClickSign(body, secret)) {
      return clickError(-1, "SIGN_CHECK_FAILED");
    }

    if (action === 0) {
      return this.prepare(tenantId, orderId, body);
    }
    if (action === 1) {
      return this.complete(tenantId, orderId, body);
    }
    return clickError(-3, "ACTION_NOT_FOUND");
  }

  private async prepare(tenantId: string, orderId: string, body: Record<string, string>) {
    try {
      const order = await this.payments.findOrderForPayment(tenantId, orderId);
      if (!order) return clickError(-5, "ORDER_NOT_FOUND");
      const incomingAmount = Math.round(Number(body.amount) * 100);
      if (Math.abs(incomingAmount - order.totalKopecks) > 1) {
        return clickError(-2, "AMOUNT_MISMATCH");
      }
      if (order.paymentStatus === "PAID") return clickError(-4, "ALREADY_PAID");
      return {
        click_trans_id: body.click_trans_id,
        merchant_trans_id: orderId,
        merchant_prepare_id: orderId,
        error: 0,
        error_note: "Success",
      };
    } catch (err) {
      this.logger.error(`Click prepare failed: ${String(err)}`);
      return clickError(-9, "INTERNAL_ERROR");
    }
  }

  private async complete(tenantId: string, orderId: string, body: Record<string, string>) {
    try {
      const error = Number(body.error ?? 0);
      if (error < 0) {
        await this.payments.cancelPayment(tenantId, orderId, "CLICK", String(body.click_trans_id));
        return {
          click_trans_id: body.click_trans_id,
          merchant_trans_id: orderId,
          merchant_confirm_id: orderId,
          error: 0,
          error_note: "Cancelled",
        };
      }

      const amount = Math.round(Number(body.amount) * 100);
      await this.payments.markPaid(tenantId, orderId, "CLICK", String(body.click_trans_id), amount);
      return {
        click_trans_id: body.click_trans_id,
        merchant_trans_id: orderId,
        merchant_confirm_id: orderId,
        error: 0,
        error_note: "Success",
      };
    } catch (err) {
      this.logger.error(`Click complete failed: ${String(err)}`);
      return clickError(-9, "INTERNAL_ERROR");
    }
  }

  private verifyClickSign(body: Record<string, string>, secret: string): boolean {
    const action = String(body.action);
    const base =
      action === "0"
        ? `${body.click_trans_id}${body.service_id}${secret}${body.merchant_trans_id}${body.amount}${body.action}${body.sign_time}`
        : `${body.click_trans_id}${body.service_id}${secret}${body.merchant_trans_id}${body.merchant_prepare_id}${body.amount}${body.action}${body.sign_time}`;
    const expected = createHash("md5").update(base).digest("hex");
    return expected === String(body.sign_string ?? "").toLowerCase();
  }

}

function clickError(code: number, note: string) {
  return { error: code, error_note: note };
}
