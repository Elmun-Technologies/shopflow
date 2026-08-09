// Abandoned Cart Reminder Worker — har soat so'ng eslatma yuboradi
// Bu funksiya cron job orqali chaqiriladi (backend startup'da)

import type { PrismaClient } from "@prisma/client";
import { notifyCustomerTelegram } from "./bot-notifications.js";

const ABANDONED_CART_REMINDER_DELAY_MS = 60 * 60 * 1000; // 1 soat
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 daqiqada bir tekshiramiz
const MAX_REMINDERS_PER_CART = 2; // Maksimal 2 marta eslatma

/**
 * Abandoned cart reminder'larni tekshirib yuboradi
 * Har 10 daqiqada chaqiriladi
 */
export async function processAbandonedCartReminders(prisma: PrismaClient): Promise<void> {
  try {
    const now = new Date();
    const reminderThreshold = new Date(now.getTime() - ABANDONED_CART_REMINDER_DELAY_MS);

    // Qaysi cartlarni eslatish kerak: 1 soatdan eski, reminder yuborilmagan
    const cartsToRemind = await prisma.abandonedCart.findMany({
      where: {
        createdAt: { lte: reminderThreshold },
        reminderSentAt: null,
        remindersSent: { lt: MAX_REMINDERS_PER_CART },
      },
      take: 100, // Bir vaqtda 100 ta cart
    });

    if (cartsToRemind.length === 0) return;

    console.log(`[cart-reminder] ${cartsToRemind.length} ta cartga eslatma yuboramiz`);

    for (const cart of cartsToRemind) {
      try {
        // Customer'ni topish
        const customer = await prisma.customer.findFirst({
          where: { tenantId: cart.tenantId, telegramUserId: cart.telegramUserId },
          select: { id: true, notifyCartAbandonment: true },
        });

        // Notification preference tekshirish
        if (!customer?.notifyCartAbandonment) {
          console.log(
            `[cart-reminder] Customer ${cart.telegramUserId} notification'larni o'chirgan`,
          );
          // Hali reminder sent deb belgilaymiz (istalmaydigan customerga eslatma yubormayamiz)
          await prisma.abandonedCart.update({
            where: { id: cart.id },
            data: { reminderSentAt: now, remindersSent: { increment: 1 } },
          });
          continue;
        }

        // Savat tarkibini parse qilish
        const cartItems = (cart.items as unknown[]) || [];
        const itemCount = Array.isArray(cartItems) ? cartItems.length : 0;
        const totalStr =
          cart.currency === "UZS"
            ? `${Number(cart.total).toLocaleString("uz-UZ")} so'm`
            : `${Number(cart.total)} ${cart.currency}`;

        const body =
          `🛍 <b>Savatingiz qoldi!</b>\n\n` +
          `Salom${cart.customerName ? `, ${cart.customerName}` : ""}! ` +
          `Savatingizda <b>${itemCount} mahsulot</b> bor (<b>${totalStr}</b>).\n\n` +
          `Ularni bugun sotib olishni davom ettiring — yordamga ketyapmiz! 🚀`;

        const result = await notifyCustomerTelegram(
          prisma,
          cart.tenantId,
          customer.id,
          cart.telegramUserId,
          "CART_ABANDON",
          "🛍 Savatingiz qoldi",
          body,
          "cart",
          cart.id,
        );

        if (result.sent) {
          console.log(`[cart-reminder] Cart ${cart.id} ga eslatma yuborildi`);
        } else {
          console.warn(
            `[cart-reminder] Cart ${cart.id} ga eslatma yuborilib bo'lmadi: ${result.reason}`,
          );
        }

        // reminderSentAt'ni yangilash
        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: { reminderSentAt: now, remindersSent: { increment: 1 } },
        });
      } catch (err) {
        console.error(`[cart-reminder] Cart ${cart.id} ga eslatma yuborilib bo'lmadi:`, err);
      }
    }
  } catch (err) {
    console.error("[cart-reminder] processAbandonedCartReminders failed:", err);
  }
}

/**
 * Scheduled job — har 10 daqiqada cart reminder'larni tekshiradi
 */
export function startAbandonedCartReminderWorker(prisma: PrismaClient): NodeJS.Timeout {
  console.log("[cart-reminder] Worker boshlandi");
  return setInterval(() => {
    processAbandonedCartReminders(prisma).catch((err) =>
      console.error("[cart-reminder] Worker xatosi:", err),
    );
  }, CHECK_INTERVAL_MS);
}
