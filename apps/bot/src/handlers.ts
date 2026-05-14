import { Bot, InlineKeyboard, type Context, type SessionFlavor } from "grammy";
import type { PrismaClient } from "@shopflow/db";
import type { Logger } from "pino";

export interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  priceKopecks: number;
  quantity: number;
}

export interface ShopFlowSession {
  cart: CartItem[];
  flow:
    | null
    | { kind: "checkout"; step: "phone" | "address" | "confirm"; phone?: string; address?: string };
}

interface CustomFields {
  tenantId: string;
  apiBase: string;
  miniAppBase: string;
  log: Logger;
  prisma: PrismaClient;
}

export type ShopFlowContext = Context & SessionFlavor<ShopFlowSession> & CustomFields;

const M = {
  greet: (storeName: string) =>
    `Salom! ${storeName} do'koniga xush kelibsiz. Quyidagi tugmalardan birini tanlang:`,
  catalogBtn: "🛍 Katalog",
  cartBtn: "🛒 Savatcha",
  myOrdersBtn: "📦 Buyurtmalarim",
  helpBtn: "ℹ️ Yordam",
  helpText:
    "Bu bot orqali do'kondan to'g'ridan-to'g'ri xarid qila olasiz.\n" +
    "• Katalog — barcha mahsulotlar ro'yxati.\n" +
    "• Savatcha — siz tanlagan mahsulotlar.\n" +
    "• Buyurtmalarim — oldingi buyurtmalaringiz holati.",
  cartEmpty: "Savatcha bo'sh. Katalogdan mahsulot qo'shing.",
  cartHeader: "Sizning savatchangiz:",
  checkoutPhone: "Iltimos, telefon raqamingizni yuboring 📱",
  checkoutAddress: "Yetkazib berish manzilini yozib yuboring 🏠",
  checkoutConfirm: (total: string) =>
    `Buyurtmangiz tasdiqlash uchun tayyor.\nUmumiy: ${total}\n\nDavom etish uchun \"Tasdiqlayman\" tugmasini bosing.`,
  orderCreated: (number: string) => `Rahmat! Buyurtma ${number} qabul qilindi. Tez orada operator bog'lanadi.`,
};

