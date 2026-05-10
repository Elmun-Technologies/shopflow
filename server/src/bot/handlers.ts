/**
 * Bot xabarlar handleri — to'liq professional e-commerce bot.
 * Mini App'siz ham mijoz bot ichida xarid qila oladi:
 *   /start → katalog (rasmlar) → mahsulot (rasm + tafsif) → savat → checkout (FSM)
 */
import { Bot, InlineKeyboard, Keyboard, type Context, type SessionFlavor } from "grammy";
import { session } from "grammy";
import { and, eq, like, or } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { createLeadFromTelegram, markLeadConvertedFromOrder } from "../services/leads.js";
import { genOrderNumber } from "../services/miniapp.js";
import { emit } from "../lib/events.js";

interface CartLine { productId: string; quantity: number }
interface CheckoutState {
  step: "phone" | "address_street" | "address_house" | "address_apt" | "notes" | "confirm" | "done";
  phone?: string;
  street?: string;
  house?: string;
  apartment?: string;
  notes?: string;
}
interface SessionData {
  cart: CartLine[];
  checkout?: CheckoutState;
  search?: boolean;
}
type Ctx = Context & SessionFlavor<SessionData>;

const initialSession = (): SessionData => ({ cart: [] });

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " so'm";
}

function mainKeyboard(): Keyboard {
  return new Keyboard()
    .text("🛒 Katalog").text("🔥 Mashhurlar").row()
    .text("🧺 Savatim").text("📦 Buyurtmalarim").row()
    .text("🔍 Qidirish").text("ℹ️ Yordam")
    .resized().persistent();
}

async function ensureTgUser(shopId: string, ctx: Context) {
  const tg = ctx.from;
  if (!tg) return null;
  const tgUserId = String(tg.id);
  const existing = await db.query.tgUsers.findFirst({
    where: and(eq(schema.tgUsers.shopId, shopId), eq(schema.tgUsers.tgUserId, tgUserId)),
  });
  if (existing) return existing;
  const [created] = await db.insert(schema.tgUsers).values({
    shopId, tgUserId,
    username: tg.username, firstName: tg.first_name, lastName: tg.last_name,
    languageCode: tg.language_code,
  }).returning();
  return created;
}

