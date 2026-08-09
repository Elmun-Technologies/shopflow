// Bot konstruktori runtime — `BotFlow.definition` JSON'ini talqin qiladi.
//
// Kirish: Telegram update (matn / callback_query / contact).
// Chiqish: mijozga yuborilgan xabarlar + yon ta'sirlar (lid, suhbat, sessiya).
//
// Holat `BotSession` jadvalida saqlanadi (tenantId + chatId bo'yicha) — server
// qayta ishga tushsa ham yarim to'ldirilgan anketa yo'qolmaydi.
//
// Telegram cheklovlari bo'yicha qarorlar:
//   • callback_data ≤ 64 bayt — shuning uchun ekran/tugma ID'lari ≤24 belgi
//     (bot-flow-schema.ts da majburlanadi) va prefiksli qisqa sxema ishlatiladi.
//   • Bir xabarda ≤ 4096 belgi — matnlar kesiladi.
//   • web_app tugmasi faqat shaxsiy chatda ishlaydi — bot faqat shu yerda ishlaydi.

import type { PrismaClient, Prisma } from "@prisma/client";
import { nextLeadCode } from "./codes.js";
import { sendTelegramRaw, sendTelegramPhoto, notifyAdmin } from "./telegram-notify.js";
import { publishToTenant } from "./sse-bus.js";
import { aiReplyToMessage } from "./ai-assistant.js";
import { productPricing, toVariantLike, visibleVariants } from "./variant-shape.js";
import { parsePriceTiers } from "./price-tier.js";
import {
  pick,
  type BotFlowDefinition,
  type BotForm,
  type BotFormField,
  type BotLang,
  type BotScreen,
} from "./bot-flow-schema.js";

const TG_TEXT_LIMIT = 4000;
const TG_CAPTION_LIMIT = 1024; // Telegram sendPhoto caption chegarasi
const CATALOG_PAGE_SIZE = 8;

// ─── Kontekst ───────────────────────────────────────────────────────────────

export interface BotEngineCtx {
  prisma: PrismaClient;
  tenantId: string;
  channelId: string;
  /** Do'kon nomi — matnlardagi {store} o'rniga qo'yiladi */
  storeName: string;
  /** Mini App URL (web_app tugmalari uchun) */
  storeUrl: string;
  botToken: string | undefined;
  chatId: number;
  telegramUserId: number | undefined;
  displayName: string;
  telegramUsername: string | undefined;
}

export interface BotUpdateInput {
  /** Foydalanuvchi yozgan matn (yoki tugma matni) */
  text?: string;
  /** Inline tugma bosilganda */
  callbackData?: string;
  callbackQueryId?: string;
  /** "Raqamni yuborish" tugmasi orqali kelgan kontakt */
  contactPhone?: string;
}

export interface BotEngineResult {
  action: string;
  /** Diagnostika uchun — nechta xabar yuborildi */
  sent: number;
}

/** Sessiya — Prisma modelining runtime ko'rinishi. */
interface Session {
  lang: BotLang;
  state: string;
  screenId: string | null;
  screenPath: string[];
  formId: string | null;
  fieldIndex: number;
  answers: Record<string, string>;
}

// ─── Klaviatura qurish ──────────────────────────────────────────────────────

type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

/**
 * Tugmalarni qatorlarga joylaydi. `fullWidth: false` bo'lgan ketma-ket
 * tugmalar juftlanadi — Gulf uslubidagi uzun ro'yxatlar ikki ustunga sig'adi.
 */
function layoutRows(items: Array<{ button: InlineButton; fullWidth: boolean }>): InlineButton[][] {
  const rows: InlineButton[][] = [];
  let pending: InlineButton | null = null;

  for (const item of items) {
    if (item.fullWidth) {
      if (pending) {
        rows.push([pending]);
        pending = null;
      }
      rows.push([item.button]);
    } else if (pending) {
      rows.push([pending, item.button]);
      pending = null;
    } else {
      pending = item.button;
    }
  }
  if (pending) rows.push([pending]);
  return rows;
}

/** Mini App katalog deep-link URL'i (ixtiyoriy kategoriya bilan). */
function catalogDeepLink(storeUrl: string, categoryId: string | null): string {
  const sep = storeUrl.includes("?") ? "&" : "?";
  const cat = categoryId ? `&category=${encodeURIComponent(categoryId)}` : "";
  return `${storeUrl}${sep}view=catalog${cat}`;
}

function screenKeyboard(screen: BotScreen, lang: BotLang, ctx: BotEngineCtx, hasParent: boolean) {
  const items: Array<{ button: InlineButton; fullWidth: boolean }> = [];

  for (const b of screen.buttons) {
    const label = pick(b.label, lang) || b.id;
    let button: InlineButton;
    if (b.action.type === "webapp") {
      button = { text: label, web_app: { url: ctx.storeUrl } };
    } else if (b.action.type === "catalog" && b.action.openInApp) {
      // Bot ichida ro'yxat emas — Mini App'ni ochamiz. Kategoriya tanlangan
      // bo'lsa deep-link bilan (storefront ?view=catalog&category=… ni o'qiydi).
      const url = catalogDeepLink(ctx.storeUrl, b.action.categoryId);
      button = { text: label, web_app: { url } };
    } else if (b.action.type === "url") {
      button = { text: label, url: b.action.url };
    } else {
      button = { text: label, callback_data: `b:${screen.id}:${b.id}` };
    }
    items.push({ button, fullWidth: b.fullWidth });
  }

  const rows = layoutRows(items);
  if (screen.showBack && hasParent) {
    rows.push([{ text: T[lang].back, callback_data: "nav:back" }]);
  } else if (screen.showBack) {
    rows.push([{ text: T[lang].home, callback_data: "nav:home" }]);
  }
  return rows.length ? { inline_keyboard: rows } : undefined;
}

