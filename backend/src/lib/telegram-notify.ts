// Telegram bot orqali tenant mijozlariga xabar yuboruvchi yordamchi.
// Foydalanish:
//   await notifyTelegram(prisma, tenantId, customer, "🎉 Buyurtmangiz tayyor!");
// Agar tenant'ning Telegram kanali yo'q yoki bot tokeni yo'q bo'lsa, jim qaytadi.

import type { PrismaClient } from "@prisma/client";

interface BotConfig {
  botToken?: string;
}

// Telegram API javobini parse qilib batafsil natijani qaytaramiz —
// shu orqali admin diagnostika ko'rinishida nima xato bo'lganini aniq aytadi.
export interface TelegramSendResult {
  ok: boolean;
  errorCode?: number; // Telegram bot API'ning error code (400, 403, ...)
  description?: string;
}

async function sendTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
  options?: Record<string, unknown>,
): Promise<TelegramSendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...options,
      }),
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error_code?: number;
      description?: string;
    };
    if (!res.ok || body.ok === false) {
      console.warn("[tg-notify] sendMessage failed", res.status, body.description?.slice(0, 200));
      return { ok: false, errorCode: body.error_code ?? res.status, description: body.description };
    }
    return { ok: true };
  } catch (err) {
    const description = err instanceof Error ? err.message : String(err);
    console.warn("[tg-notify] network error", err);
    return { ok: false, description };
  } finally {
    clearTimeout(timer);
  }
}

// Sanity test — bot tokeni haqiqatdan ishlayotganini tekshirish (getMe).
export async function pingBotToken(
  token: string,
): Promise<{ ok: boolean; username?: string; description?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { username?: string; first_name?: string };
      description?: string;
    };
    if (!res.ok || body.ok === false) {
      return { ok: false, description: body.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, username: body.result?.username };
  } catch (err) {
    return { ok: false, description: err instanceof Error ? err.message : String(err) };
  }
}

// Tashqi chaqiruvchilar uchun — boshqa moduldan ishlatamiz (test endpoint va h.k.)
export async function sendTelegramRaw(
  token: string,
  chatId: number | string,
  text: string,
  options?: Record<string, unknown>,
): Promise<TelegramSendResult> {
  return sendTelegramMessage(token, chatId, text, options);
}

interface NotifyResult {
  sent: boolean;
  reason?: string;
}

/** Tenant'ning Telegram kanali tokenini topadi (birinchi aktiv TELEGRAM Channel) */
async function getTenantBotToken(prisma: PrismaClient, tenantId: string): Promise<string | null> {
  const channel = await prisma.channel.findFirst({
    where: { tenantId, type: "TELEGRAM", active: true },
    select: { config: true },
  });
  if (!channel) return null;
  const cfg = channel.config as BotConfig | null;
  return cfg?.botToken?.trim() || null;
}

/** Mijozning Telegram chat ID — Customer.telegramUserId. */
async function getCustomerTelegramId(prisma: PrismaClient, customerId: string): Promise<bigint | null> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { telegramUserId: true },
  });
  return customer?.telegramUserId ?? null;
}

/** Bitta mijozga xabar yuborish (chat ID'ni Customer'dan oladi) */
export async function notifyCustomer(
  prisma: PrismaClient,
  tenantId: string,
  customerId: string,
  text: string,
  options?: Record<string, unknown>,
): Promise<NotifyResult> {
  const tgId = await getCustomerTelegramId(prisma, customerId);
  if (!tgId) return { sent: false, reason: "Customer has no telegramUserId" };

  const token = await getTenantBotToken(prisma, tenantId);
  if (!token) return { sent: false, reason: "Tenant has no Telegram bot token" };

  const result = await sendTelegramMessage(token, tgId.toString(), text, options);
  if (result.ok) return { sent: true };
  // Telegram'ning aniq xatoligini reason'ga uzatamiz (403 = forbidden / start qilmagan)
  return {
    sent: false,
    reason: result.errorCode === 403
      ? "Mijoz bot bilan suhbatni boshlamagan (/start bosmagan)"
      : result.description ?? "sendMessage rejected",
  };
}

/**
 * Customer yozuvi yo'q bo'lganda Telegram userId orqali to'g'ridan-to'g'ri
 * xabar yuborish (cart abandonment va shu kabi holatlar uchun).
 */
export async function notifyCustomerByTelegramId(
  prisma: PrismaClient,
  tenantId: string,
  telegramUserId: bigint,
  text: string,
  options?: Record<string, unknown>,
): Promise<NotifyResult> {
  const token = await getTenantBotToken(prisma, tenantId);
  if (!token) return { sent: false, reason: "Tenant has no Telegram bot token" };

  const result = await sendTelegramMessage(token, telegramUserId.toString(), text, options);
  if (result.ok) return { sent: true };
  return {
    sent: false,
    reason: result.errorCode === 403
      ? "Foydalanuvchi bot bilan suhbatni boshlamagan"
      : result.description ?? "sendMessage rejected",
  };
}