export function registerHandlers(bot: Bot<ShopFlowContext>): void {
  bot.command("start", async (ctx) => {
    const tenant = await ctx.prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true, slug: true },
    });
    await upsertTelegramUser(ctx);

    const kb = new InlineKeyboard()
      .webApp(M.catalogBtn, `${ctx.miniAppBase}/${tenant?.slug ?? ""}`)
      .row()
      .text(M.cartBtn, "cart:open")
      .text(M.myOrdersBtn, "orders:my")
      .row()
      .text(M.helpBtn, "help");

    await ctx.reply(M.greet(tenant?.name ?? "ShopFlow"), { reply_markup: kb });
  });

  bot.callbackQuery("help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(M.helpText);
  });

  bot.callbackQuery("cart:open", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (ctx.session.cart.length === 0) {
      await ctx.reply(M.cartEmpty);
      return;
    }
    const total = ctx.session.cart.reduce((s, i) => s + i.priceKopecks * i.quantity, 0);
    const lines = ctx.session.cart.map(
      (i) => `• ${i.name} ×${i.quantity} — ${formatMoney(i.priceKopecks * i.quantity)}`,
    );
    const kb = new InlineKeyboard().text("✅ Buyurtma berish", "checkout:start").row().text("🗑 Tozalash", "cart:clear");
    await ctx.reply(`${M.cartHeader}\n${lines.join("\n")}\n\nUmumiy: ${formatMoney(total)}`, { reply_markup: kb });
  });

  bot.callbackQuery("cart:clear", async (ctx) => {
    ctx.session.cart = [];
    await ctx.answerCallbackQuery({ text: "Savatcha tozalandi" });
  });

  bot.callbackQuery("checkout:start", async (ctx) => {
    if (ctx.session.cart.length === 0) {
      await ctx.answerCallbackQuery({ text: "Savatcha bo'sh" });
      return;
    }
    await ctx.answerCallbackQuery();
    ctx.session.flow = { kind: "checkout", step: "phone" };
    await ctx.reply(M.checkoutPhone, {
      reply_markup: {
        keyboard: [[{ text: "📱 Telefon yuborish", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  });

  bot.on("message:contact", async (ctx) => {
    if (ctx.session.flow?.kind !== "checkout" || ctx.session.flow.step !== "phone") return;
    ctx.session.flow.phone = ctx.message.contact.phone_number;
    ctx.session.flow.step = "address";
    await ctx.reply(M.checkoutAddress, { reply_markup: { remove_keyboard: true } });
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.session.flow?.kind === "checkout" && ctx.session.flow.step === "address") {
      ctx.session.flow.address = ctx.message.text;
      ctx.session.flow.step = "confirm";
      const total = ctx.session.cart.reduce((s, i) => s + i.priceKopecks * i.quantity, 0);
      await ctx.reply(M.checkoutConfirm(formatMoney(total)), {
        reply_markup: new InlineKeyboard().text("✅ Tasdiqlayman", "checkout:confirm").text("❌ Bekor", "checkout:cancel"),
      });
      return;
    }
    await next();
  });

  bot.callbackQuery("checkout:cancel", async (ctx) => {
    ctx.session.flow = null;
    await ctx.answerCallbackQuery({ text: "Bekor qilindi" });
  });

  bot.callbackQuery("checkout:confirm", async (ctx) => {
    if (ctx.session.flow?.kind !== "checkout" || ctx.session.flow.step !== "confirm") return;
    await ctx.answerCallbackQuery();
    try {
      const order = await createOrderViaApi(ctx);
      ctx.session.cart = [];
      ctx.session.flow = null;
      await ctx.reply(M.orderCreated(order.number));
    } catch (err) {
      ctx.log.error({ err }, "Order creation failed");
      await ctx.reply("Kechirasiz, buyurtma yaratishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
    }
  });

  bot.callbackQuery("orders:my", async (ctx) => {
    await ctx.answerCallbackQuery();
    const me = await ctx.prisma.telegramUser.findUnique({
      where: { tenantId_chatId: { tenantId: ctx.tenantId, chatId: BigInt(ctx.chat!.id) } },
      include: { customer: { include: { orders: { orderBy: { createdAt: "desc" }, take: 5 } } } },
    });
    const orders = me?.customer?.orders ?? [];
    if (orders.length === 0) {
      await ctx.reply("Sizda hali buyurtmalar yo'q.");
      return;
    }
    const lines = orders.map(
      (o) => `• ${o.number} — ${o.status.toLowerCase()} — ${formatMoney(o.totalKopecks)}`,
    );
    await ctx.reply(`So'nggi buyurtmalaringiz:\n${lines.join("\n")}`);
  });

  // ─────────────────── Inline qidiruv ───────────────────
  bot.on("inline_query", async (ctx) => {
    const query = (ctx.inlineQuery?.query ?? "").trim();
    const tenantId = ctx.tenantId;

    const where = {
      tenantId,
      archived: false,
      status: { in: ["ACTIVE"] as Array<"ACTIVE" | "INACTIVE" | "OUT_OF_STOCK" | "DISCONTINUED"> },
      stockTotal: { gt: 0 },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { sku: { contains: query, mode: "insensitive" as const } },
              { barcode: { contains: query } },
            ],
          }
        : {}),
    };

    const products = await ctx.prisma.product.findMany({
      where,
      orderBy: query ? undefined : { sold: "desc" },
      take: 25,
      select: { id: true, name: true, priceKopecks: true, salePriceKopecks: true, image: true, sku: true, slug: true },
    });

    const tenant = await ctx.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    const results = products.map((p, idx) => {
      const price = formatMoney(p.salePriceKopecks ?? p.priceKopecks);
      return {
        type: "article" as const,
        id: `${p.id}:${idx}`,
        title: p.name,
        description: `${p.sku} · ${price}`,
        thumbnail_url: p.image ?? undefined,
        input_message_content: {
          message_text: `🛍 <b>${escapeHtml(p.name)}</b>\nNarx: ${price}`,
          parse_mode: "HTML" as const,
        },
        reply_markup: tenant?.slug
          ? {
              inline_keyboard: [[
                {
                  text: "Mahsulotni ko'rish",
                  web_app: { url: `${ctx.miniAppBase}/${tenant.slug}/p/${p.slug}` },
                },
              ]],
            }
          : undefined,
      };
    });

    await ctx.answerInlineQuery(results, { cache_time: 30, is_personal: false });
  });

  // ─────────────────── Xato hisoboti ───────────────────
  bot.catch(async (err) => {
    const c = err.ctx;
    c.log.error({ err: err.error }, "grammY error");

    // Saqlab qo'yamiz — admin sahifada xato log'i sifatida ko'rinadi.
    try {
      await c.prisma.webhookEvent.create({
        data: {
          tenantId: c.tenantId,
          source: "TELEGRAM",
          entityType: "bot",
          action: "ERROR",
          payload: {
            updateId: c.update?.update_id,
            chatId: c.chat?.id,
            errorMessage: err.error instanceof Error ? err.error.message : String(err.error),
            stack: err.error instanceof Error ? err.error.stack?.slice(0, 1000) : undefined,
          } as never,
          error: err.error instanceof Error ? err.error.message.slice(0, 500) : String(err.error).slice(0, 500),
          processedAt: new Date(),
        },
      });
    } catch {
      /* swallow — logging path must not throw */
    }

    // Best-effort user-facing apology.
    try {
      if (c.chat?.id) {
        await c.api.sendMessage(c.chat.id, "Kechirasiz, kutilmagan xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
      }
    } catch {
      /* user might have blocked the bot */
    }
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}

async function upsertTelegramUser(ctx: ShopFlowContext): Promise<void> {
  if (!ctx.from || !ctx.chat) return;
  await ctx.prisma.telegramUser.upsert({
    where: { tenantId_chatId: { tenantId: ctx.tenantId, chatId: BigInt(ctx.chat.id) } },
    create: {
      tenantId: ctx.tenantId,
      chatId: BigInt(ctx.chat.id),
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
      lastName: ctx.from.last_name ?? null,
      languageCode: ctx.from.language_code ?? "uz",
    },
    update: {
      username: ctx.from.username ?? null,
      firstName: ctx.from.first_name ?? null,
      lastName: ctx.from.last_name ?? null,
    },
  });
}

async function createOrderViaApi(ctx: ShopFlowContext): Promise<{ id: string; number: string }> {
  const flow = ctx.session.flow!;
  if (flow.kind !== "checkout") throw new Error("not in checkout");

  const items = ctx.session.cart.map((i) => ({
    productId: i.productId,
    variantId: i.variantId,
    quantity: i.quantity,
  }));

  // Look up or create a Customer locally; the outbound order job will push to MoySklad.
  let customer = ctx.session.flow.phone
    ? await ctx.prisma.customer.findFirst({
        where: { tenantId: ctx.tenantId, phone: ctx.session.flow.phone },
      })
    : null;
  if (!customer) {
    customer = await ctx.prisma.customer.create({
      data: {
        tenantId: ctx.tenantId,
        name: ctx.from?.first_name ?? "Telegram mijozi",
        phone: flow.phone ?? null,
      },
    });
  }

  // Use the internal order creation endpoint via fetch (with a system-issued JWT)
  // — in this skeleton we call the DB directly through Prisma to keep the bot independent.
  const productIds = items.map((i) => i.productId);
  const products = await ctx.prisma.product.findMany({ where: { id: { in: productIds }, tenantId: ctx.tenantId } });
  let total = 0;
  let count = 0;
  const lineItems = items.map((line) => {
    const p = products.find((x) => x.id === line.productId);
    if (!p) throw new Error("Product not found in tenant");
    const priceKopecks = p.salePriceKopecks ?? p.priceKopecks;
    total += priceKopecks * line.quantity;
    count += line.quantity;
    return {
      tenantId: ctx.tenantId,
      productId: p.id,
      variantId: line.variantId ?? null,
      productName: p.name,
      sku: p.sku,
      quantity: line.quantity,
      priceKopecks,
      vatPercent: p.vatPercent,
    };
  });

  const number = `TG-${Date.now().toString(36).toUpperCase()}`;

  const order = await ctx.prisma.order.create({
    data: {
      tenantId: ctx.tenantId,
      number,
      channel: "TELEGRAM",
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      shippingAddress: flow.address ?? null,
      itemsCount: count,
      totalKopecks: total,
      items: { create: lineItems },
    },
  });

  // Notify worker to push to MoySklad by enqueuing through Redis directly.
  return { id: order.id, number: order.number };
}

function formatMoney(kopecks: number): string {
  const uzs = Math.round(kopecks / 100);
  return new Intl.NumberFormat("uz-UZ").format(uzs) + " so'm";
}
