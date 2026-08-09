// Bot notification system — xabar yuboruvchi va jadvalga yozuvchi
// Qo'llab turadi: savatni tashlab ketish, buyurtma tayyor, aksiyalar

import type { PrismaClient } from "@prisma/client";
import { sendTelegramRaw } from "./telegram-notify.js";

interface BotNotificationResult {
  sent: boolean;
  reason?: string;
  telegramError?: string;
}

/**
 * Notification template'larni yaratadi (uz/ru)
 */
function getNotificationTemplate(
  type: "cart_abandon" | "order_ready" | "order_created" | "promotion",
  lang: "uz" | "ru" = "uz",
  data?: Record<string, unknown>,
): { title: string; body: string } {
  const templates: Record<string, Record<string, { title: string; body: string }>> = {
    cart_abandon: {
      uz: {
        title: "🛍 Savatingiz qoldi",
        body: `Salom! Savatingizda <b>${data?.itemCount || 1} mahsulot</b> bor. Ularni bugun sotib olishni davom ettiring va <b>${data?.discount || "chegirma"}</b> oling! 🎁`,
      },
      ru: {
        title: "🛍 Ваша корзина осталась",
        body: `Привет! В вашей корзине <b>${data?.itemCount || 1} товар(ов)</b>. Продолжите покупку сегодня и получите <b>${data?.discount || "скидку"}</b>! 🎁`,
      },
    },
    order_created: {
      uz: {
        title: "✅ Buyurtma qabul qilindi",
        body: `Salom! Buyurtmangiz <b>${data?.orderCode || "ORD-****"}</b> qabul qilindi. Jami: <b>${data?.total || "0"}</b>. Tayyorlanish boshlandi! 🚀`,
      },
      ru: {
        title: "✅ Заказ принят",
        body: `Привет! Ваш заказ <b>${data?.orderCode || "ORD-****"}</b> принят. Итого: <b>${data?.total || "0"}</b>. Начинаем подготовку! 🚀`,
      },
    },
    order_ready: {
      uz: {
        title: "🎉 Buyurtmangiz tayyor!",
        body: `Salom! Buyurtmangiz <b>${data?.orderCode || "ORD-****"}</b> tayyor bo'ldi! Olib ketish yoki yetkazib berilishni tayinlang. Harakat qilish vaqti! ⏰`,
      },
      ru: {
        title: "🎉 Ваш заказ готов!",
        body: `Привет! Ваш заказ <b>${data?.orderCode || "ORD-****"}</b> готов! Выберите самовывоз или доставку. Пора действовать! ⏰`,
      },
    },
    promotion: {
      uz: {
        title: "🎊 Yangi aksiya!",
        body: `<b>${data?.promoTitle || "Foydalangan chegirma"}</b> 🏷️\n\n${data?.promoDesc || "Bugungi eksklyuziv taklif - vaqt tugashdan oldin foydalaning!"}`,
      },
      ru: {
        title: "🎊 Новая акция!",
        body: `<b>${data?.promoTitle || "Используйте скидку"}</b> 🏷️\n\n${data?.promoDesc || "Эксклюзивное предложение на сегодня - спешите!"}`,
      },
    },
  };

  return (
    templates[type]?.[lang] || templates[type]?.["uz"] || { title: "Notification", body: "Message" }
  );
}

/**
 * Telegram orqali notification yuboradi va log'ga yozadi
 */
export async function notifyCustomerTelegram(
  prisma: PrismaClient,
  tenantId: string,
  customerId: string | null,
  telegramUserId: bigint | null,
  type: "CART_ABANDON" | "ORDER_READY" | "ORDER_CREATED" | "PROMOTION" | "MANUAL",
  title: string,
  body: string,
  relatedObjectType?: string,
  relatedObjectId?: string,
): Promise<BotNotificationResult> {
  if (!telegramUserId && !customerId) {
    return { sent: false, reason: "No telegram user or customer" };
  }

  // Telegram user ID'ni topish (agar customerId bo'lsa)
  let tgUserId = telegramUserId;
  if (!tgUserId && customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { telegramUserId: true },
    });
    tgUserId = customer?.telegramUserId ?? null;
  }

  if (!tgUserId) {
    await logNotification(
      prisma,
      tenantId,
      customerId,
      type,
      title,
      body,
      "failed",
      "Telegram user ID not found",
      null,
      relatedObjectType,
      relatedObjectId,
    );
    return { sent: false, reason: "No telegram user ID" };
  }

  // Bot tokenini olish
  const channel = await prisma.channel.findFirst({
    where: { tenantId, type: "TELEGRAM", active: true },
    select: { config: true },
  });
  const cfg = channel?.config as { botToken?: string } | null;
  const token = cfg?.botToken;

  if (!token) {
    await logNotification(
      prisma,
      tenantId,
      customerId,
      type,
      title,
      body,
      "failed",
      "No bot token",
      null,
      relatedObjectType,
      relatedObjectId,
    );
    return { sent: false, reason: "No bot token" };
  }

  // Notification preferences tekshirish
  if (customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        notifyOrderUpdates: true,
        notifyCartAbandonment: true,
        notifyPromotions: true,
      },
    });

    if (type === "CART_ABANDON" && !customer?.notifyCartAbandonment) {
      await logNotification(
        prisma,
        tenantId,
        customerId,
        type,
        title,
        body,
        "queued",
        "Customer opted out",
        null,
        relatedObjectType,
        relatedObjectId,
      );
      return { sent: false, reason: "Customer opted out" };
    }

    if (type === "PROMOTION" && !customer?.notifyPromotions) {
      return { sent: false, reason: "Customer opted out of promotions" };
    }

    if (
      (type === "ORDER_READY" || type === "ORDER_CREATED") &&
      !customer?.notifyOrderUpdates
    ) {
      return { sent: false, reason: "Customer opted out of order updates" };
    }
  }

  // Xabar yuborish
  const result = await sendTelegramRaw(token, tgUserId.toString(), body, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📱 Do'konda ko'rish", web_app: { url: `https://shop-flow.uz` } }],
      ],
    },
  });

  const status = result.ok ? "sent" : "failed";
  const error = result.ok ? undefined : result.description;

  await logNotification(
    prisma,
    tenantId,
    customerId,
    type,
    title,
    body,
    status,
    error,
    tgUserId,
    relatedObjectType,
    relatedObjectId,
  );

  return {
    sent: result.ok,
    reason: result.ok ? undefined : result.description,
    telegramError: result.description,
  };
}

/**
 * Notification'ni database'ga yozadi
 */
async function logNotification(
  prisma: PrismaClient,
  tenantId: string,
  customerId: string | null,
  type: "CART_ABANDON" | "ORDER_READY" | "ORDER_CREATED" | "PROMOTION" | "MANUAL",
  title: string,
  body: string,
  status: string,
  error: string | undefined,
  telegramUserId: bigint | null,
  relatedObjectType?: string,
  relatedObjectId?: string,
): Promise<void> {
  try {
    await prisma.notificationLog.create({
      data: {
        tenantId,
        customerId,
        type,
        title,
        body,
        status,
        channel: "telegram",
        telegramUserId,
        telegramError: error || null,
        relatedObjectType,
        relatedObjectId,
        sentAt: status === "sent" ? new Date() : null,
      },
    });
  } catch (err) {
    console.error("[bot-notifications] Failed to log notification", err);
  }
}

export { getNotificationTemplate };
