import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SecretCipherService } from "../../common/crypto/secret-cipher.service.js";
import { QueueProducerService } from "../../queue/queue-producer.service.js";
import { AppConfigService } from "../../config/app-config.service.js";
import type { ClickConfig, PaymeConfig, PaymentLinks } from "@shopflow/shared-types";

/**
 * Shared payment service used by webhooks and the storefront. Reads per-tenant
 * provider configs from PaymentProviderConfig, generates customer-facing payment
 * links, and applies payment state transitions to Orders.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipherService,
    private readonly queue: QueueProducerService,
    private readonly config: AppConfigService,
  ) {}

  async loadProvider(tenantId: string, provider: "CLICK" | "PAYME") {
    return this.prisma.paymentProviderConfig.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
  }

  async findOrderForPayment(tenantId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.tenantId !== tenantId) return null;
    return order;
  }

  async decryptedSecret(tenantId: string, provider: "CLICK" | "PAYME"): Promise<string | null> {
    const cfg = await this.loadProvider(tenantId, provider);
    if (!cfg?.encryptedSecret) return null;
    return this.cipher.decrypt(cfg.encryptedSecret);
  }

  async buildPaymentLinks(orderId: string): Promise<PaymentLinks> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, tenantId: true, number: true, totalKopecks: true, paymentStatus: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.paymentStatus === "PAID") return {};

    const [click, payme] = await Promise.all([
      this.loadProvider(order.tenantId, "CLICK"),
      this.loadProvider(order.tenantId, "PAYME"),
    ]);

    const result: PaymentLinks = {};

    if (click?.enabled && click.publicConfig) {
      const cfg = click.publicConfig as unknown as ClickConfig;
      // Click Shop API supports the my.click.uz quick pay URL:
      const qs = new URLSearchParams({
        service_id: String(cfg.serviceId),
        merchant_id: String(cfg.merchantId),
        amount: (order.totalKopecks / 100).toFixed(2),
        transaction_param: order.id,
        return_url: `${this.config.publicAdminUrl}/api/payments/return?provider=click&order=${order.id}`,
      });
      result.clickUrl = `https://my.click.uz/services/pay?${qs.toString()}`;
    }

    if (payme?.enabled && payme.publicConfig) {
      const cfg = payme.publicConfig as unknown as PaymeConfig;
      // Payme encodes order id and amount in base64 segment.
      const segment = [`m=${cfg.cashboxId}`, `ac.order_id=${order.id}`, `a=${order.totalKopecks}`, "l=uz"].join(";");
      const encoded = Buffer.from(segment, "utf8").toString("base64");
      const host = cfg.testMode ? "https://test.paycom.uz" : "https://checkout.paycom.uz";
      result.paymeUrl = `${host}/${encoded}`;
    }

    return result;
  }

  /**
   * Mark a payment as PAID idempotently. Re-applying for the same externalId
   * is a no-op. Triggers an async Telegram notification to the customer.
   */
  async markPaid(
    tenantId: string,
    orderId: string,
    provider: "CLICK" | "PAYME",
    externalId: string,
    amountKopecks: number,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.tenantId !== tenantId) throw new NotFoundException("Order not found");

    const existingPayment = await this.prisma.payment.findFirst({
      where: { tenantId, orderId, provider, externalId },
    });
    if (existingPayment?.status === "PAID") {
      return { alreadyPaid: true };
    }

    await this.prisma.payment.upsert({
      where: { id: existingPayment?.id ?? "" },
      create: {
        tenantId,
        orderId,
        provider,
        amountKopecks,
        status: "PAID",
        externalId,
        paidAt: new Date(),
      },
      update: { status: "PAID", paidAt: new Date(), amountKopecks },
    });

    if (order.paymentStatus !== "PAID") {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: "PAID" },
      });
      await this.queue.enqueueOrderStatusNotification({
        tenantId,
        orderId,
        toChatId: "",
        newStatus: "PAYMENT_PAID",
      });
    }

    return { alreadyPaid: false };
  }

  async cancelPayment(tenantId: string, orderId: string, provider: "CLICK" | "PAYME", externalId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { tenantId, orderId, provider, externalId },
    });
    if (!payment) return;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
  }
}