async function logIn(botId: string, tgUserId: string | null, ctx: Context) {
  await db.insert(schema.botMessages).values({
    botId, tgUserId,
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

export function buildBotHandler(bot: Bot<Ctx>, botId: string) {
  bot.use(session({ initial: initialSession }));

  // ─── /start ─────────────────────────────────────────────
  bot.command("start", async (ctx) => {
    const ref = await getShopForBot(botId);
    if (!ref) return;
    const tgUser = await ensureTgUser(ref.shopId, ctx);
    await logIn(botId, tgUser?.id ?? null, ctx);

    if (tgUser) {
      const fullName = [tgUser.firstName, tgUser.lastName].filter(Boolean).join(" ") || tgUser.username || "Mehmon";
      await createLeadFromTelegram({ shopId: ref.shopId, tgUserId: tgUser.id, name: fullName, username: tgUser.username }).catch(() => {});
    }

    const shop = await db.query.shops.findFirst({ where: eq(schema.shops.id, ref.shopId) });
    const miniappUrl = ref.bot.miniappUrl;

    const inline = new InlineKeyboard();
    if (miniappUrl) inline.webApp("🛍 Do'konni ochish (Mini App)", miniappUrl).row();
    inline.text("📦 Katalog", "cat:home").text("🔥 Mashhurlar", "cat:featured").row();
    inline.text("🧺 Savatim", "cart:view").text("📋 Buyurtmalarim", "orders:my");

    const featuredCount = (await db.query.products.findMany({
      where: and(eq(schema.products.shopId, ref.shopId), eq(schema.products.featured, true)),
    })).length;
    const productCount = (await db.query.products.findMany({
      where: and(eq(schema.products.shopId, ref.shopId), eq(schema.products.active, true)),
    })).length;

    await ctx.reply(
      `👋 Assalomu alaykum, <b>${ctx.from?.first_name ?? "mehmon"}</b>!\n\n` +
      `🏪 <b>${shop?.name ?? "Do'kon"}</b> ga xush kelibsiz!\n\n` +
      `📦 ${productCount} ta mahsulot · 🔥 ${featuredCount} ta mashhur\n` +
      `🚚 Toshkent bo'ylab yetkazib berish\n` +
      `💳 Click, Payme yoki naqd to'lov\n\n` +
      `Quyidagi tugmalardan foydalaning yoki <b>mahsulot nomini yozing</b> 👇`,
      { parse_mode: "HTML", reply_markup: mainKeyboard() },
    );
    await ctx.reply("Tezkor menyu:", { reply_markup: inline });
  });

  // ─── /help ─────────────────────────────────────────────
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📖 <b>Yordam</b>\n\n" +
      "🛒 <b>Katalog</b> — kategoriyalar bo'yicha mahsulotlarni ko'rish\n" +
      "🔥 <b>Mashhurlar</b> — eng ko'p sotilayotgan mahsulotlar\n" +
      "🧺 <b>Savatim</b> — savatdagi mahsulotlar va buyurtma berish\n" +
      "📦 <b>Buyurtmalarim</b> — siz bergan buyurtmalar tarixi\n" +
      "🔍 <b>Qidirish</b> — mahsulot nomi yoki tavsifi bo'yicha izlash\n\n" +
      "<b>Buyruqlar:</b>\n" +
      "/start — bosh menyu\n" +
      "/catalog — katalog\n" +
      "/cart — savatim\n" +
      "/orders — buyurtmalarim\n" +
      "/contact — operator bilan bog'lanish",
      { parse_mode: "HTML", reply_markup: mainKeyboard() },
    );
  });

  bot.command("contact", async (ctx) => {
    await ctx.reply(
      "📞 <b>Aloqa</b>\n\nOperator bilan bog'lanish uchun telefon raqamingizni qoldiring yoki shu chatda yozing — biz tez orada bog'lanamiz.",
      { parse_mode: "HTML" },
    );
  });

  // ─── Persistent menu hooklari ───────────────────────────
  bot.hears(["🛒 Katalog", "📦 Katalog"], async (ctx) => sendCategoryList(ctx, botId));
  bot.hears("🔥 Mashhurlar", async (ctx) => sendFeaturedProducts(ctx, botId));
  bot.hears("🧺 Savatim", async (ctx) => sendCartView(ctx, botId));
  bot.hears("📦 Buyurtmalarim", async (ctx) => sendMyOrders(ctx, botId));
  bot.hears("ℹ️ Yordam", async (ctx) => {
    await ctx.reply(
      "📖 Yordam menyusi: pastdagi tugmalardan foydalaning yoki mahsulot nomini yozing.\n\n" +
      "/help — to'liq yordam",
      { reply_markup: mainKeyboard() },
    );
  });
  bot.hears("🔍 Qidirish", async (ctx) => {
    ctx.session.search = true;
    await ctx.reply("🔍 Mahsulot nomi yoki tavsifini yozing:", { reply_markup: mainKeyboard() });
  });

  bot.command("catalog", async (ctx) => sendCategoryList(ctx, botId));
  bot.command("cart", async (ctx) => sendCartView(ctx, botId));
  bot.command("orders", async (ctx) => sendMyOrders(ctx, botId));

  // ─── Callback queries ───────────────────────────────────
  bot.callbackQuery("cat:home", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendCategoryList(ctx, botId);
  });
  bot.callbackQuery("cat:featured", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendFeaturedProducts(ctx, botId);
  });
  bot.callbackQuery(/^cat:([a-f0-9-]+)$/, async (ctx) => {
    const categoryId = ctx.match[1];
    await ctx.answerCallbackQuery();
    await sendCategoryProducts(ctx, botId, categoryId);
  });

  bot.callbackQuery(/^prod:([a-f0-9-]+)$/, async (ctx) => {
    const productId = ctx.match[1];
    await ctx.answerCallbackQuery();
    await sendProductDetail(ctx, botId, productId);
  });

  bot.callbackQuery(/^add:([a-f0-9-]+)$/, async (ctx) => {
    const productId = ctx.match[1];
    const ref = await getShopForBot(botId);
    if (!ref) return;
    const product = await db.query.products.findFirst({
      where: and(eq(schema.products.id, productId), eq(schema.products.shopId, ref.shopId)),
    });
    if (!product) { await ctx.answerCallbackQuery({ text: "Mahsulot topilmadi", show_alert: true }); return; }
    if (product.stock === 0) { await ctx.answerCallbackQuery({ text: "Mavjud emas", show_alert: true }); return; }
    const cart = ctx.session.cart;
    const idx = cart.findIndex((c) => c.productId === productId);
    if (idx >= 0) {
      if (cart[idx].quantity >= product.stock) { await ctx.answerCallbackQuery({ text: "Maksimum qoldiq", show_alert: true }); return; }
      cart[idx].quantity += 1;
    } else {
      cart.push({ productId, quantity: 1 });
    }
    await ctx.answerCallbackQuery({ text: `✅ "${product.name}" savatga qo'shildi (${cart.find((c) => c.productId === productId)!.quantity} ta)` });
  });

  bot.callbackQuery(/^qty:([a-f0-9-]+):(-?\d+)$/, async (ctx) => {
    const [, productId, deltaStr] = ctx.match;
    const delta = Number(deltaStr);
    const cart = ctx.session.cart;
    const idx = cart.findIndex((c) => c.productId === productId);
    if (idx < 0) { await ctx.answerCallbackQuery(); return; }
    const next = cart[idx].quantity + delta;
    if (next <= 0) cart.splice(idx, 1);
    else cart[idx].quantity = next;
    await ctx.answerCallbackQuery();
    await sendCartView(ctx, botId, true);
  });

  bot.callbackQuery("cart:view", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendCartView(ctx, botId);
  });

  bot.callbackQuery("cart:clear", async (ctx) => {
    ctx.session.cart = [];
    await ctx.answerCallbackQuery({ text: "Savat tozalandi" });
    await sendCartView(ctx, botId, true);
  });

  bot.callbackQuery("checkout:start", async (ctx) => {
    if (ctx.session.cart.length === 0) {
      await ctx.answerCallbackQuery({ text: "Savat bo'sh", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery();
    ctx.session.checkout = { step: "phone" };
    await ctx.reply(
      "📞 <b>Telefon raqamingizni yuboring</b>\n\nFormat: +998901234567",
      { parse_mode: "HTML", reply_markup: { keyboard: [[{ text: "📱 Telefonni yuborish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } },
    );
  });

  bot.callbackQuery("checkout:cancel", async (ctx) => {
    ctx.session.checkout = undefined;
    await ctx.answerCallbackQuery({ text: "Buyurtma bekor qilindi" });
    await ctx.reply("Buyurtma bekor qilindi.", { reply_markup: mainKeyboard() });
  });

  bot.callbackQuery("orders:my", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendMyOrders(ctx, botId);
  });

  // ─── Contact (telefon yuborilganda) ────────────────────
  bot.on("message:contact", async (ctx) => {
    if (ctx.session.checkout?.step !== "phone") return;
    const phone = ctx.message.contact.phone_number;
    ctx.session.checkout.phone = phone.startsWith("+") ? phone : `+${phone}`;
    ctx.session.checkout.step = "address_street";
    await ctx.reply(
      "📍 <b>Yetkazib berish manzilingizni yozing</b>\n\nKo'cha nomini kiriting:",
      { parse_mode: "HTML", reply_markup: { remove_keyboard: true } },
    );
  });

  // ─── Mini App'dan kelgan data ───────────────────────────
  bot.on("message:web_app_data", async (ctx) => {
    await ctx.reply("✅ Mini App'dan ma'lumot qabul qilindi");
  });

  // ─── Matn xabari (FSM, search, fallback) ────────────────
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();

    // Buyruq bo'lsa o'tkazib yuboramiz
    if (text.startsWith("/")) return;

    // Persistent keyboard tugmalari `bot.hears` da ushlaydi, shuning uchun bu yerga
    // emas, lekin har holda tekshirib qoyamiz
    const menuTexts = ["🛒 Katalog", "📦 Katalog", "🔥 Mashhurlar", "🧺 Savatim", "📦 Buyurtmalarim", "🔍 Qidirish", "ℹ️ Yordam"];
    if (menuTexts.includes(text)) return;

    // FSM checkout
    if (ctx.session.checkout) {
      await handleCheckoutStep(ctx, botId, text);
      return;
    }

    // Qidiruv rejimi
    if (ctx.session.search) {
      ctx.session.search = false;
      await runSearch(ctx, botId, text);
      return;
    }

    // Aks holda — qidiruv
    await runSearch(ctx, botId, text);
  });

  bot.catch((err) => {
    console.error(`[bot ${botId}] error:`, err);
  });
}

// ───────────────────────────────────────────────────────────
// Helpers: Category list
// ───────────────────────────────────────────────────────────
async function sendCategoryList(ctx: Ctx, botId: string) {
  const ref = await getShopForBot(botId);
  if (!ref) return;
  const cats = await db.query.categories.findMany({
    where: eq(schema.categories.shopId, ref.shopId),
    orderBy: [schema.categories.sortOrder],
  });
  if (cats.length === 0) {
    await ctx.reply("📭 Hozircha kategoriya yo'q. Admin kategoriyalarni qo'shgach, shu yerda paydo bo'ladi.", { reply_markup: mainKeyboard() });
    return;
  }
  const kb = new InlineKeyboard();
  cats.forEach((c, i) => {
    const label = `${c.emoji ?? "📦"} ${c.name}`;
    kb.text(label, `cat:${c.id}`);
    if (i % 2 === 1) kb.row();
  });
  if (cats.length % 2 === 1) kb.row();
  kb.text("🔥 Mashhurlar", "cat:featured").text("🧺 Savatim", "cart:view");

  await ctx.reply(`📂 <b>Kategoriyalar</b>\n\nKerakli kategoriyani tanlang:`, { parse_mode: "HTML", reply_markup: kb });
}

// Featured products
async function sendFeaturedProducts(ctx: Ctx, botId: string) {
  const ref = await getShopForBot(botId);
  if (!ref) return;
  const items = await db.query.products.findMany({
    where: and(eq(schema.products.shopId, ref.shopId), eq(schema.products.featured, true), eq(schema.products.active, true)),
  });
  if (items.length === 0) {
    await ctx.reply("🔥 Hozircha mashhur mahsulot yo'q.", { reply_markup: mainKeyboard() });
    return;
  }
  await ctx.reply(`🔥 <b>Mashhur mahsulotlar</b> (${items.length} ta)`, { parse_mode: "HTML" });
  for (const product of items.slice(0, 8)) {
    await sendProductCard(ctx, product);
  }
  await ctx.reply("Yana boshqa mahsulotlarni ko'rish:", {
    reply_markup: new InlineKeyboard().text("📦 Hamma kategoriyalar", "cat:home"),
  });
}

// Category products
async function sendCategoryProducts(ctx: Ctx, botId: string, categoryId: string) {
  const ref = await getShopForBot(botId);
  if (!ref) return;
  const cat = await db.query.categories.findFirst({ where: eq(schema.categories.id, categoryId) });
  const items = await db.query.products.findMany({
    where: and(eq(schema.products.shopId, ref.shopId), eq(schema.products.categoryId, categoryId), eq(schema.products.active, true)),
  });
  if (items.length === 0) {
    await ctx.reply(`📭 ${cat?.name ?? "Kategoriya"} bo'sh.`, {
      reply_markup: new InlineKeyboard().text("⬅️ Kategoriyalarga", "cat:home"),
    });
    return;
  }
  await ctx.reply(`${cat?.emoji ?? "📦"} <b>${cat?.name ?? "Kategoriya"}</b> (${items.length} ta mahsulot)`, { parse_mode: "HTML" });
  for (const product of items.slice(0, 10)) {
    await sendProductCard(ctx, product);
  }
  await ctx.reply("Boshqa kategoriyalar:", {
    reply_markup: new InlineKeyboard().text("⬅️ Kategoriyalarga", "cat:home").text("🧺 Savatim", "cart:view"),
  });
}

// Product card (with photo if available)
async function sendProductCard(ctx: Ctx, product: typeof schema.products.$inferSelect) {
  const compare = product.compareAtPrice && product.compareAtPrice > product.price;
  const discount = compare ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100) : 0;

  const lines: string[] = [];
  lines.push(`<b>${product.name}</b>`);
  if (product.description) lines.push(product.description.slice(0, 200));
  lines.push("");
  if (compare) {
    lines.push(`<s>${fmtMoney(product.compareAtPrice!)}</s> <b>${fmtMoney(product.price)}</b>  🔥 -${discount}%`);
  } else {
    lines.push(`💰 <b>${fmtMoney(product.price)}</b>`);
  }
  if (product.rating > 0) lines.push(`⭐ ${product.rating.toFixed(1)} ${product.reviewCount > 0 ? `(${product.reviewCount} sharh)` : "(yangi)"}`);
  if (product.stock <= 5 && product.stock > 0) lines.push(`⚠️ Atigi ${product.stock} ta qoldi`);
  if (product.stock === 0) lines.push(`❌ Mavjud emas`);

  const caption = lines.join("\n");
  const kb = new InlineKeyboard();
  if (product.stock > 0) kb.text("🛒 Savatga qo'shish", `add:${product.id}`).row();
  kb.text("ℹ️ Batafsil", `prod:${product.id}`);

  const photo = (product.images && product.images.length > 0) ? product.images[0] : null;
  try {
    if (photo) {
      await ctx.replyWithPhoto(photo, { caption, parse_mode: "HTML", reply_markup: kb });
    } else {
      await ctx.reply(caption, { parse_mode: "HTML", reply_markup: kb });
    }
  } catch {
    await ctx.reply(caption, { parse_mode: "HTML", reply_markup: kb });
  }
}

// Product detail
async function sendProductDetail(ctx: Ctx, botId: string, productId: string) {
  const ref = await getShopForBot(botId);
  if (!ref) return;
  const product = await db.query.products.findFirst({
    where: and(eq(schema.products.id, productId), eq(schema.products.shopId, ref.shopId)),
  });
  if (!product) { await ctx.reply("Mahsulot topilmadi"); return; }
  await sendProductCard(ctx, product);
}

// Cart view
async function sendCartView(ctx: Ctx, botId: string, edit = false) {
  const ref = await getShopForBot(botId);
  if (!ref) return;
  const cart = ctx.session.cart;
  if (cart.length === 0) {
    const text = "🧺 <b>Savatingiz bo'sh</b>\n\nKatalogdan mahsulot qo'shing.";
    const kb = new InlineKeyboard().text("📦 Katalog", "cat:home").text("🔥 Mashhurlar", "cat:featured");
    if (edit && ctx.callbackQuery?.message) {
      try { await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb }); return; }
      catch { /* */ }
    }
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: kb });
    return;
  }

  const ids = cart.map((c) => c.productId);
  const products = await db.query.products.findMany({
    where: and(eq(schema.products.shopId, ref.shopId)),
  });
  const map = new Map(products.filter((p) => ids.includes(p.id)).map((p) => [p.id, p]));

  let total = 0;
  const lines: string[] = ["🧺 <b>Savatim</b>", ""];
  for (const item of cart) {
    const p = map.get(item.productId);
    if (!p) continue;
    const subtotal = p.price * item.quantity;
    total += subtotal;
    lines.push(`• <b>${p.name}</b>\n   ${item.quantity} × ${fmtMoney(p.price)} = ${fmtMoney(subtotal)}`);
  }
  lines.push("");
  lines.push(`💰 <b>Jami: ${fmtMoney(total)}</b>`);

  const kb = new InlineKeyboard();
  for (const item of cart.slice(0, 6)) {
    const p = map.get(item.productId);
    if (!p) continue;
    kb.text(`➖ ${p.name.slice(0, 12)}`, `qty:${item.productId}:-1`)
      .text(`${item.quantity}`, `noop`)
      .text(`➕`, `qty:${item.productId}:1`).row();
  }
  kb.text("🗑 Tozalash", "cart:clear").text("✅ Buyurtma berish", "checkout:start");

  if (edit && ctx.callbackQuery?.message) {
    try {
      // Photo'li xabarda edit ishlamaydi, oddiy xabar bo'lsa edit qilamiz
      if (ctx.callbackQuery.message.text) {
        await ctx.editMessageText(lines.join("\n"), { parse_mode: "HTML", reply_markup: kb });
        return;
      }
    } catch { /* */ }
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: kb });
}

