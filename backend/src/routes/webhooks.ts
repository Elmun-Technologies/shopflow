import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { nextLeadCode } from "../lib/codes.js";
import { aiReplyToMessage } from "../lib/ai-assistant.js";
import { sendTelegramRaw } from "../lib/telegram-notify.js";

// ─── Bot menu tugmalari ────────────────────────────────────────────────────
const BTN_SHOP    = "🛍 Do'kon";
const BTN_ORDER   = "📦 Buyurtmani kuzatish";
const BTN_SUPPORT = "🆘 Yordam";
const BTN_LANG    = "🌐 Til tanlash";

// Suhbat holati — chatId bo'yicha (xotira, server restart'da tozalanadi — qabul qilinadi)
const convState = new Map<number, "awaiting_order">();

// Barcha bot javoblari uchun doimiy pastki menyu
function buildMenu(storeUrl: string) {
  return {
    keyboard: [
      [{ text: BTN_SHOP, web_app: { url: storeUrl } }, { text: BTN_ORDER }],
      [{ text: BTN_SUPPORT },                           { text: BTN_LANG }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

// Oddiy i18n — ikki til
const i18n = {
  uz: {
    welcome:    (name: string, store: string) => `🛍 <b>${store}</b>\n\nXush kelibsiz, ${name}! Quyidagi menyudan foydalaning 👇`,
    orderAsk:   "📦 Buyurtma raqamingizni kiriting:\n<i>Masalan: ORD-7523 yoki shunchaki 7523</i>",
    orderNotFound: "❌ Buyurtma topilmadi. Raqamni tekshiring va qayta kiriting.",
    orderInfo:  (code: string, status: string, qty: number, total: string) =>
      `📦 <b>Buyurtma #${code}</b>\n\nHolati: ${status}\nMahsulotlar: ${qty} ta\nJami: ${total}`,
    support:    "🆘 <b>Yordam</b>\n\nSavol yoki muammo bo'lsa, xabar yozing — operatorimiz tez orada siz bilan bog'lanadi!",
    langSelect: "🌐 Tilni tanlang:",
    langSaved:  "✅ Til saqlandi: O'zbekcha 🇺🇿",
    cmdMenu:    "Do'konni ochish",
    cmdOrder:   "Buyurtmani kuzatish",
    cmdHelp:    "Yordam va aloqa",
  },
  ru: {
    welcome:    (name: string, store: string) => `🛍 <b>${store}</b>\n\nДобро пожаловать, ${name}! Воспользуйтесь меню ниже 👇`,
    orderAsk:   "📦 Введите номер заказа:\n<i>Например: ORD-7523 или просто 7523</i>",
    orderNotFound: "❌ Заказ не найден. Проверьте номер и попробуйте снова.",
    orderInfo:  (code: string, status: string, qty: number, total: string) =>
      `📦 <b>Заказ #${code}</b>\n\nСтатус: ${status}\nТоваров: ${qty} шт.\nИтого: ${total}`,
    support:    "🆘 <b>Поддержка</b>\n\nЕсть вопрос? Напишите сообщение — оператор свяжется с вами в ближайшее время!",
    langSelect: "🌐 Выберите язык:",
    langSaved:  "✅ Язык сохранён: Русский 🇷🇺",
    cmdMenu:    "Открыть магазин",
    cmdOrder:   "Отследить заказ",
    cmdHelp:    "Помощь и контакты",
  },
} as const;

type Lang = "uz" | "ru";

// Buyurtma holati → emoji + matn
function orderStatusLabel(status: string, lang: Lang): string {
  const labels: Record<string, Record<Lang, string>> = {
    PENDING:    { uz: "🕐 Kutilmoqda",    ru: "🕐 Ожидает обработки" },
    PROCESSING: { uz: "🔄 Tayyorlanmoqda", ru: "🔄 Готовится" },
    COMPLETED:  { uz: "✅ Yetkazildi",    ru: "✅ Доставлен" },
    CANCELLED:  { uz: "❌ Bekor qilindi", ru: "❌ Отменён" },
    REFUNDED:   { uz: "↩️ Qaytarildi",   ru: "↩️ Возвращён" },
  };
  return labels[status]?.[lang] ?? status;
}

// Channel webhook — har bir kanal `webhookKey` ga ega.
// URL: POST /api/webhooks/lead/:webhookKey
// Body: { name, phone?, email?, ...utm, value? }
//
// Bu endpoint lid yaratadi va uni kanalga bog'laydi.

const leadInSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().max(120).optional(),
  location: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  value: z.number().nonnegative().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/lead/:webhookKey", async (req, reply) => {
    const { webhookKey } = z.object({ webhookKey: z.string() }).parse(req.params);
    const data = leadInSchema.parse(req.body);

    const channel = await app.prisma.channel.findUnique({ where: { webhookKey } });
    if (!channel || !channel.active) {
      return reply.code(404).send({ error: "Channel topilmadi yoki aktiv emas" });
    }

    const code = await nextLeadCode(app.prisma, channel.tenantId);
    const lead = await app.prisma.lead.create({
      data: {
        tenantId: channel.tenantId,
        channelId: channel.id,
        code,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        company: data.company,
        location: data.location,
        notes: data.notes,
        value: data.value ?? 0,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        tags: data.tags ?? [],
        status: "NEW",
        interactions: {
          create: {
            tenantId: channel.tenantId,
            type: "STATUS_CHANGE",
            direction: "INBOUND",
            content: `Yangi lid — ${channel.name} (${channel.type}) orqali`,
            createdBy: "system",
          },
        },
      },
    });
    return reply.code(201).send({ id: lead.id, code: lead.code });
  });

  // Telegram bot webhook — persistent menu + order tracking + support + language
  app.post("/telegram/:webhookKey", async (req, reply) => {
    const { webhookKey } = z.object({ webhookKey: z.string() }).parse(req.params);
    const channel = await app.prisma.channel.findUnique({
      where: { webhookKey },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (!channel || channel.type !== "TELEGRAM" || !channel.active) {
      return reply.code(404).send({ error: "Channel topilmadi" });
    }

    const cfg = (channel.config ?? {}) as Record<string, unknown>;
    const token = cfg.botToken as string | undefined;
    const domain = process.env.DOMAIN || "shop-flow.uz";
    const storeUrl = `https://${domain}/store/${channel.tenant.slug}`;
    const tenantId = channel.tenant.id;

    type TgFrom = { id?: number; first_name?: string; last_name?: string; username?: string };
    type TgMsg  = { chat?: { id?: number }; from?: TgFrom; text?: string };

    // ─── callback_query (til tanlash inline buttons) ───────────────────────
    const cbQuery = (req.body as {
      callback_query?: { id: string; from?: TgFrom; data?: string; message?: TgMsg };
    }).callback_query;

    if (cbQuery?.data?.startsWith("lang_")) {
      const from = cbQuery.from;
      const cbChatId = cbQuery.message?.chat?.id ?? from?.id;
      const newLang: Lang = cbQuery.data === "lang_ru" ? "ru" : "uz";

      // Spinnerни tezda dismiss qilamiz (fire-and-forget, 10s limit'dan oldin)
      if (token) {
        fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: cbQuery.id }),
        }).catch(() => null);
      }

      if (from?.id) {
        // Buyurtma bermagan bot foydalanuvchisi uchun ham Customer yozuvi yaratamiz
        const tgId = BigInt(from.id);
        const existingCust = await app.prisma.customer.findFirst({
          where: { tenantId, telegramUserId: tgId },
          select: { id: true },
        });
        if (existingCust) {
          await app.prisma.customer.update({ where: { id: existingCust.id }, data: { language: newLang } });
        } else {
          await app.prisma.customer.create({
            data: {
              tenantId,
              telegramUserId: tgId,
              telegramUsername: (from as { username?: string }).username,
              name: [from.first_name, from.last_name].filter(Boolean).join(" ") || "Telegram foydalanuvchi",
              language: newLang,
            },
          });
        }
      }

      if (token && cbChatId) {
        await sendTelegramRaw(
          token, cbChatId,
          newLang === "ru" ? i18n.ru.langSaved : i18n.uz.langSaved,
          { reply_markup: buildMenu(storeUrl) },
        );
      }
      return { ok: true, action: "lang_saved" };
    }

    // ─── Oddiy matn xabari ─────────────────────────────────────────────────
    const msg = (req.body as { message?: TgMsg }).message;
    if (!msg?.from || !msg?.text) {
      return { ok: true, skipped: true };
    }

    const chatId = msg.chat?.id ?? msg.from.id;
    if (!chatId) return { ok: true, skipped: true };

    const text = msg.text.trim();
    const tgUserId = msg.from.id;
    const displayName =
      [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ") ||
      "Telegram foydalanuvchi";

    // Mijoz tilini DB'dan olamiz (default "uz")
    let lang: Lang = "uz";
    if (tgUserId) {
      const cust = await app.prisma.customer.findFirst({
        where: { tenantId, telegramUserId: BigInt(tgUserId) },
        select: { language: true },
      });
      if (cust?.language === "ru") lang = "ru";
    }
    const T = i18n[lang];

    // ─── /start ────────────────────────────────────────────────────────────
    if (text === "/start" || text.startsWith("/start ")) {
      convState.delete(chatId);
      if (token) {
        await sendTelegramRaw(
          token, chatId,
          T.welcome(msg.from.first_name || "Do'stim", channel.tenant.name),
          { reply_markup: buildMenu(storeUrl) },
        );
        // BotFather slash command menyusini ro'yxatdan o'tkazamiz (fire-and-forget)
        fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commands: [
              { command: "start",    description: T.cmdMenu },
              { command: "buyurtma", description: T.cmdOrder },
              { command: "yordam",   description: T.cmdHelp },
            ],
          }),
        }).catch(() => null);
      }
      return { ok: true, action: "start_sent" };
    }

    // Tanilgan tugma bosishlari — konversatsiya/lead yozuvini o'tkazib yuboramiz
    const isKnownButton =
      text === BTN_SHOP || text === BTN_ORDER || text === BTN_SUPPORT || text === BTN_LANG ||
      text === "/buyurtma" || text === "/yordam";

    // ─── Konversatsiya yozuvi (admin Chat sahifasi uchun) ─────────────────
    if (!isKnownButton && tgUserId) {
      const tgUidBig = BigInt(tgUserId);
      const existingCustomer = await app.prisma.customer.findFirst({
        where: { tenantId, telegramUserId: tgUidBig },
        select: { id: true, name: true },
      });
      const externalId = String(tgUserId);

      let conv = await app.prisma.conversation.findFirst({
        where: { tenantId, channelId: channel.id, externalUserId: externalId },
        select: { id: true, status: true },
      });
      if (!conv) {
        conv = await app.prisma.conversation.create({
          data: {
            tenantId,
            channelId: channel.id,
            customerId: existingCustomer?.id ?? null,
            externalUserId: externalId,
            customerName: existingCustomer?.name ?? displayName,
            status: "ACTIVE",
            lastMessageAt: new Date(),
            lastMessagePreview: text.slice(0, 120),
            unreadCount: 1,
          },
          select: { id: true, status: true },
        });
      } else {
        await app.prisma.conversation.update({
          where: { id: conv.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: text.slice(0, 120),
            unreadCount: { increment: 1 },
            status: conv.status === "RESOLVED" || conv.status === "ARCHIVED" ? "ACTIVE" : conv.status,
            ...(existingCustomer?.id && { customerId: existingCustomer.id }),
          },
        });
      }
      await app.prisma.conversationMessage.create({
        data: {
          conversationId: conv.id,
          direction: "INBOUND",
          content: text,
          authorName: displayName,
        },
      });
    }

    // ─── Buyurtma kuzatish holati ─────────────────────────────────────────
    if (convState.get(chatId) === "awaiting_order" && !isKnownButton) {
      convState.delete(chatId);

      const raw = text.toUpperCase();
      const orderCode = raw.startsWith("ORD-") ? raw : `ORD-${raw}`;
      const order = await app.prisma.order.findFirst({
        where: { tenantId, code: orderCode },
        select: { code: true, status: true, total: true, currency: true, items: { select: { id: true } } },
      });

      if (!order) {
        if (token) {
          await sendTelegramRaw(token, chatId, T.orderNotFound, {
            reply_markup: buildMenu(storeUrl),
          });
        }
        return { ok: true, action: "order_not_found" };
      }

      const statusLabel = orderStatusLabel(order.status, lang);
      const totalNum = Number(order.total);
      const totalStr = order.currency === "UZS"
        ? `${totalNum.toLocaleString("uz-UZ")} so'm`
        : `${totalNum} ${order.currency}`;

      if (token) {
        await sendTelegramRaw(
          token, chatId,
          T.orderInfo(order.code, statusLabel, order.items.length, totalStr),
          { reply_markup: buildMenu(storeUrl) },
        );
      }
      return { ok: true, action: "order_shown" };
    }

    // ─── Tugma handlerlari ────────────────────────────────────────────────
    if (text === BTN_ORDER || text === "/buyurtma") {
      convState.set(chatId, "awaiting_order");
      if (token) {
        await sendTelegramRaw(token, chatId, T.orderAsk, { reply_markup: buildMenu(storeUrl) });
      }
      return { ok: true, action: "order_ask" };
    }

    if (text === BTN_SUPPORT || text === "/yordam") {
      if (token) {
        await sendTelegramRaw(token, chatId, T.support, { reply_markup: buildMenu(storeUrl) });
      }
      return { ok: true, action: "support_sent" };
    }

    if (text === BTN_LANG) {
      if (token) {
        await sendTelegramRaw(token, chatId, T.langSelect, {
          reply_markup: {
            inline_keyboard: [[
              { text: "🇺🇿 O'zbekcha", callback_data: "lang_uz" },
              { text: "🇷🇺 Русский",    callback_data: "lang_ru" },
            ]],
          },
        });
      }
      return { ok: true, action: "lang_ask" };
    }

    // ─── AI yordamchi → lead fallback ────────────────────────────────────
    const aiResult = await aiReplyToMessage(app.prisma, channel.tenantId, text).catch(
      (err): Awaited<ReturnType<typeof aiReplyToMessage>> => {
        app.log.warn({ err }, "AI assistant failed, falling back to lead");
        return { used: false, reason: "exception" };
      },
    );

    if (aiResult.used && aiResult.text && !aiResult.handoffToOperator) {
      if (token) {
        const replyMarkup = aiResult.productIds?.length
          ? {
              inline_keyboard: [[
                { text: `🛒 ${channel.tenant.name} do'koniga kirish`, web_app: { url: storeUrl } },
              ]],
            }
          : buildMenu(storeUrl);
        await sendTelegramRaw(token, chatId, aiResult.text, { reply_markup: replyMarkup });
      }
      const leadCode = await nextLeadCode(app.prisma, channel.tenantId);
      await app.prisma.lead.create({
        data: {
          tenantId: channel.tenantId,
          channelId: channel.id,
          code: leadCode,
          name: displayName,
          notes: `[AI replied] ${text.slice(0, 200)}`,
          status: "CONTACTED",
          interactions: {
            create: [
              { tenantId: channel.tenantId, type: "TELEGRAM", direction: "INBOUND", content: text, createdBy: displayName },
              { tenantId: channel.tenantId, type: "TELEGRAM", direction: "OUTBOUND", content: aiResult.text, createdBy: "AI Assistant" },
            ],
          },
        },
      });
      return { ok: true, action: "ai_replied" };
    }

    // Fallback — tushunilmagan xabarni lid sifatida saqlaymiz
    const leadCode = await nextLeadCode(app.prisma, channel.tenantId);
    const lead = await app.prisma.lead.create({
      data: {
        tenantId: channel.tenantId,
        channelId: channel.id,
        code: leadCode,
        name: displayName,
        notes: text.slice(0, 500),
        status: "NEW",
        interactions: {
          create: {
            tenantId: channel.tenantId,
            type: "TELEGRAM",
            direction: "INBOUND",
            content: text,
            createdBy: displayName,
          },
        },
      },
    });

    if (token) {
      await sendTelegramRaw(
        token, chatId,
        "✅ Xabaringiz qabul qilindi. Tez orada operatorimiz siz bilan bog'lanadi!",
        { reply_markup: buildMenu(storeUrl) },
      );
    }

    return { ok: true, leadId: lead.id, code: lead.code };
  });

  // MoySklad webhook qabul qiluvchi
  // URL: POST /api/webhooks/moysklad/:tenantId
  // Body: { events: [{ meta: { type, href }, action, accountId, ... }], requestId }
  //
  // Idempotentlik: har bir requestId 1 marta qayta ishlanadi.
  // Hozirgi MVP: event'ni saqlash + lastWebhookAt ni yangilash. To'liq re-fetch
  // keyingi iteratsiyada (queue + worker bilan).
  app.post<{ Params: { tenantId: string } }>("/moysklad/:tenantId", async (req, reply) => {
    const { tenantId } = req.params;
    // Basic validatsiya — tenantId UUID formatida bo'lishi shart
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) {
      return reply.code(400).send({ error: "Noto'g'ri tenant ID" });
    }
    const acc = await app.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    // Mavjud bo'lmasa yoki o'chirilgan bo'lsa — xato emas, shunchaki tashlaymiz
    // (MoySklad'ga 200 qaytarmasak, qayta-qayta urinadi)
    if (!acc || !acc.connectedAt) return reply.code(200).send({ ok: true, skipped: true });

    type Event = { meta?: { type?: string; href?: string }; action?: string; accountId?: string };
    const body = req.body as { events?: Event[]; requestId?: string } | undefined;
    if (!body?.events?.length) {
      return { ok: true, skipped: true };
    }

    const requestId = body.requestId ?? `noreq-${Date.now()}`;

    // Idempotentlik — TOCTOU'siz: to'g'ridan-to'g'ri create urinamiz, P2002 (unique
    // buzilishi) bo'lsa bu dublikat demak → no-op muvaffaqiyat. Ilgari findUnique +
    // alohida create ikki bir vaqtdagi dublikatni o'tkazib, biri 500 berardi.
    try {
      await app.prisma.webhookEvent.create({
        data: {
          tenantId,
          source: "moysklad",
          externalId: requestId,
          entityType: body.events[0].meta?.type ?? null,
          action: body.events[0].action ?? null,
          payload: body as never,
          processed: true,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ok: true, duplicate: true };
      }
      throw err;
    }

    await app.prisma.moyskladAccount.update({
      where: { tenantId },
      data: { lastWebhookAt: new Date() },
    });

    // MoySklad 200 javobni 5 sek ichida kutadi — uzun ish fonda
    return { ok: true, received: body.events.length };
  });
};
