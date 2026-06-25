import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { nextLeadCode } from "../lib/codes.js";
import { aiReplyToMessage } from "../lib/ai-assistant.js";

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

  // Telegram bot webhook
  // /start → Mini App tugmasi bilan javob qaytaradi
  // Boshqa xabarlar → lid sifatida saqlanadi
  app.post("/telegram/:webhookKey", async (req, reply) => {
    const { webhookKey } = z.object({ webhookKey: z.string() }).parse(req.params);
    const channel = await app.prisma.channel.findUnique({
      where: { webhookKey },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    if (!channel || channel.type !== "TELEGRAM" || !channel.active) {
      return reply.code(404).send({ error: "Channel topilmadi" });
    }

    type TgFrom = { id?: number; first_name?: string; last_name?: string; username?: string };
    type TgMsg = { chat?: { id?: number }; from?: TgFrom; text?: string };
    const body = req.body as { message?: TgMsg; callback_query?: { from?: TgFrom; message?: TgMsg } };
    const msg = body?.message ?? body?.callback_query?.message;
    if (!msg?.from || !msg?.text) {
      return { ok: true, skipped: true };
    }

    const config = (channel.config ?? {}) as Record<string, unknown>;
    const token = config.botToken as string | undefined;
    const chatId = msg.chat?.id ?? msg.from?.id;
    const firstName = msg.from?.first_name || "Do'stim";

    // ─── Konversatsiya yozuvi (admin Chat sahifasi uchun) ─────────────
    // Mijoz qaytarilgan mavjudligini telegramUserId bo'yicha aniqlaymiz.
    if (msg.from?.id && msg.text && msg.text !== "/start") {
      const tgUidBig = BigInt(msg.from.id);
      const existingCustomer = await app.prisma.customer.findFirst({
        where: { tenantId: channel.tenant.id, telegramUserId: tgUidBig },
        select: { id: true, name: true },
      });
      const externalId = String(msg.from.id);
      const displayName = [msg.from.first_name, msg.from.last_name].filter(Boolean).join(" ") || "Telegram foydalanuvchi";

      // Konversatsiyani upsert (externalUserId + channelId bo'yicha)
      let conv = await app.prisma.conversation.findFirst({
        where: {
          tenantId: channel.tenant.id,
          channelId: channel.id,
          externalUserId: externalId,
        },
        select: { id: true, status: true },
      });
      if (!conv) {
        conv = await app.prisma.conversation.create({
          data: {
            tenantId: channel.tenant.id,
            channelId: channel.id,
            customerId: existingCustomer?.id ?? null,
            externalUserId: externalId,
            customerName: existingCustomer?.name ?? displayName,
            status: "ACTIVE",
            lastMessageAt: new Date(),
            lastMessagePreview: msg.text.slice(0, 120),
            unreadCount: 1,
          },
          select: { id: true, status: true },
        });
      } else {
        await app.prisma.conversation.update({
          where: { id: conv.id },
          data: {
            lastMessageAt: new Date(),
            lastMessagePreview: msg.text.slice(0, 120),
            unreadCount: { increment: 1 },
            // Yopiq konversatsiya yangi xabar bilan qayta ochiladi
            status: conv.status === "RESOLVED" || conv.status === "ARCHIVED" ? "ACTIVE" : conv.status,
            // Customer keyinroq ro'yxatdan o'tsa, bog'lab qo'yamiz
            ...(existingCustomer?.id && { customerId: existingCustomer.id }),
          },
        });
      }
      await app.prisma.conversationMessage.create({
        data: {
          conversationId: conv.id,
          direction: "INBOUND",
          content: msg.text,
          authorName: displayName,
        },
      });
    }
    // ──────────────────────────────────────────────────────────────────
    const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || "Telegram foydalanuvchi";

    // /start — Mini App tugmasi bilan javob
    if (msg.text === "/start" && token && chatId) {
      const domain = process.env.DOMAIN || "shop-flow.uz";
      const storeUrl = `https://${domain}/store/${channel.tenant.slug}`;
      const storeName = channel.tenant.name;

      try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🛍 <b>${storeName}</b>\n\nXush kelibsiz, ${firstName}! Quyidagi tugmani bosib do'konga kiring 👇`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                {
                  text: "🛒 Do'konga kirish",
                  web_app: { url: storeUrl },
                },
              ]],
            },
          }),
        });
      } catch {
        // sendMessage xatosi — loglash uchun yetarli
      }
      return { ok: true, action: "start_sent" };
    }

    // AI yordamchi — agar ANTHROPIC_API_KEY sozlangan bo'lsa, mijozga to'g'ridan-to'g'ri
    // javob qaytaradi. Bo'lmasa fallback (lead yaratish) ishlaydi.
    const aiResult = await aiReplyToMessage(app.prisma, channel.tenantId, msg.text).catch(
      (err): Awaited<ReturnType<typeof aiReplyToMessage>> => {
        app.log.warn({ err }, "AI assistant failed, falling back to lead");
        return { used: false, reason: "exception" };
      },
    );

    if (aiResult.used && aiResult.text && !aiResult.handoffToOperator) {
      // AI muvaffaqiyatli javob berdi — mijozga yuboramiz, interaction sifatida saqlaymiz
      if (token && chatId) {
        const replyMarkup = aiResult.productIds?.length
          ? {
              inline_keyboard: [[
                {
                  text: `🛒 ${channel.tenant.name} do'koniga kirish`,
                  web_app: { url: `https://${process.env.DOMAIN || "shop-flow.uz"}/store/${channel.tenant.slug}` },
                },
              ]],
            }
          : undefined;
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: aiResult.text,
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          }),
        }).catch(() => null);
      }
      // AI suhbatini ham lead/interaction sifatida saqlaymiz (tarix uchun)
      const code = await nextLeadCode(app.prisma, channel.tenantId);
      await app.prisma.lead.create({
        data: {
          tenantId: channel.tenantId,
          channelId: channel.id,
          code,
          name,
          notes: `[AI replied] ${msg.text.slice(0, 200)}`,
          status: "CONTACTED",
          interactions: {
            create: [
              {
                tenantId: channel.tenantId,
                type: "TELEGRAM",
                direction: "INBOUND",
                content: msg.text,
                createdBy: name,
              },
              {
                tenantId: channel.tenantId,
                type: "TELEGRAM",
                direction: "OUTBOUND",
                content: aiResult.text,
                createdBy: "AI Assistant",
              },
            ],
          },
        },
      });
      return { ok: true, action: "ai_replied" };
    }

    // Boshqa xabarlar (yoki AI handoff so'ragan) — lid sifatida saqlash
    const code = await nextLeadCode(app.prisma, channel.tenantId);
    const lead = await app.prisma.lead.create({
      data: {
        tenantId: channel.tenantId,
        channelId: channel.id,
        code,
        name,
        notes: msg.text.slice(0, 500),
        status: "NEW",
        interactions: {
          create: {
            tenantId: channel.tenantId,
            type: "TELEGRAM",
            direction: "INBOUND",
            content: msg.text,
            createdBy: name,
          },
        },
      },
    });

    // Oddiy tasdiqlash xabari
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "✅ Xabaringiz qabul qilindi. Tez orada operatorimiz siz bilan bog'lanadi!",
        }),
      }).catch(() => null);
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