// Search
async function runSearch(ctx: Ctx, botId: string, query: string) {
  const ref = await getShopForBot(botId);
  if (!ref) return;
  if (query.length < 2) {
    await ctx.reply("Qidiruv uchun kamida 2 belgi yozing.");
    return;
  }
  const q = `%${query.toLowerCase()}%`;
  const items = await db.query.products.findMany({
    where: and(
      eq(schema.products.shopId, ref.shopId),
      eq(schema.products.active, true),
      or(like(schema.products.name, q), like(schema.products.description, q))!,
    ),
  });
  if (items.length === 0) {
    await ctx.reply(`🔍 "${query}" bo'yicha mahsulot topilmadi.\n\nBoshqa so'z bilan urinib ko'ring yoki katalogdan tanlang.`, {
      reply_markup: new InlineKeyboard().text("📦 Katalog", "cat:home"),
    });
    return;
  }
  await ctx.reply(`🔍 <b>"${query}"</b> bo'yicha topildi: ${items.length} ta`, { parse_mode: "HTML" });
  for (const p of items.slice(0, 6)) {
    await sendProductCard(ctx, p);
  }
}

// My orders
async function sendMyOrders(ctx: Ctx, botId: string) {
  const ref = await getShopForBot(botId);
  if (!ref) return;
  const tgUser = await ensureTgUser(ref.shopId, ctx);
  if (!tgUser) return;
  const orders = await db.query.orders.findMany({
    where: eq(schema.orders.tgUserId, tgUser.id),
  });
  if (orders.length === 0) {
    await ctx.reply("📭 Sizda hali buyurtma yo'q.\n\nKatalogdan birinchi mahsulotni tanlab ko'ring!", {
      reply_markup: new InlineKeyboard().text("📦 Katalog", "cat:home").text("🔥 Mashhurlar", "cat:featured"),
    });
    return;
  }
  const statusLabels: Record<string, string> = {
    pending: "⏳ Kutilmoqda",
    confirmed: "✅ Tasdiqlandi",
    preparing: "📦 Tayyorlanmoqda",
    shipping: "🚚 Yetkazilmoqda",
    delivered: "✅ Yetkazildi",
    cancelled: "❌ Bekor qilindi",
  };
  const lines: string[] = ["📋 <b>Buyurtmalarim</b>", ""];
  for (const o of orders.slice(0, 10)) {
    lines.push(`📦 <b>${o.orderNumber}</b>\n${statusLabels[o.status] ?? o.status} · ${fmtMoney(o.total)}\n📅 ${new Date(o.createdAt as Date | number).toLocaleDateString("uz-UZ")}\n`);
  }
  await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: mainKeyboard() });
}