/** Doimiy pastki klaviatura — Mini App do'kon tugmasi + bosh menyu. */
function persistentKeyboard(def: BotFlowDefinition, lang: BotLang, ctx: BotEngineCtx) {
  if (!def.settings.showStoreButton) return { remove_keyboard: true };
  return {
    keyboard: [
      [
        { text: pick(def.settings.storeButtonLabel, lang) || "🛍", web_app: { url: ctx.storeUrl } },
        { text: T[lang].menuButton },
      ],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

// ─── Engine ichki matnlari ──────────────────────────────────────────────────
// Bular tenant tahrirlaydigan kontent emas — navigatsiya elementlari.

const T = {
  uz: {
    back: "⬅️ Orqaga",
    home: "🏠 Bosh menyu",
    menuButton: "🏠 Menyu",
    cancel: "✖️ Bekor qilish",
    skip: "⏭ O'tkazib yuborish",
    sharePhone: "📱 Raqamni yuborish",
    formCancelled: "Bekor qilindi.",
    invalidPhone: "❌ Telefon raqami noto'g'ri. Masalan: +998901234567",
    invalidEmail: "❌ Email manzili noto'g'ri. Masalan: info@example.uz",
    invalidNumber: "❌ Raqam kiriting.",
    requiredField: "❌ Bu savolga javob berish shart.",
    orderAsk: "📦 Buyurtma raqamingizni kiriting:\n<i>Masalan: ORD-7523 yoki shunchaki 7523</i>",
    orderNotFound: "❌ Buyurtma topilmadi. Raqamni tekshiring va qayta kiriting.",
    langSelect: "🌐 Tilni tanlang:",
    langSaved: "✅ Til saqlandi: O'zbekcha 🇺🇿",
    operator: "💬 So'rovingiz operatorga uzatildi. Tez orada javob beramiz — shu yerga yozishingiz mumkin.",
    emptyCatalog: "Hozircha katalog bo'sh.",
    catalogTitle: "📦 <b>Katalog</b>\n\nMahsulotni tanlang:",
    prev: "⬅️",
    next: "➡️",
    outOfStock: "Mavjud emas",
    inStock: "Mavjud",
    priceOnRequest: "Narx so'rov bo'yicha",
    priceFrom: "dan",
    variantsTitle: "Mavjud o'lchamlar:",
    tiersTitle: "Hajm bo'yicha narx:",
    pcs: "dona",
    fromN: (n: number, unit: string) => `${n.toLocaleString("uz-UZ")} ${unit} dan`,
    moqLine: (n: number, unit: string) => `Minimal buyurtma: ${n.toLocaleString("uz-UZ")} ${unit}`,
    somethingWrong: "Xatolik yuz berdi. /start bosib qaytadan urinib ko'ring.",
    view: "👁 Ko'rish",
    catalogNav: "📄 Sahifalash",
    upsellTitle: "🎁 Ko'pincha birga olishadi:",
  },
  ru: {

    back: "⬅️ Назад",
    home: "🏠 Главное меню",
    menuButton: "🏠 Меню",
    cancel: "✖️ Отменить",
    skip: "⏭ Пропустить",
    sharePhone: "📱 Отправить номер телефона",
    formCancelled: "Отменено.",
    invalidPhone: "❌ Неверный номер телефона. Например: +998901234567",
    invalidEmail: "❌ Неверный адрес email. Например: info@example.uz",
    invalidNumber: "❌ Введите число.",
    requiredField: "❌ На этот вопрос необходимо ответить.",
    orderAsk: "📦 Введите номер заказа:\n<i>Например: ORD-7523 или просто 7523</i>",
    orderNotFound: "❌ Заказ не найден. Проверьте номер и попробуйте снова.",
    langSelect: "🌐 Выберите язык:",
    langSaved: "✅ Язык сохранён: Русский 🇷🇺",
    operator: "💬 Ваш запрос передан оператору. Мы ответим в ближайшее время — можете писать сюда.",
    emptyCatalog: "Каталог пока пуст.",
    catalogTitle: "📦 <b>Каталог</b>\n\nВыберите товар:",
    prev: "⬅️",
    next: "➡️",
    outOfStock: "Нет в наличии",
    inStock: "В наличии",
    priceOnRequest: "Цена по запросу",
    priceFrom: "от",
    variantsTitle: "Доступные варианты:",
    tiersTitle: "Цена по объёму:",
    pcs: "шт.",
    fromN: (n: number, unit: string) => `от ${n.toLocaleString("ru-RU")} ${unit}`,
    moqLine: (n: number, unit: string) => `Минимальный заказ: ${n.toLocaleString("ru-RU")} ${unit}`,
    somethingWrong: "Произошла ошибка. Нажмите /start и попробуйте снова.",
    view: "👁 Смотреть",
    catalogNav: "📄 Страницы",
    upsellTitle: "🎁 Часто покупают вместе:",
  },
} as const;


// ─── Yordamchilar ───────────────────────────────────────────────────────────

function interpolate(text: string, ctx: BotEngineCtx): string {
  return text.replace(/\{store\}/g, ctx.storeName);
}

function orderStatusLabel(status: string, lang: BotLang): string {
  const labels: Record<string, Record<BotLang, string>> = {
    PENDING: { uz: "🕐 Kutilmoqda", ru: "🕐 Ожидает обработки" },
    PROCESSING: { uz: "🔄 Tayyorlanmoqda", ru: "🔄 Готовится" },
    COMPLETED: { uz: "✅ Yetkazildi", ru: "✅ Доставлен" },
    CANCELLED: { uz: "❌ Bekor qilindi", ru: "❌ Отменён" },
    REFUNDED: { uz: "↩️ Qaytarildi", ru: "↩️ Возвращён" },
  };
  return labels[status]?.[lang] ?? status;
}

function formatMoney(value: number, currency: string): string {
  return currency === "UZS"
    ? `${value.toLocaleString("uz-UZ")} so'm`
    : `${value.toLocaleString("en-US")} ${currency}`;
}

const PHONE_RE = /^\+?[0-9][0-9\s\-()]{6,19}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ─── Sessiya ────────────────────────────────────────────────────────────────

async function loadSession(ctx: BotEngineCtx, defaultLang: BotLang): Promise<Session> {
  const row = await ctx.prisma.botSession.findUnique({
    where: { tenantId_chatId: { tenantId: ctx.tenantId, chatId: BigInt(ctx.chatId) } },
  });
  if (!row) {
    return { lang: defaultLang, state: "idle", screenId: null, screenPath: [], formId: null, fieldIndex: 0, answers: {} };
  }
  return {
    lang: row.lang === "ru" ? "ru" : "uz",
    state: row.state,
    screenId: row.screenId,
    screenPath: row.screenPath,
    formId: row.formId,
    fieldIndex: row.fieldIndex,
    answers: (row.answers ?? {}) as Record<string, string>,
  };
}

async function saveSession(ctx: BotEngineCtx, s: Session): Promise<void> {
  const data = {
    lang: s.lang,
    state: s.state,
    screenId: s.screenId,
    screenPath: s.screenPath,
    formId: s.formId,
    fieldIndex: s.fieldIndex,
    answers: s.answers as unknown as Prisma.InputJsonValue,
  };
  await ctx.prisma.botSession.upsert({
    where: { tenantId_chatId: { tenantId: ctx.tenantId, chatId: BigInt(ctx.chatId) } },
    create: { tenantId: ctx.tenantId, chatId: BigInt(ctx.chatId), ...data },
    update: data,
  });
}

/** Mijoz tilini Customer yozuvidan oladi (bot sessiyasidan ustun turadi). */
async function resolveLang(ctx: BotEngineCtx, fallback: BotLang): Promise<BotLang | null> {
  if (!ctx.telegramUserId) return null;
  const cust = await ctx.prisma.customer.findFirst({
    where: { tenantId: ctx.tenantId, telegramUserId: BigInt(ctx.telegramUserId) },
    select: { language: true },
  });
  if (!cust) return null;
  return cust.language === "ru" ? "ru" : cust.language === "uz" ? "uz" : fallback;
}

// ─── Yuborish ───────────────────────────────────────────────────────────────

async function send(ctx: BotEngineCtx, text: string, options?: Record<string, unknown>): Promise<number> {
  if (!ctx.botToken) return 0;
  const body = interpolate(text, ctx).slice(0, TG_TEXT_LIMIT);
  if (!body.trim()) return 0;
  const res = await sendTelegramRaw(ctx.botToken, ctx.chatId, body, options);
  return res.ok ? 1 : 0;
}

/**
 * Rasmli karta yuboradi (marketplace uslubi). Matn caption'ga (1024) sig'sa —
 * rasm + matn + tugmalar BITTA xabarda; sig'masa yoki rasm yaroqsiz bo'lsa —
 * rasm alohida, so'ng to'liq matn tugmalar bilan (yoki faqat matn). Rasmsiz —
 * oddiy matnli xabar. Hech qanday holatda avvalgi xatti-harakatdan yomon emas.
 */
async function sendCard(
  ctx: BotEngineCtx,
  image: string | undefined,
  text: string,
  options?: Record<string, unknown>,
): Promise<number> {
  if (!ctx.botToken) return 0;
  const body = interpolate(text, ctx);
  if (image) {
    // Butun karta caption'ga sig'sa — bitta rasm+caption+tugma xabari.
    // (HTML teglar buzilmasligi uchun faqat to'liq sig'ganda birlashtiramiz.)
    if (body.length <= TG_CAPTION_LIMIT) {
      const res = await sendTelegramPhoto(ctx.botToken, ctx.chatId, image, body, options);
      if (res.ok) return 1;
      // Rasm yuborilmadi (yaroqsiz URL) — matnga qaytamiz.
    } else {
      // Karta uzun — rasmni caption'siz alohida, matnni pastda tugmalar bilan.
      await sendTelegramPhoto(ctx.botToken, ctx.chatId, image).catch(() => null);
    }
  }
  return send(ctx, body, options);
}

async function answerCallback(ctx: BotEngineCtx, queryId: string | undefined): Promise<void> {
  if (!ctx.botToken || !queryId) return;
  // Spinner'ni darhol o'chiramiz — Telegram 10s ichida javob kutadi.
  await fetch(`https://api.telegram.org/bot${ctx.botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: queryId }),
  }).catch(() => null);
}

// ─── Ekran ko'rsatish ───────────────────────────────────────────────────────

function findScreen(def: BotFlowDefinition, id: string | null | undefined): BotScreen | undefined {
  if (!id) return undefined;
  return def.screens.find((s) => s.id === id);
}

async function showScreen(
  ctx: BotEngineCtx,
  def: BotFlowDefinition,
  session: Session,
  screenId: string,
  opts: { pushHistory: boolean; prefix?: string },
): Promise<number> {
  const screen = findScreen(def, screenId) ?? findScreen(def, def.settings.startScreenId);
  if (!screen) {
    return send(ctx, T[session.lang].somethingWrong);
  }

  if (opts.pushHistory && session.screenId && session.screenId !== screen.id) {
    session.screenPath = [...session.screenPath, session.screenId].slice(-10);
  }
  if (!opts.pushHistory) session.screenPath = [];
  session.screenId = screen.id;
  session.state = "idle";
  session.formId = null;
  session.fieldIndex = 0;
  session.answers = {};

  const body = [opts.prefix, pick(screen.text, session.lang)].filter((x) => x && x.trim()).join("\n\n");
  const keyboard = screenKeyboard(screen, session.lang, ctx, session.screenPath.length > 0);

  return sendCard(
    ctx,
    screen.imageUrl || undefined,
    body || screen.name,
    keyboard ? { reply_markup: keyboard } : undefined,
  );
}

// ─── Anketa ─────────────────────────────────────────────────────────────────

function findForm(def: BotFlowDefinition, id: string | null | undefined): BotForm | undefined {
  if (!id) return undefined;
  return def.forms.find((f) => f.id === id);
}

/** Joriy savolni yuboradi. */
async function askField(ctx: BotEngineCtx, session: Session, form: BotForm): Promise<number> {
  const field = form.fields[session.fieldIndex];
  if (!field) return 0;

  const lang = session.lang;
  const label = pick(field.label, lang) || field.id;
  const progress = `<i>${session.fieldIndex + 1}/${form.fields.length}</i>`;
  const text = `${progress}\n\n${label}`;

  if (field.type === "choice") {
    const rows = field.options.map((opt, i) => [
      { text: pick(opt, lang) || `#${i + 1}`, callback_data: `o:${i}` },
    ]);
    if (!field.required) rows.push([{ text: T[lang].skip, callback_data: "o:skip" }]);
    rows.push([{ text: T[lang].cancel, callback_data: "o:cancel" }]);
    return send(ctx, text, { reply_markup: { inline_keyboard: rows } });
  }

  if (field.type === "contact") {
    const keyboard = {
      keyboard: [[{ text: T[lang].sharePhone, request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
    return send(ctx, text, { reply_markup: keyboard });
  }

  const rows: InlineButton[][] = [];
  if (!field.required) rows.push([{ text: T[lang].skip, callback_data: "o:skip" }]);
  rows.push([{ text: T[lang].cancel, callback_data: "o:cancel" }]);
  return send(ctx, text, { reply_markup: { inline_keyboard: rows } });
}

/** Javobni tekshiradi. Xato bo'lsa xabar matnini qaytaradi. */
function validateAnswer(field: BotFormField, value: string, lang: BotLang): string | null {
  const v = value.trim();
  if (!v) return field.required ? T[lang].requiredField : null;
  if (field.type === "phone" || field.type === "contact") {
    if (!PHONE_RE.test(v)) return T[lang].invalidPhone;
  }
  if (field.type === "email" && !EMAIL_RE.test(v)) return T[lang].invalidEmail;
  if (field.type === "number" && !/^-?\d+([.,]\d+)?$/.test(v)) return T[lang].invalidNumber;
  return null;
}

/**
 * Anketani yakunlaydi: lid yaratadi, javoblarni izohga yozadi, adminni
 * xabardor qiladi va yakuniy matnni yuboradi.
 */
async function completeForm(
  ctx: BotEngineCtx,
  def: BotFlowDefinition,
  session: Session,
  form: BotForm,
): Promise<number> {
  const lang = session.lang;

  // Javoblarni Lead ustunlariga va o'qiladigan izohga ajratamiz
  const mapped: Partial<Record<"name" | "phone" | "email" | "company" | "position" | "location", string>> = {};
  const lines: string[] = [];

  for (const field of form.fields) {
    const value = session.answers[field.id];
    if (value === undefined || value === "") continue;
    const label = pick(field.label, lang).replace(/<[^>]+>/g, "").split("\n")[0].trim();
    lines.push(`${label} ${value}`);
    if (field.mapTo && !mapped[field.mapTo]) mapped[field.mapTo] = value.slice(0, 120);
  }

  const notes = [`[${form.name}]`, ...lines].join("\n").slice(0, 4000);
  const code = await nextLeadCode(ctx.prisma, ctx.tenantId);

  const lead = await ctx.prisma.lead.create({
    data: {
      tenantId: ctx.tenantId,
      channelId: ctx.channelId,
      code,
      name: mapped.name || ctx.displayName,
      phone: mapped.phone ?? null,
      email: mapped.email ?? null,
      company: mapped.company ?? null,
      position: mapped.position ?? null,
      location: mapped.location ?? null,
      status: form.leadStatus,
      tags: form.tags,
      notes,
      utmSource: "telegram-bot",
      utmCampaign: form.id,
      interactions: {
        create: {
          tenantId: ctx.tenantId,
          type: "TELEGRAM",
          direction: "INBOUND",
          content: notes,
          createdBy: ctx.displayName,
        },
      },
    },
    select: { id: true, code: true, name: true, phone: true },
  });

  publishToTenant(ctx.tenantId, { type: "lead.created", leadId: lead.id, name: lead.name });

  if (form.notifyAdmin) {
    const summary = lines.slice(0, 8).join("\n").slice(0, 1500);
    notifyAdmin(
      ctx.prisma,
      ctx.tenantId,
      `📥 <b>Bot anketasi: ${form.name}</b>\n\n#${lead.code}\n${summary}`,
    ).catch(() => null);
  }

  // Sessiyani tozalab bosh ekranga qaytamiz
  session.state = "idle";
  session.formId = null;
  session.fieldIndex = 0;
  session.answers = {};

  const successText = pick(form.successText, lang).replace(/\{id\}/g, lead.code);
  let sent = await send(ctx, successText || `✅ #${lead.code}`, {
    reply_markup: persistentKeyboard(def, lang, ctx),
  });
  sent += await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false });
  return sent;
}

/** Javobni qabul qiladi va keyingi savolga o'tadi (yoki anketani yakunlaydi). */
async function advanceForm(
  ctx: BotEngineCtx,
  def: BotFlowDefinition,
  session: Session,
  form: BotForm,
  rawValue: string | null,
): Promise<number> {
  const field = form.fields[session.fieldIndex];
  if (!field) return completeForm(ctx, def, session, form);

  if (rawValue === null) {
    // O'tkazib yuborish
    if (field.required) return send(ctx, T[session.lang].requiredField);
  } else {
    const error = validateAnswer(field, rawValue, session.lang);
    if (error) {
      await send(ctx, error);
      return askField(ctx, session, form);
    }
    session.answers[field.id] = rawValue.trim().slice(0, 1000);
  }

  session.fieldIndex += 1;
  if (session.fieldIndex >= form.fields.length) {
    return completeForm(ctx, def, session, form);
  }
  return askField(ctx, session, form);
}

async function startForm(
  ctx: BotEngineCtx,
  session: Session,
  form: BotForm,
): Promise<number> {
  session.state = "form";
  session.formId = form.id;
  session.fieldIndex = 0;
  session.answers = {};

  let sent = 0;
  const intro = pick(form.intro, session.lang);
  if (intro) sent += await send(ctx, intro);
  sent += await askField(ctx, session, form);
  return sent;
}

// ─── Katalog ────────────────────────────────────────────────────────────────

async function showCatalog(
  ctx: BotEngineCtx,
  session: Session,
  categoryId: string | null,
  page: number,
): Promise<number> {
  const lang = session.lang;
  const where = {
    tenantId: ctx.tenantId,
    active: true,
    ...(categoryId ? { categoryId } : {}),
  };

  const [total, products] = await Promise.all([
    ctx.prisma.product.count({ where }),
    ctx.prisma.product.findMany({
      where,
      // Variantli mahsulotda narx variantlardan hisoblanadi — aks holda bot
      // Product.price (odatda 0) ni ko'rsatib, "0 so'm" deb yozardi.
      select: {
        id: true, name: true, price: true, oldPrice: true, currency: true, stock: true,
        images: true,
        variants: { where: { active: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: page * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
    }),
  ]);

  if (total === 0) {
    return send(ctx, T[lang].emptyCatalog, {
      reply_markup: { inline_keyboard: [[{ text: T[lang].home, callback_data: "nav:home" }]] },
    });
  }

  const rows: InlineButton[][] = products.map((p) => {
    const pricing = productPricing(
      { price: Number(p.price), oldPrice: p.oldPrice === null ? null : Number(p.oldPrice), stock: p.stock },
      p.variants.map(toVariantLike),
    );
    // Narxlar turlicha bo'lsa "dan" — marketplace uslubi (storefront bilan bir xil)
    const priceLabel = pricing.price > 0
      ? `${pricing.priceVaries ? T[lang].priceFrom + " " : ""}${formatMoney(pricing.price, p.currency)}`
      : T[lang].priceOnRequest;
    return [{ text: `${p.name} — ${priceLabel}`.slice(0, 60), callback_data: `p:${p.id}` }];
  });

  const nav: InlineButton[] = [];
  const catKey = categoryId ?? "-";
  if (page > 0) nav.push({ text: T[lang].prev, callback_data: `cat:${catKey}:${page - 1}` });
  if ((page + 1) * CATALOG_PAGE_SIZE < total) nav.push({ text: T[lang].next, callback_data: `cat:${catKey}:${page + 1}` });
  if (nav.length) rows.push(nav);
  rows.push([{ text: T[lang].home, callback_data: "nav:home" }]);

  const pageInfo = total > CATALOG_PAGE_SIZE
    ? `\n\n<i>${page * CATALOG_PAGE_SIZE + 1}–${Math.min((page + 1) * CATALOG_PAGE_SIZE, total)} / ${total}</i>`
    : "";

  // Birinchi mahsulot rasmini "banner" sifatida ishlatamiz — ro'yxat rasmsiz,
  // quruq matn bo'lib ko'rinmasligi uchun (marketplace uslubi).
  const bannerImage = products.find((p) => Array.isArray(p.images) && (p.images as string[])[0])
    ?.images as string[] | undefined;
  const banner = bannerImage?.[0];

  return sendCard(ctx, banner, T[lang].catalogTitle + pageInfo, { reply_markup: { inline_keyboard: rows } });
}


async function showProduct(ctx: BotEngineCtx, def: BotFlowDefinition, session: Session, productId: string): Promise<number> {
  const lang = session.lang;
  const p = await ctx.prisma.product.findFirst({
    where: { id: productId, tenantId: ctx.tenantId, active: true },
    select: {
      id: true, name: true, description: true, price: true, oldPrice: true,
      currency: true, stock: true, sku: true, images: true,
      priceTiers: true, moq: true, unit: true,
      variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!p) return send(ctx, T[lang].somethingWrong);

  const variants = visibleVariants(p.variants.map(toVariantLike));
  const pricing = productPricing(
    {
      price: Number(p.price),
      oldPrice: p.oldPrice === null ? null : Number(p.oldPrice),
      stock: p.stock,
      imageUrl: null,
      images: p.images,
    },
    variants,
  );

  // Variantlar ro'yxati — botda savat yo'q, shuning uchun ular ma'lumot
  // sifatida ko'rsatiladi va mijoz Mini App'da yoki menejer orqali tanlaydi.
  const variantLines = variants.length
    ? [
      "",
      `<b>${T[lang].variantsTitle}</b>`,
      ...variants.slice(0, 12).map((v) => {
        const stockMark = v.stock > 0 ? "" : ` — ${T[lang].outOfStock}`;
        return `• ${v.name} — ${formatMoney(v.price, p.currency)}${stockMark}`;
      }),
    ]
    : [];

  // B2B narx pog'onalari — hajm bo'yicha (maʼlumot; yakuniy narxni menejer tasdiqlaydi)
  const tiers = parsePriceTiers(p.priceTiers);
  const unitLabel = p.unit || T[lang].pcs;
  const tierLines = tiers.length
    ? [
      "",
      `<b>${T[lang].tiersTitle}</b>`,
      ...tiers.map((tr) => `• ${T[lang].fromN(tr.minQty, unitLabel)} — ${formatMoney(tr.price, p.currency)}`),
    ]
    : [];
  const moqLine = p.moq && p.moq > 0 ? [`📦 ${T[lang].moqLine(p.moq, unitLabel)}`] : [];

  const priceLine = pricing.price > 0
    ? `💰 ${pricing.priceVaries ? T[lang].priceFrom + " " : ""}${formatMoney(pricing.price, p.currency)}`
    : `💰 ${T[lang].priceOnRequest}`;

  const image = Array.isArray(p.images) ? (p.images as string[])[0] : undefined;

  // Karta "boshi" — nom/narx/zaxira/variant/pog'ona (asosiy ma'lumot).
  const head = [
    `<b>${p.name}</b>`,
    p.sku ? `<code>${p.sku}</code>` : "",
    "",
    priceLine,
    pricing.stock > 0 ? `📦 ${T[lang].inStock}` : `📦 ${T[lang].outOfStock}`,
    ...variantLines,
    ...tierLines,
    ...moqLine,
  ].filter((x) => x !== "").join("\n");

  // Tavsif. Rasm bo'lsa kartani bitta xabar (rasm + caption) qilish uchun
  // tavsifni caption byudjetiga sig'diramiz; rasmsiz — kengroq matn.
  const rawDesc = (p.description ?? "").trim();
  const descBudget = image ? Math.max(0, TG_CAPTION_LIMIT - head.length - 8) : 1500;
  const desc = rawDesc.length > descBudget ? rawDesc.slice(0, Math.max(0, descBudget - 1)).trimEnd() + "…" : rawDesc;
  const cardText = desc ? `${head}\n\n${desc}` : head;

  // Upsell / combo — shu mahsulot bilan birga tez-tez olinadigan qo'shimchalar
  // (admin panelda "Mahsulotlar → Combo" bo'limida sozlanadi). Bot'da savat
  // yo'q, shuning uchun taklif "Mini App'da ko'rish" tugmasi bilan ko'rsatiladi.
  const addons = await ctx.prisma.productAddon.findMany({
    where: { tenantId: ctx.tenantId, mainProductId: p.id, addonProduct: { active: true } },
    orderBy: { position: "asc" },
    take: 3,
    select: {
      discountPct: true,
      addonProduct: { select: { id: true, name: true, price: true, currency: true } },
    },
  });

  const upsellLines = addons.length
    ? [
      "",
      `<b>${T[lang].upsellTitle}</b>`,
      ...addons.map((a) => {
        const orig = Number(a.addonProduct.price);
        const discounted = a.discountPct > 0 ? Math.round(orig * (1 - a.discountPct / 100)) : orig;
        const pctMark = a.discountPct > 0 ? ` (−${a.discountPct}%)` : "";
        return `• ${a.addonProduct.name} — ${formatMoney(discounted, a.addonProduct.currency)}${pctMark}`;
      }),
    ]
    : [];

  const cardTextWithUpsell = upsellLines.length ? `${cardText}\n${upsellLines.join("\n")}` : cardText;

  // Mahsulot kartochkasidagi harakatlar — oqimdagi birinchi anketa (mavjud bo'lsa)
  const rows: InlineButton[][] = [];
  const firstForm = def.forms[0];
  if (firstForm) {
    rows.push([{ text: firstForm.name, callback_data: `f:${firstForm.id}` }]);
  }
  for (const a of addons) {
    rows.push([{ text: `🎁 ${a.addonProduct.name}`.slice(0, 60), callback_data: `p:${a.addonProduct.id}` }]);
  }
  if (def.settings.showStoreButton) {
    rows.push([{ text: pick(def.settings.storeButtonLabel, lang) || "🛍", web_app: { url: ctx.storeUrl } }]);
  }
  rows.push([{ text: T[lang].home, callback_data: "nav:home" }]);

  return sendCard(ctx, image, cardTextWithUpsell, {
    reply_markup: { inline_keyboard: rows },
  });
}


// ─── Buyurtma kuzatish ──────────────────────────────────────────────────────

async function lookupOrder(ctx: BotEngineCtx, session: Session, input: string): Promise<number> {
  const lang = session.lang;
  const raw = input.trim().toUpperCase();
  const orderCode = raw.startsWith("ORD-") ? raw : `ORD-${raw}`;

  const order = await ctx.prisma.order.findFirst({
    where: { tenantId: ctx.tenantId, code: orderCode },
    select: { code: true, status: true, total: true, currency: true, items: { select: { id: true } } },
  });

  session.state = "idle";
  if (!order) {
    return send(ctx, T[lang].orderNotFound, {
      reply_markup: { inline_keyboard: [[{ text: T[lang].home, callback_data: "nav:home" }]] },
    });
  }

  const text = lang === "ru"
    ? `📦 <b>Заказ #${order.code}</b>\n\nСтатус: ${orderStatusLabel(order.status, lang)}\nТоваров: ${order.items.length} шт.\nИтого: ${formatMoney(Number(order.total), order.currency)}`
    : `📦 <b>Buyurtma #${order.code}</b>\n\nHolati: ${orderStatusLabel(order.status, lang)}\nMahsulotlar: ${order.items.length} ta\nJami: ${formatMoney(Number(order.total), order.currency)}`;

  return send(ctx, text, {
    reply_markup: { inline_keyboard: [[{ text: T[lang].home, callback_data: "nav:home" }]] },
  });
}

// ─── Til ────────────────────────────────────────────────────────────────────

async function askLanguage(ctx: BotEngineCtx, def: BotFlowDefinition, session: Session): Promise<number> {
  const buttons: InlineButton[] = [];
  if (def.settings.languages.includes("uz")) buttons.push({ text: "🇺🇿 O'zbekcha", callback_data: "lang:uz" });
  if (def.settings.languages.includes("ru")) buttons.push({ text: "🇷🇺 Русский", callback_data: "lang:ru" });
  return send(ctx, T[session.lang].langSelect, { reply_markup: { inline_keyboard: [buttons] } });
}

async function saveLanguage(ctx: BotEngineCtx, session: Session, lang: BotLang): Promise<void> {
  session.lang = lang;
  if (!ctx.telegramUserId) return;
  const tgId = BigInt(ctx.telegramUserId);
  const existing = await ctx.prisma.customer.findFirst({
    where: { tenantId: ctx.tenantId, telegramUserId: tgId },
    select: { id: true },
  });
  if (existing) {
    await ctx.prisma.customer.update({ where: { id: existing.id }, data: { language: lang } });
  } else {
    await ctx.prisma.customer.create({
      data: {
        tenantId: ctx.tenantId,
        telegramUserId: tgId,
        telegramUsername: ctx.telegramUsername,
        name: ctx.displayName,
        language: lang,
      },
    });
  }
}

// ─── Operatorga ulash ───────────────────────────────────────────────────────

async function handoffToOperator(ctx: BotEngineCtx, session: Session, note: string): Promise<number> {
  await ensureConversation(ctx, note || "[operator so'raldi]");
  notifyAdmin(
    ctx.prisma,
    ctx.tenantId,
    `💬 <b>Botda operator so'raldi</b>\n\n${ctx.displayName}${ctx.telegramUsername ? ` (@${ctx.telegramUsername})` : ""}\n${note.slice(0, 500)}`,
  ).catch(() => null);
  return send(ctx, T[session.lang].operator, {
    reply_markup: { inline_keyboard: [[{ text: T[session.lang].home, callback_data: "nav:home" }]] },
  });
}

/** Admin Chat sahifasi uchun suhbat va xabar yozuvi. */
async function ensureConversation(ctx: BotEngineCtx, text: string): Promise<void> {
  if (!ctx.telegramUserId) return;
  const externalId = String(ctx.telegramUserId);
  const customer = await ctx.prisma.customer.findFirst({
    where: { tenantId: ctx.tenantId, telegramUserId: BigInt(ctx.telegramUserId) },
    select: { id: true, name: true },
  });

  let conv = await ctx.prisma.conversation.findFirst({
    where: { tenantId: ctx.tenantId, channelId: ctx.channelId, externalUserId: externalId },
    select: { id: true, status: true },
  });

  if (!conv) {
    conv = await ctx.prisma.conversation.create({
      data: {
        tenantId: ctx.tenantId,
        channelId: ctx.channelId,
        customerId: customer?.id ?? null,
        externalUserId: externalId,
        customerName: customer?.name ?? ctx.displayName,
        status: "ACTIVE",
        lastMessageAt: new Date(),
        lastMessagePreview: text.slice(0, 120),
        unreadCount: 1,
      },
      select: { id: true, status: true },
    });
  } else {
    await ctx.prisma.conversation.update({
      where: { id: conv.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: text.slice(0, 120),
        unreadCount: { increment: 1 },
        status: conv.status === "RESOLVED" || conv.status === "ARCHIVED" ? "ACTIVE" : conv.status,
        ...(customer?.id && { customerId: customer.id }),
      },
    });
  }

  await ctx.prisma.conversationMessage.create({
    data: { conversationId: conv.id, direction: "INBOUND", content: text.slice(0, 4000), authorName: ctx.displayName },
  });
}

// ─── Tugma amalini bajarish ─────────────────────────────────────────────────

async function runAction(
  ctx: BotEngineCtx,
  def: BotFlowDefinition,
  session: Session,
  screen: BotScreen,
  buttonId: string,
): Promise<BotEngineResult> {
  const button = screen.buttons.find((b) => b.id === buttonId);
  if (!button) {
    return { action: "unknown_button", sent: await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false }) };
  }

  const act = button.action;
  switch (act.type) {
    case "screen":
      return { action: "screen", sent: await showScreen(ctx, def, session, act.screenId, { pushHistory: true }) };

    case "form": {
      const form = findForm(def, act.formId);
      if (!form) return { action: "form_missing", sent: await send(ctx, T[session.lang].somethingWrong) };
      return { action: "form_start", sent: await startForm(ctx, session, form) };
    }

    case "text": {
      const rows: InlineButton[][] = [[{ text: T[session.lang].back, callback_data: "nav:back" }]];
      session.screenPath = [...session.screenPath, screen.id].slice(-10);
      return {
        action: "text",
        sent: await send(ctx, pick(act.text, session.lang), { reply_markup: { inline_keyboard: rows } }),
      };
    }

    case "catalog":
      return { action: "catalog", sent: await showCatalog(ctx, session, act.categoryId, 0) };

    case "track_order":
      session.state = "awaiting_order";
      return { action: "track_ask", sent: await send(ctx, T[session.lang].orderAsk) };

    case "operator":
      return { action: "operator", sent: await handoffToOperator(ctx, session, `[${screen.name} → ${pick(button.label, session.lang)}]`) };

    case "language":
      return { action: "lang_ask", sent: await askLanguage(ctx, def, session) };

    case "back":
      return { action: "back", sent: await goBack(ctx, def, session) };

    case "home":
      return { action: "home", sent: await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false }) };

    // webapp/url — Telegram tugmani o'zi ochadi, callback kelmaydi
    default:
      return { action: "noop", sent: 0 };
  }
}

async function goBack(ctx: BotEngineCtx, def: BotFlowDefinition, session: Session): Promise<number> {
  const previous = session.screenPath.pop();
  if (!previous) {
    return showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false });
  }
  // showScreen tarixni yana surmasligi uchun joriy ekranni tozalaymiz
  const path = [...session.screenPath];
  session.screenId = null;
  const sent = await showScreen(ctx, def, session, previous, { pushHistory: true });
  session.screenPath = path;
  return sent;
}

// ─── Kirish nuqtasi ─────────────────────────────────────────────────────────

/**
 * Bir Telegram update'ni oqim bo'yicha qayta ishlaydi.
 * Har doim sessiyani saqlab tugaydi.
 */
export async function handleBotFlowUpdate(
  ctx: BotEngineCtx,
  def: BotFlowDefinition,
  update: BotUpdateInput,
): Promise<BotEngineResult> {
  const session = await loadSession(ctx, def.settings.defaultLang);

  // Customer'da saqlangan til sessiyadan ustun (Mini App'da o'zgartirilgan bo'lishi mumkin)
  const customerLang = await resolveLang(ctx, session.lang);
  if (customerLang) session.lang = customerLang;
  if (!def.settings.languages.includes(session.lang)) {
    session.lang = def.settings.languages[0] ?? def.settings.defaultLang;
  }

  const result = await dispatch(ctx, def, session, update);
  await saveSession(ctx, session);
  return result;
}

async function dispatch(
  ctx: BotEngineCtx,
  def: BotFlowDefinition,
  session: Session,
  update: BotUpdateInput,
): Promise<BotEngineResult> {
  // ─── Inline tugma ─────────────────────────────────────────────────────────
  if (update.callbackData) {
    await answerCallback(ctx, update.callbackQueryId);
    const data = update.callbackData;

    if (data.startsWith("lang:")) {
      const lang: BotLang = data.slice(5) === "ru" ? "ru" : "uz";
      await saveLanguage(ctx, session, lang);
      const sent = await send(ctx, T[lang].langSaved, { reply_markup: persistentKeyboard(def, lang, ctx) });
      return { action: "lang_saved", sent: sent + (await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false })) };
    }

    if (data === "nav:home") {
      return { action: "home", sent: await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false }) };
    }
    if (data === "nav:back") {
      return { action: "back", sent: await goBack(ctx, def, session) };
    }

    if (data.startsWith("s:")) {
      return { action: "screen", sent: await showScreen(ctx, def, session, data.slice(2), { pushHistory: true }) };
    }

    if (data.startsWith("f:")) {
      const form = findForm(def, data.slice(2));
      if (!form) return { action: "form_missing", sent: await send(ctx, T[session.lang].somethingWrong) };
      return { action: "form_start", sent: await startForm(ctx, session, form) };
    }

    if (data.startsWith("cat:")) {
      const [, catRaw, pageRaw] = data.split(":");
      const categoryId = catRaw === "-" ? null : catRaw;
      return { action: "catalog", sent: await showCatalog(ctx, session, categoryId, Number(pageRaw) || 0) };
    }

    if (data.startsWith("p:")) {
      return { action: "product", sent: await showProduct(ctx, def, session, data.slice(2)) };
    }

    // Anketa variantlari
    if (data.startsWith("o:")) {
      const form = findForm(def, session.formId);
      if (!form || session.state !== "form") {
        return { action: "form_stale", sent: await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false }) };
      }
      const arg = data.slice(2);

      if (arg === "cancel") {
        session.state = "idle";
        session.formId = null;
        session.answers = {};
        const sent = await send(ctx, T[session.lang].formCancelled);
        return { action: "form_cancel", sent: sent + (await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false })) };
      }
      if (arg === "skip") {
        return { action: "form_skip", sent: await advanceForm(ctx, def, session, form, null) };
      }

      const field = form.fields[session.fieldIndex];
      const option = field?.options[Number(arg)];
      if (!field || !option) return { action: "form_bad_option", sent: 0 };
      return { action: "form_answer", sent: await advanceForm(ctx, def, session, form, pick(option, session.lang)) };
    }

    // b:<screenId>:<buttonId>
    if (data.startsWith("b:")) {
      const rest = data.slice(2);
      const sep = rest.indexOf(":");
      const screenId = sep >= 0 ? rest.slice(0, sep) : rest;
      const buttonId = sep >= 0 ? rest.slice(sep + 1) : "";
      const screen = findScreen(def, screenId);
      if (!screen) {
        return { action: "screen_missing", sent: await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false }) };
      }
      return runAction(ctx, def, session, screen, buttonId);
    }

    return { action: "unknown_callback", sent: 0 };
  }

  // ─── Kontakt ulashildi ────────────────────────────────────────────────────
  if (update.contactPhone) {
    const form = findForm(def, session.formId);
    if (form && session.state === "form") {
      return { action: "form_contact", sent: await advanceForm(ctx, def, session, form, update.contactPhone) };
    }
    // Anketadan tashqarida kelgan raqam — mijoz profiliga yozamiz
    await saveContactPhone(ctx, update.contactPhone);
    return { action: "contact_saved", sent: await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false }) };
  }

  const text = (update.text ?? "").trim();
  if (!text) return { action: "skipped", sent: 0 };

  // ─── /start ───────────────────────────────────────────────────────────────
  if (text === "/start" || text.startsWith("/start ")) {
    session.screenPath = [];
    session.screenId = null;
    session.state = "idle";
    session.formId = null;

    await registerCommands(ctx, def, session.lang);

    let sent = 0;
    const welcome = pick(def.settings.welcome, session.lang);
    if (welcome) {
      sent += await send(ctx, welcome, { reply_markup: persistentKeyboard(def, session.lang, ctx) });
    } else {
      sent += await send(ctx, T[session.lang].menuButton, { reply_markup: persistentKeyboard(def, session.lang, ctx) });
    }

    if (def.settings.askLanguageOnStart && def.settings.languages.length > 1) {
      sent += await askLanguage(ctx, def, session);
      return { action: "start_lang", sent };
    }

    sent += await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false });
    return { action: "start", sent };
  }

  // ─── Boshqa slash buyruqlar ───────────────────────────────────────────────
  if (text.startsWith("/")) {
    const cmd = text.slice(1).split(/[\s@]/)[0].toLowerCase();
    const configured = def.settings.commands.find((c) => c.command === cmd);
    if (configured) {
      const target = configured.screenId ?? def.settings.startScreenId;
      return { action: "command", sent: await showScreen(ctx, def, session, target, { pushHistory: target !== def.settings.startScreenId }) };
    }
  }

  // ─── Doimiy klaviaturaning "Menyu" tugmasi ────────────────────────────────
  if (text === T.uz.menuButton || text === T.ru.menuButton) {
    return { action: "home", sent: await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false }) };
  }

  // ─── Aktiv anketa ─────────────────────────────────────────────────────────
  if (session.state === "form") {
    const form = findForm(def, session.formId);
    if (form) {
      const field = form.fields[session.fieldIndex];
      // Variantli savolga matn bilan javob berilsa — mos variantni topamiz
      if (field?.type === "choice") {
        const idx = field.options.findIndex(
          (o) => pick(o, session.lang).toLowerCase() === text.toLowerCase(),
        );
        if (idx < 0) {
          await send(ctx, T[session.lang].requiredField);
          return { action: "form_retry", sent: await askField(ctx, session, form) };
        }
        return { action: "form_answer", sent: await advanceForm(ctx, def, session, form, pick(field.options[idx], session.lang)) };
      }
      return { action: "form_answer", sent: await advanceForm(ctx, def, session, form, text) };
    }
    session.state = "idle";
  }

  // ─── Buyurtma raqami kutilyapti ───────────────────────────────────────────
  if (session.state === "awaiting_order") {
    return { action: "order_lookup", sent: await lookupOrder(ctx, session, text) };
  }

  // ─── Erkin matn — suhbatga yozamiz, keyin fallback ────────────────────────
  await ensureConversation(ctx, text);

  switch (def.settings.fallback) {
    case "menu":
      return { action: "fallback_menu", sent: await showScreen(ctx, def, session, def.settings.startScreenId, { pushHistory: false }) };

    case "operator":
      return { action: "fallback_operator", sent: await handoffToOperator(ctx, session, text) };

    case "ai": {
      const ai = await aiReplyToMessage(ctx.prisma, ctx.tenantId, text).catch(() => ({ used: false as const }));
      if (ai.used && "text" in ai && ai.text && !("handoffToOperator" in ai && ai.handoffToOperator)) {
        const rows: InlineButton[][] = [[{ text: T[session.lang].home, callback_data: "nav:home" }]];
        return { action: "fallback_ai", sent: await send(ctx, ai.text, { reply_markup: { inline_keyboard: rows } }) };
      }
      return { action: "fallback_ai_lead", sent: await createFallbackLead(ctx, def, session, text) };
    }

    case "lead":
    default:
      return { action: "fallback_lead", sent: await createFallbackLead(ctx, def, session, text) };
  }
}

