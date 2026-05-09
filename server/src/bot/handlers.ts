/**
 * Bot xabarlar handleri — har bot uchun bir xil logika.
 * Customer-facing oqim: /start → katalog → savat → buyurtma.
 * Hozircha skeleton: /start, /help, oddiy katalog, fallback javob.
 */
import { Bot, InlineKeyboard, type Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

async function ensureTgUser(shopId: string, ctx: Context) {
  const tg = ctx.from;
  if (!tg) return null;
  const tgUserId = String(tg.id);
  const existing = await db.query.tgUsers.findFirst({
    where: and(eq(schema.tgUsers.shopId, shopId), eq(schema.tgUsers.tgUserId, tgUserId)),
  });
  if (existing) return existing;
  const [created] = await db.insert(schema.tgUsers).values({
    shopId,
    tgUserId,
    username: tg.username,
    firstName: tg.first_name,
    lastName: tg.last_name,
    languageCode: tg.language_code,
  }).returning();
  return created;
}

async function logIn(botId: string, tgUserId: string | null, ctx: Context) {
  await db.insert(schema.botMessages).values({
    botId,
    tgUserId,
    direction: "in",
    messageType: ctx.update.message ? "message" : ctx.update.callback_query ? "callback_query" : "other",
    payload: ctx.update,
  });
}

async function getShopForBot(botId: string) {
  const bot = await db.query.bots.findFirst({ where: eq(schema.bots.id, botId) });
  if (!bot) return null;
  return { bot, shopId: bot.shopId };
}

export function buildBotHandler(bot: Bot, botId: string) {
  bot.command("start", async (ctx) => {
    const ref = await getShopForBot(botId);
    if (!ref) return;
    const tgUser = await ensureTgUser(ref.shopId, ctx);
    await logIn(botId, tgUser?.id ?? null, ctx);

    const shop = await db.query.shops.findFirst({ where: eq(schema.shops.id, ref.shopId) });
    const miniappUrl = ref.bot.miniappUrl;

    const keyboard = new InlineKeyboard();
    if (miniappUrl) {
      keyboard.webApp("📱 Do'konni ochish", miniappUrl).row();
    }
    keyboard.text("📋 Buyurtmalarim", "orders:my").row();
    keyboard.text("🛒 Katalogni ko'rish", "catalog:home");

    await ctx.reply(
      `Assalomu alaykum, <b>${ctx.from?.first_name ?? "mehmon"}</b>!\n\n` +
      `<b>${shop?.name ?? "Do'kon"}</b> ga xush kelibsiz. Pastdagi tugmalardan foydalaning.`,
      { parse_mode: "HTML", reply_markup: keyboard },
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "Mavjud buyruqlar:\n" +
      "/start — bosh sahifa\n" +
      "/catalog — katalog\n" +
      "/orders — buyurtmalarim\n" +
      "/help — yordam",
    );
  });

  bot.command("catalog", async (ctx) => {
    await sendCategoryList(ctx, botId);
  });

  bot.callbackQuery("catalog:home", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendCategoryList(ctx, botId);
  });

  bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
    const categoryId = ctx.match[1];
    await ctx.answerCallbackQuery();
    await sendProductList(ctx, botId, categoryId);
  });

  bot.callbackQuery("orders:my", async (ctx) => {
    await ctx.answerCallbackQuery();
    const ref = await getShopForBot(botId);
    if (!ref) return;
    const tgUser = await ensureTgUser(ref.shopId, ctx);
    if (!tgUser) return;
    const orders = await db.query.orders.findMany({ where: eq(schema.orders.tgUserId, tgUser.id) });
    if (orders.length === 0) {
      await ctx.reply("Sizda hali buyurtma yo'q.");
      return;
    }
    const text = orders.slice(0, 10).map((o) =>
      `• <b>${o.orderNumber}</b> — ${o.status} — ${o.total.toLocaleString()} ${"so'm"}`,
    ).join("\n");
    await ctx.reply(`<b>Sizning buyurtmalaringiz:</b>\n${text}`, { parse_mode: "HTML" });
  });

  bot.on("message:web_app_data", async (ctx) => {
    const data = ctx.message.web_app_data?.data;
    if (!data) return;
    await ctx.reply(`Mini App'dan ma'lumot keldi (uzunligi: ${data.length}). Buyurtma jarayoni keyingi sessiyada qo'shiladi.`);
  });

  bot.on("message", async (ctx) => {
    await ctx.reply("Buyruq tushunilmadi. /help ni tekshiring.");
  });
}

async function sendCategoryList(ctx: Context, botId: string) {
  const ref = await getShopForBot(botId);
  if (!ref) return;
  const cats = await db.query.categories.findMany({ where: eq(schema.categories.shopId, ref.shopId) });
  if (cats.length === 0) {
    await ctx.reply("Hozircha kategoriya yo'q. Admin kategoriyalarni qo'shganidan keyin paydo bo'ladi.");
    return;
  }
  const kb = new InlineKeyboard();
  cats.forEach((c, i) => {
    kb.text(c.name, `cat:${c.id}`);
    if (i % 2 === 1) kb.row();
  });
  await ctx.reply("<b>Kategoriyalar:</b>", { parse_mode: "HTML", reply_markup: kb });
}

async function sendProductList(ctx: Context, botId: string, categoryId: string) {
  const ref = await getShopForBot(botId);
  if (!ref) return;
  const items = await db.query.products.findMany({
    where: and(eq(schema.products.shopId, ref.shopId), eq(schema.products.categoryId, categoryId)),
  });
  if (items.length === 0) {
    await ctx.reply("Bu kategoriyada hozircha mahsulot yo'q.");
    return;
  }
  const text = items.slice(0, 10).map((p) =>
    `• <b>${p.name}</b> — ${p.price.toLocaleString()} so'm (qoldiq: ${p.stock})`,
  ).join("\n");
  await ctx.reply(text, { parse_mode: "HTML" });
}
