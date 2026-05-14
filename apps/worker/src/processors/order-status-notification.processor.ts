import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import axios from "axios";
import { PrismaProvider } from "../prisma.provider.js";
import { WorkerSecretCipher } from "../moysklad/secret-cipher.js";

interface JobData {
  tenantId: string;
  orderId: string;
  newStatus: string;
}

const STATUS_TEXT: Record<string, string> = {
  PENDING: "qabul qilindi",
  PROCESSING: "ishlab chiqilmoqda",
  SHIPPED: "jo'natildi",
  COMPLETED: "yetkazildi",
  CANCELLED: "bekor qilindi",
};

/**
 * Sends an order-status change notification to the customer's Telegram chat
 * (only if the order has a TelegramUser linked via customerId). Fails
 * silently if the bot isn't connected or the customer never used the bot.
 */
@Injectable()
@Processor("telegram-notifications", { concurrency: 8 })
export class OrderStatusNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderStatusNotificationProcessor.name);

  constructor(private readonly prisma: PrismaProvider, private readonly cipher: WorkerSecretCipher) {
    super();
  }

  async process(job: Job<JobData>): Promise<void> {
    if (job.name !== "order-status-changed") return;
    const { tenantId, orderId, newStatus } = job.data;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: { include: { telegramUsers: true } } },
    });
    if (!order || !order.customer) return;

    const chatIds = order.customer.telegramUsers
      .filter((u) => u.tenantId === tenantId)
      .map((u) => u.chatId);
    if (chatIds.length === 0) return;

    const bot = await this.prisma.telegramBot.findUnique({ where: { tenantId } });
    if (!bot?.enabled) return;
    const token = this.cipher.decrypt(bot.encryptedToken);

    const statusText = STATUS_TEXT[newStatus] ?? newStatus.toLowerCase();
    const text = `🔔 Buyurtmangiz holati o'zgardi.\n\nBuyurtma № ${order.number}\nHolat: <b>${statusText}</b>`;

    for (const chatId of chatIds) {
      try {
        await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
          chat_id: chatId.toString(),
          text,
          parse_mode: "HTML",
        }, { timeout: 10_000 });
      } catch (err) {
        this.logger.warn(`Failed to notify chat ${chatId} for order ${orderId}: ${String(err)}`);
      }
    }
  }
}