// Checkout FSM
async function handleCheckoutStep(ctx: Ctx, botId: string, text: string) {
  const state = ctx.session.checkout;
  if (!state) return;
  const ref = await getShopForBot(botId);
  if (!ref) return;

  switch (state.step) {
    case "phone": {
      if (!/^\+?\d{9,15}$/.test(text.replace(/[\s-]/g, ""))) {
        await ctx.reply("❌ Telefon raqami noto'g'ri. Format: +998901234567\n\nQaytadan yuboring:");
        return;
      }
      state.phone = text.replace(/[\s-]/g, "");
      if (!state.phone.startsWith("+")) state.phone = "+" + state.phone;
      state.step = "address_street";
      await ctx.reply("📍 Ko'cha nomini yozing:", { reply_markup: { remove_keyboard: true } });
      return;
    }
    case "address_street": {
      if (text.length < 2) { await ctx.reply("Ko'cha nomi qisqa. Qaytadan yozing:"); return; }
      state.street = text;
      state.step = "address_house";
      await ctx.reply("🏠 Uy raqamini yozing:");
      return;
    }
    case "address_house": {
      state.house = text;
      state.step = "address_apt";
      await ctx.reply("🚪 Xonadon raqamini yozing (yoki <i>yo'q</i> deb yozing):", { parse_mode: "HTML" });
      return;
    }
    case "address_apt": {
      state.apartment = /^yo'?q$/i.test(text.trim()) ? "" : text;
      state.step = "notes";
      await ctx.reply("📝 Buyurtmaga qo'shimcha izoh bormi?\n\n(Yo'q bo'lsa <i>—</i> yoki <i>yo'q</i> yozing)", { parse_mode: "HTML" });
      return;
    }
    case "notes": {
      state.notes = /^[—-]|^yo'?q$/i.test(text.trim()) ? undefined : text;
      state.step = "confirm";
      const cart = ctx.session.cart;
      const productIds = cart.map((c) => c.productId);
      const products = await db.query.products.findMany({
        where: and(eq(schema.products.shopId, ref.shopId)),
      });
      const map = new Map(products.filter((p) => productIds.includes(p.id)).map((p) => [p.id, p]));
      let total = 0;
      const lines = ["📋 <b>Buyurtma ma'lumotlari:</b>", ""];
      for (const item of cart) {
        const p = map.get(item.productId);
        if (!p) continue;
        total += p.price * item.quantity;
        lines.push(`• ${p.name} × ${item.quantity} = ${fmtMoney(p.price * item.quantity)}`);
      }
      lines.push("");
      lines.push(`💰 <b>Jami: ${fmtMoney(total)}</b>`);
      lines.push(`📞 Telefon: ${state.phone}`);
      lines.push(`📍 Manzil: ${[state.street, state.house, state.apartment].filter(Boolean).join(", ")}`);
      if (state.notes) lines.push(`📝 Izoh: ${state.notes}`);

      const kb = new InlineKeyboard()
        .text("✅ Tasdiqlash", "confirm:order").row()
        .text("❌ Bekor qilish", "checkout:cancel");
      await ctx.reply(lines.join("\n"), { parse_mode: "HTML", reply_markup: kb });
      return;
    }
    default:
      return;
  }
}

