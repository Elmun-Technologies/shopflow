import { Body, Controller, Headers, HttpCode, Logger, Param, Post } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { PaymentsService } from "./payments.service.js";
import { Public } from "../../common/auth/auth.decorators.js";

/**
 * Payme Merchant API endpoint. Receives JSON-RPC 2.0 requests with HTTP Basic
 * authentication (`Authorization: Basic base64(Paycom:KEY)`). The KEY is the
 * cashbox secret stored encrypted in PaymentProviderConfig.encryptedSecret.
 *
 * Implemented methods (per https://developer.help.paycom.uz/):
 *   - CheckPerformTransaction
 *   - CreateTransaction
 *   - PerformTransaction
 *   - CancelTransaction
 *   - CheckTransaction
 *
 * Errors are reported in the JSON-RPC `error` field with Payme-defined codes
 * (-31001…-31099).
 */
@Controller("webhooks/payme")
export class PaymeWebhookController {
  private readonly logger = new Logger(PaymeWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  @Public()
  @HttpCode(200)
  @Post(":tenantId")
  async handle(
    @Param("tenantId") tenantId: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: PaymeRpcRequest,
  ) {
    const secret = await this.payments.decryptedSecret(tenantId, "PAYME");
    if (!secret) return rpcError(body, -32504, "Provider not configured");
    if (!verifyBasicAuth(authHeader, secret)) {
      return rpcError(body, -32504, "Insufficient privileges");
    }

    try {
      switch (body.method) {
        case "CheckPerformTransaction":
          return await this.checkPerform(tenantId, body);
        case "CreateTransaction":
          return await this.create(tenantId, body);
        case "PerformTransaction":
          return await this.perform(tenantId, body);
        case "CancelTransaction":
          return await this.cancel(tenantId, body);
        case "CheckTransaction":
          return await this.check(tenantId, body);
        default:
          return rpcError(body, -32601, "Method not found");
      }
    } catch (err) {
      this.logger.error(`Payme ${body.method} failed: ${String(err)}`);
      return rpcError(body, -32400, "Internal error");
    }
  }

  private async checkPerform(tenantId: string, req: PaymeRpcRequest) {
    const orderId = req.params?.account?.order_id;
    if (!orderId) return rpcError(req, -31050, "Missing order_id");
    const order = await this.payments.findOrderForPayment(tenantId, orderId);
    if (!order) return rpcError(req, -31050, "Order not found", { uz: "Buyurtma topilmadi" });
    if (Math.abs((req.params?.amount ?? 0) - order.totalKopecks) > 1) {
      return rpcError(req, -31001, "Wrong amount");
    }
    if (order.paymentStatus === "PAID") {
      return rpcError(req, -31099, "Already paid");
    }
    return rpcResult(req, { allow: true });
  }

  private async create(tenantId: string, req: PaymeRpcRequest) {
    const orderId = req.params?.account?.order_id;
    if (!orderId) return rpcError(req, -31050, "Missing order_id");
    const order = await this.payments.findOrderForPayment(tenantId, orderId);
    if (!order) return rpcError(req, -31050, "Order not found");

    const paymeId = String(req.params!.id);
    let payment = await this.prisma.payment.findFirst({
      where: { tenantId, orderId, provider: "PAYME", externalId: paymeId },
    });

    if (!payment) {
      // Check for existing payment from different transaction id (Payme spec)
      const open = await this.prisma.payment.findFirst({
        where: { tenantId, orderId, provider: "PAYME", status: "PENDING" },
      });
      if (open && open.externalId !== paymeId) {
        return rpcError(req, -31099, "Other transaction in progress");
      }
      payment = await this.prisma.payment.create({
        data: {
          tenantId,
          orderId,
          provider: "PAYME",
          status: "PENDING",
          amountKopecks: req.params!.amount,
          externalId: paymeId,
        },
      });
    }
    return rpcResult(req, {
      create_time: payment.createdAt.getTime(),
      transaction: payment.id,
      state: 1,
    });
  }

  private async perform(tenantId: string, req: PaymeRpcRequest) {
    const paymeId = String(req.params!.id);
    const payment = await this.prisma.payment.findFirst({
      where: { tenantId, provider: "PAYME", externalId: paymeId },
    });
    if (!payment) return rpcError(req, -31003, "Transaction not found");
    if (payment.status !== "PAID") {
      await this.payments.markPaid(tenantId, payment.orderId, "PAYME", paymeId, payment.amountKopecks);
    }
    return rpcResult(req, {
      transaction: payment.id,
      perform_time: Date.now(),
      state: 2,
    });
  }

  private async cancel(tenantId: string, req: PaymeRpcRequest) {
    const paymeId = String(req.params!.id);
    const payment = await this.prisma.payment.findFirst({
      where: { tenantId, provider: "PAYME", externalId: paymeId },
    });
    if (!payment) return rpcError(req, -31003, "Transaction not found");
    if (payment.status !== "FAILED") {
      await this.payments.cancelPayment(tenantId, payment.orderId, "PAYME", paymeId);
    }
    return rpcResult(req, {
      transaction: payment.id,
      cancel_time: Date.now(),
      state: payment.status === "PAID" ? -2 : -1,
    });
  }

  private async check(tenantId: string, req: PaymeRpcRequest) {
    const paymeId = String(req.params!.id);
    const payment = await this.prisma.payment.findFirst({
      where: { tenantId, provider: "PAYME", externalId: paymeId },
    });
    if (!payment) return rpcError(req, -31003, "Transaction not found");
    return rpcResult(req, {
      transaction: payment.id,
      create_time: payment.createdAt.getTime(),
      perform_time: payment.paidAt?.getTime() ?? 0,
      cancel_time: 0,
      state: payment.status === "PAID" ? 2 : payment.status === "FAILED" ? -1 : 1,
      reason: null,
    });
  }
}

interface PaymeRpcRequest {
  id: number | string;
  method: string;
  params?: {
    id?: string;
    amount?: number;
    account?: { order_id?: string };
  };
}

function verifyBasicAuth(header: string | undefined, secret: string): boolean {
  if (!header?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const [, key] = decoded.split(":");
    return key === secret;
  } catch {
    return false;
  }
}

function rpcResult(req: PaymeRpcRequest, result: Record<string, unknown>) {
  return { jsonrpc: "2.0", id: req.id, result };
}

function rpcError(
  req: PaymeRpcRequest,
  code: number,
  message: string,
  data?: Record<string, string>,
) {
  return {
    jsonrpc: "2.0",
    id: req.id,
    error: { code, message, data },
  };
}