async function createFallbackLead(
  ctx: BotEngineCtx,
  def: BotFlowDefinition,
  session: Session,
  text: string,
): Promise<number> {
  const code = await nextLeadCode(ctx.prisma, ctx.tenantId);
  const lead = await ctx.prisma.lead.create({
    data: {
      tenantId: ctx.tenantId,
      channelId: ctx.channelId,
      code,
      name: ctx.displayName,
      notes: text.slice(0, 500),
      status: "NEW",
      utmSource: "telegram-bot",
      tags: ["bot"],
      interactions: {
        create: {
          tenantId: ctx.tenantId,
          type: "TELEGRAM",
          direction: "INBOUND",
          content: text.slice(0, 2000),
          createdBy: ctx.displayName,
        },
      },
    },
    select: { id: true, name: true },
  });
  publishToTenant(ctx.tenantId, { type: "lead.created", leadId: lead.id, name: lead.name });

  return send(ctx, pick(def.settings.fallbackText, session.lang), {
    reply_markup: { inline_keyboard: [[{ text: T[session.lang].home, callback_data: "nav:home" }]] },
  });
}

async function saveContactPhone(ctx: BotEngineCtx, phone: string): Promise<void> {
  if (!ctx.telegramUserId) return;
  const tgId = BigInt(ctx.telegramUserId);
  const existing = await ctx.prisma.customer.findFirst({
    where: { tenantId: ctx.tenantId, telegramUserId: tgId },
    select: { id: true, phone: true },
  });
  if (existing) {
    if (!existing.phone) {
      await ctx.prisma.customer.update({ where: { id: existing.id }, data: { phone } });
    }
  } else {
    await ctx.prisma.customer.create({
      data: {
        tenantId: ctx.tenantId,
        telegramUserId: tgId,
        telegramUsername: ctx.telegramUsername,
        name: ctx.displayName,
        phone,
      },
    });
  }
}