// Order confirmation handler ham qo'shamiz
export function registerConfirmHandler(bot: Bot<Ctx>, botId: string) {
  bot.callbackQuery("confirm:order", async (ctx) => {
    const ref = await getShopForBot(botId);
    if (!ref) return;
    const state = ctx.session.checkout;
    const cart = ctx.session.cart;
    if (!state || !state.phone || cart.length === 0) {
      await ctx.answerCallbackQuery({ text: "Ma'lumot to'liq emas", show_alert: true });
      return;
    }
    await ctx.answerCallbackQuery();

    const tgUser = await ensureTgUser(ref.shopId, ctx);
    if (!tgUser) return;

    const products = await db.query.products.findMany({
      where: and(eq(schema.products.shopId, ref.shopId)),
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const itemsToInsert: Array<{ productId: string; productName: string; quantity: number; price: number; total: number }> = [];
    for (const it of cart) {
      const p = productMap.get(it.productId);
      if (!p) continue;
      if (p.stock < it.quantity) {
        await ctx.reply(`❌ "${p.name}" mahsulotida yetarli qoldiq yo'q (${p.stock} ta)`);
        return;
      }
      const total = p.price * it.quantity;
      subtotal += total;
      itemsToInsert.push({ productId: p.id, productName: p.name, quantity: it.quantity, price: p.price, total });
    }

    const orderNumber = await genOrderNumber(ref.shopId);
    const [order] = await db.insert(schema.orders).values({
      shopId: ref.shopId,
      orderNumber,
      tgUserId: tgUser.id,
      source: "telegram",
      subtotal,
      deliveryFee: 0,
      total: subtotal,
      customerPhone: state.phone,
      deliveryAddress: { street: state.street, house: state.house, apartment: state.apartment },
      paymentMethod: "cash",
      notes: state.notes,
    }).returning();

    await db.insert(schema.orderItems).values(itemsToInsert.map((it) => ({ ...it, orderId: order.id })));

    // Stock kamaytirish
    for (const it of cart) {
      const p = productMap.get(it.productId);
      if (!p) continue;
      await db.update(schema.products).set({ stock: p.stock - it.quantity, updatedAt: new Date() })
        .where(eq(schema.products.id, p.id));
    }

    // Real-time admin push
    emit({
      type: "order.created",
      shopId: ref.shopId,
      order: { id: order.id, orderNumber: order.orderNumber, total: order.total, createdAt: order.createdAt },
    });

    void markLeadConvertedFromOrder({ shopId: ref.shopId, tgUserId: tgUser.id, orderId: order.id, orderTotal: order.total }).catch(() => {});

    // Sessionni tozalash
    ctx.session.cart = [];
    ctx.session.checkout = undefined;

    await ctx.reply(
      `✅ <b>Buyurtma qabul qilindi!</b>\n\n` +
      `📦 Raqam: <b>${orderNumber}</b>\n` +
      `💰 Jami: <b>${fmtMoney(order.total)}</b>\n\n` +
      `Tez orada operator sizga bog'lanadi. ☎️\n\n` +
      `Buyurtma holatini "📦 Buyurtmalarim" bo'limidan kuzatib borishingiz mumkin.`,
      { parse_mode: "HTML", reply_markup: mainKeyboard() },
    );
  });
}
