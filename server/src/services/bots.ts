import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { encrypt, decrypt, randomHex } from "../lib/crypto.js";
import * as tg from "./telegram.js";
import { startBotInstance, stopBotInstance } from "../bot/runtime.js";

function buildMiniappUrl(botId: string, originOverride?: string | null): string | null {
  // Priority: explicit origin (dashboard URL) > WEB_URL env > PUBLIC_URL env
  const candidate = originOverride || process.env.WEB_URL || process.env.PUBLIC_URL || "";
  if (!candidate) return null;
  const base = candidate.replace(/\/$/, "");
  // Telegram Mini App HTTPS talab qiladi — http URL qabul qilinmaydi
  if (!base.startsWith("https://")) {
    if (base.startsWith("http://localhost") || base.startsWith("http://127.")) {
      // Localhost development uchun http qabul qilinadi (Telegram'da ishlamaydi, ammo edit qilish mumkin)
      return `${base}/mini/${botId}`;
    }
    return null;
  }
  return `${base}/mini/${botId}`;
}

export async function connectBot(input: { shopId: string; token: string; originUrl?: string | null }) {
  const { shopId, token, originUrl } = input;

  if (!tg.validateTokenFormat(token)) {
    throw new Error("Token formati noto'g'ri. BotFather'dan olgan tokenni to'liq nusxalang.");
  }

  const me = await tg.getMe(token);

  const existing = await db.query.bots.findFirst({ where: eq(schema.bots.botUserId, String(me.id)) });
  if (existing && existing.shopId !== shopId) {
    throw new Error("Bu bot boshqa do'konga ulangan.");
  }

  const webhookSecret = randomHex(32);
  const tokenEncrypted = encrypt(token);

  let bot;
  if (existing) {
    [bot] = await db.update(schema.bots)
      .set({ tokenEncrypted, username: me.username, webhookSecret, status: "active", lastError: null })
      .where(eq(schema.bots.id, existing.id))
      .returning();
  } else {
    [bot] = await db.insert(schema.bots).values({
      shopId,
      tokenEncrypted,
      username: me.username,
      botUserId: String(me.id),
      webhookSecret,
      status: "active",
    }).returning();
  }

  const miniappUrl = buildMiniappUrl(bot.id, originUrl);
  if (miniappUrl) {
    await db.update(schema.bots).set({ miniappUrl }).where(eq(schema.bots.id, bot.id));
    bot.miniappUrl = miniappUrl;
    try {
      await tg.setChatMenuButton(token, miniappUrl, "🛍 Do'kon");
    } catch (err) {
      console.warn("setChatMenuButton xatosi:", err);
    }
  }

  const publicUrl = process.env.PUBLIC_URL?.replace(/\/$/, "");
  if (publicUrl) {
    try {
      await tg.setWebhook(token, `${publicUrl}/tg/webhook/${bot.id}`, webhookSecret);
    } catch (err) {
      await db.update(schema.bots)
        .set({ status: "error", lastError: err instanceof Error ? err.message : "webhook xatosi" })
        .where(eq(schema.bots.id, bot.id));
      throw err;
    }
  } else {
    try {
      await tg.deleteWebhook(token);
    } catch {
      /* webhook bo'lmasa ham mayli */
    }
    startBotInstance(bot.id, token);
  }

  return {
    id: bot.id,
    username: bot.username,
    status: bot.status,
    mode: publicUrl ? "webhook" : "polling",
    miniappUrl: bot.miniappUrl,
  };
}

export async function disconnectBot(input: { shopId: string; botId: string }) {
  const bot = await db.query.bots.findFirst({
    where: and(eq(schema.bots.id, input.botId), eq(schema.bots.shopId, input.shopId)),
  });
  if (!bot) throw new Error("Bot topilmadi");

  const token = decrypt(bot.tokenEncrypted);
  try {
    await tg.deleteWebhook(token);
  } catch {
    /* tashqi xato — DB tomonidan davom etamiz */
  }
  stopBotInstance(bot.id);
  await db.delete(schema.bots).where(eq(schema.bots.id, bot.id));
  return { ok: true };
}

export async function listBots(shopId: string) {
  const rows = await db.query.bots.findMany({ where: eq(schema.bots.shopId, shopId) });
  return rows.map((b) => ({
    id: b.id,
    username: b.username,
    status: b.status,
    lastError: b.lastError,
    miniappUrl: b.miniappUrl,
    createdAt: b.createdAt,
  }));
}

export async function refreshBotMiniapp(input: { shopId: string; botId: string; originUrl?: string | null }) {
  const bot = await db.query.bots.findFirst({
    where: and(eq(schema.bots.id, input.botId), eq(schema.bots.shopId, input.shopId)),
  });
  if (!bot) throw new Error("Bot topilmadi");
  const token = decrypt(bot.tokenEncrypted);
  const miniappUrl = buildMiniappUrl(bot.id, input.originUrl);
  if (!miniappUrl) {
    throw new Error("Mini App URL aniqlanmadi. HTTPS bilan domen kerak (yoki localhost).");
  }
  await db.update(schema.bots).set({ miniappUrl }).where(eq(schema.bots.id, bot.id));
  try {
    await tg.setChatMenuButton(token, miniappUrl, "🛍 Do'kon");
  } catch (err) {
    throw new Error(`Telegram menu button o'rnatilmadi: ${err instanceof Error ? err.message : "xato"}`);
  }
  return { id: bot.id, miniappUrl };
}

export async function getBotStatus(input: { shopId: string; botId: string }) {
  const bot = await db.query.bots.findFirst({
    where: and(eq(schema.bots.id, input.botId), eq(schema.bots.shopId, input.shopId)),
  });
  if (!bot) throw new Error("Bot topilmadi");
  const token = decrypt(bot.tokenEncrypted);
  const info = await tg.getMe(token);
  return {
    id: bot.id,
    username: info.username,
    botUserId: info.id,
    status: bot.status,
    lastError: bot.lastError,
  };
}
