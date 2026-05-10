import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { decrypt } from "../lib/crypto.js";
import { sendMessage } from "../services/telegram.js";
import { emit } from "../lib/events.js";

/**
 * Operator chat — admin Telegram orqali keluvchi xabarlarni ko'radi va javob beradi.
 * - GET  /api/chat/conversations - mijozlar ro'yxati (oxirgi xabar bilan)
 * - GET  /api/chat/messages/:tgUserId - aniq mijoz bilan suhbat tarixi
 * - POST /api/chat/send - admin mijozga xabar yuboradi (bot orqali)
 */
export default async function chatRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  function shopIdOf(req: { user: unknown }): string {
    const u = req.user as { kind?: string; shopId?: string };
    if (u.kind === "miniapp") throw new Error("Admin token kerak");
    if (!u.shopId) throw new Error("shopId yo'q");
    return u.shopId;
  }

  /** Suhbatlar ro'yxati: har mijoz uchun oxirgi xabar */
  app.get("/conversations", async (req) => {
    const sid = shopIdOf(req);
    const tgUsers = await db.query.tgUsers.findMany({ where: eq(schema.tgUsers.shopId, sid) });
    const result = [];
    for (const tu of tgUsers) {
      // Eng oxirgi xabar
      const lastMsg = await db.query.botMessages.findFirst({
        where: eq(schema.botMessages.tgUserId, tu.id),
        orderBy: [desc(schema.botMessages.createdAt)],
      });
      // Total messages
      const counts = await db.select({ count: sql<number>`count(*)`.as("count") })
        .from(schema.botMessages)
        .where(eq(schema.botMessages.tgUserId, tu.id));
      result.push({
        tgUserId: tu.id,
        externalTgUserId: tu.tgUserId,
        firstName: tu.firstName,
        lastName: tu.lastName,
        username: tu.username,
        phone: tu.phone,
        lastMessageAt: lastMsg?.createdAt ?? null,
        lastMessagePreview: extractPreview(lastMsg?.payload),
        lastMessageDirection: lastMsg?.direction ?? null,
        messageCount: counts[0]?.count ?? 0,
      });
    }
    // Sort by last message
    result.sort((a, b) => Number(b.lastMessageAt ?? 0) - Number(a.lastMessageAt ?? 0));
    return result;
  });

  /** Aniq mijoz bilan suhbat tarixi */
  app.get("/messages/:tgUserId", async (req, reply) => {
    const sid = shopIdOf(req);
    const params = z.object({ tgUserId: z.string() }).parse(req.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);

    const tgUser = await db.query.tgUsers.findFirst({
      where: and(eq(schema.tgUsers.id, params.tgUserId), eq(schema.tgUsers.shopId, sid)),
    });
    if (!tgUser) return reply.code(404).send({ error: "Mijoz topilmadi" });

    const messages = await db.query.botMessages.findMany({
      where: eq(schema.botMessages.tgUserId, params.tgUserId),
      orderBy: [schema.botMessages.createdAt],
      limit: query.limit,
    });
    return {
      user: {
        id: tgUser.id,
        firstName: tgUser.firstName,
        lastName: tgUser.lastName,
        username: tgUser.username,
        phone: tgUser.phone,
      },
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        text: extractText(m.payload),
        type: m.messageType,
        createdAt: m.createdAt,
      })),
    };
  });

  /** Admin mijozga xabar yuboradi — bot orqali */
  app.post("/send", async (req, reply) => {
    const sid = shopIdOf(req);
    const body = z.object({
      tgUserId: z.string(),
      text: z.string().min(1).max(4000),
    }).parse(req.body);

    const tgUser = await db.query.tgUsers.findFirst({
      where: and(eq(schema.tgUsers.id, body.tgUserId), eq(schema.tgUsers.shopId, sid)),
    });
    if (!tgUser) return reply.code(404).send({ error: "Mijoz topilmadi" });

    const bot = await db.query.bots.findFirst({
      where: and(eq(schema.bots.shopId, sid), eq(schema.bots.status, "active")),
    });
    if (!bot) return reply.code(400).send({ error: "Faol bot yo'q" });

    const token = decrypt(bot.tokenEncrypted);
    try {
      await sendMessage(token, tgUser.tgUserId, body.text);
    } catch (err) {
      return reply.code(500).send({ error: err instanceof Error ? err.message : "Yuborilmadi" });
    }

    // Log qilish
    const [logged] = await db.insert(schema.botMessages).values({
      botId: bot.id,
      tgUserId: tgUser.id,
      direction: "out",
      messageType: "operator_reply",
      payload: { text: body.text } as never,
    }).returning();

    // Real-time admin tomonida yangilash
    emit({ type: "order.updated", shopId: sid, orderId: "", status: "" }); // hack: existing event

    return { id: logged.id, ok: true };
  });
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  // Operator reply
  if (typeof p.text === "string") return p.text;
  // Telegram update
  const msg = (p.message ?? p.callback_query) as Record<string, unknown> | undefined;
  if (msg) {
    if (typeof msg.text === "string") return msg.text;
    if (typeof msg.data === "string") return `[tugma: ${msg.data}]`;
    if (msg.contact) return "[telefon raqam]";
    if (msg.photo) return "[rasm]";
    if (msg.web_app_data) return "[Mini App ma'lumoti]";
  }
  return null;
}

function extractPreview(payload: unknown): string {
  const text = extractText(payload);
  if (!text) return "—";
  return text.length > 60 ? text.slice(0, 60) + "…" : text;
}