/** Buyurtma status'i o'zgarganda standart xabar formatlash + yuborish. */
export async function notifyOrderStatusChange(
  prisma: PrismaClient,
  tenantId: string,
  orderId: string,
  oldStatus: string,
  newStatus: string,
): Promise<NotifyResult> {
  if (oldStatus === newStatus) return { sent: false, reason: "Status unchanged" };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      code: true,
      total: true,
      currency: true,
      customerId: true,
    },
  });
  if (!order || !order.customerId) return { sent: false, reason: "Order or customer missing" };

  // Notification opt-out — mijoz "buyurtma yangiliklari" ni o'chirgan bo'lsa, jim
  const cust = await prisma.customer.findUnique({
    where: { id: order.customerId },
    select: { notifyOrderUpdates: true },
  });
  if (cust && !cust.notifyOrderUpdates) {
    return { sent: false, reason: "Customer opted out of order updates" };
  }

  const text = formatStatusMessage(order.code, Number(order.total), order.currency, newStatus);
  if (!text) return { sent: false, reason: `No template for status ${newStatus}` };

  return notifyCustomer(prisma, tenantId, order.customerId, text);
}

function formatStatusMessage(orderCode: string, total: number, currency: string, status: string): string | null {
  const totalStr = currency === "UZS" ? `${total.toLocaleString("uz-UZ")} so'm` : `${total} ${currency}`;
  const templates: Record<string, { emoji: string; title: string; body: string }> = {
    PENDING: {
      emoji: "🆕",
      title: "Yangi buyurtma qabul qilindi",
      body: "Mahsulotlar tayyorlanmoqda. Status o'zgarganda xabar yuboramiz.",
    },
    PROCESSING: {
      emoji: "🔄",
      title: "Buyurtmangiz tayyorlanmoqda",
      body: "Buyurtmangiz tayyorlanmoqda. Tez orada yetkazib beriladi.",
    },
    COMPLETED: {
      emoji: "✅",
      title: "Buyurtmangiz yetkazildi",
      body: "Bizdan xarid qilganingiz uchun rahmat!",
    },
    CANCELLED: {
      emoji: "❌",
      title: "Buyurtma bekor qilindi",
      body: "Agar bu xato bo'lsa, operatorimiz bilan bog'laning.",
    },
    REFUNDED: {
      emoji: "↩️",
      title: "Mablag' qaytarildi",
      body: "Mablag'ingiz hisobingizga qaytarildi.",
    },
  };
  const t = templates[status];
  if (!t) return null;
  return `${t.emoji} <b>${t.title}</b>\n\nBuyurtma: <b>#${orderCode}</b>\nSumma: ${totalStr}\n\n${t.body}`;
}

// ─── Admin xabarnomalar ────────────────────────────────────────────────────────

/**
 * Admin o'z telegramiga xabar olishi uchun.
 * TenantNotifSettings.adminTelegramChatId + tenant'ning bot tokeni ishlatiladi.
 * Agar adminTelegramChatId yo'q bo'lsa — jim qaytadi.
 */
export async function notifyAdmin(
  prisma: PrismaClient,
  tenantId: string,
  text: string,
): Promise<NotifyResult> {
  const settings = await prisma.tenantNotifSettings.findUnique({
    where: { tenantId },
    select: { adminTelegramChatId: true },
  });
  if (!settings?.adminTelegramChatId) return { sent: false, reason: "adminTelegramChatId not set" };

  const token = await getTenantBotToken(prisma, tenantId);
  if (!token) return { sent: false, reason: "No Telegram bot token" };

  const result = await sendTelegramMessage(token, settings.adminTelegramChatId.toString(), text);
  if (result.ok) return { sent: true };
  return { sent: false, reason: result.description ?? "sendMessage rejected" };
}

export async function notifyAdminNewOrder(
  prisma: PrismaClient,
  tenantId: string,
  code: string,
  total: number,
  currency: string,
  customerName?: string | null,
): Promise<void> {
  const totalStr = currency === "UZS"
    ? `${total.toLocaleString("uz-UZ")} so'm`
    : `${total} ${currency}`;
  const who = customerName ? `\nMijoz: ${customerName}` : "";
  const text = `🛒 <b>Yangi buyurtma</b>\n\n#${code} · ${totalStr}${who}`;
  notifyAdmin(prisma, tenantId, text).catch(() => null);
}

export async function notifyAdminNewLead(
  prisma: PrismaClient,
  tenantId: string,
  name: string,
  phone?: string | null,
  source?: string | null,
): Promise<void> {
  const contact = phone ? `\nTelefon: ${phone}` : "";
  const src = source ? `\nManba: ${source}` : "";
  const text = `📥 <b>Yangi lid</b>\n\n${name}${contact}${src}`;
  notifyAdmin(prisma, tenantId, text).catch(() => null);
}