/** BotFather buyruqlar menyusi — fire-and-forget. */
async function registerCommands(ctx: BotEngineCtx, def: BotFlowDefinition, lang: BotLang): Promise<void> {
  if (!ctx.botToken || def.settings.commands.length === 0) return;
  const commands = def.settings.commands.map((c) => ({
    command: c.command,
    description: (pick(c.description, lang) || c.command).slice(0, 256),
  }));
  fetch(`https://api.telegram.org/bot${ctx.botToken}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  }).catch(() => null);
}

// ─── Preview simulyatori (admin panel uchun) ────────────────────────────────

export interface SimMessage {
  text: string;
  buttons: Array<{ label: string; kind: "screen" | "form" | "action" | "link" }>;
}

/**
 * Telegram'siz, DB'siz oqimni "quruq" ishga tushiradi — admin panelidagi
 * jonli preview shu funksiyadan foydalanadi, shuning uchun preview va haqiqiy
 * bot bir xil qoidalarni ishlatadi.
 */
export function simulateScreen(def: BotFlowDefinition, screenId: string, lang: BotLang, storeName: string): SimMessage | null {
  const screen = def.screens.find((s) => s.id === screenId);
  if (!screen) return null;

  const buttons = screen.buttons.map((b) => ({
    label: pick(b.label, lang) || b.id,
    kind:
      b.action.type === "screen"
        ? ("screen" as const)
        : b.action.type === "form"
          ? ("form" as const)
          : b.action.type === "url" || b.action.type === "webapp"
            ? ("link" as const)
            : ("action" as const),
  }));

  return {
    text: pick(screen.text, lang).replace(/\{store\}/g, storeName),
    buttons,
  };
}
