// Bot konstruktori — suhbat oqimi kontrakti.
//
// Tenant o'z Telegram botini shu JSON orqali boshqaradi: ekranlar (menyular),
// tugmalar va anketalar. `BotFlow.definition` shu shaklda saqlanadi.
//
// Dizayn qoidalari:
//   • Har bir matn ikki tilda ({ uz, ru }) — bo'sh til boshqasiga fallback qiladi.
//   • ID'lar admin tomonidan yoziladigan slug'lar — Telegram callback_data 64
//     bayt bilan cheklangani uchun uzunligi qattiq cheklanadi.
//   • Sxema **oldinga mos**: noma'lum tugma turi runtime'da e'tiborsiz qoldiriladi,
//     bot ishlashdan to'xtamaydi.

import { z } from "zod";

// ─── Asosiy tiplar ──────────────────────────────────────────────────────────

export const BOT_LANGS = ["uz", "ru"] as const;
export type BotLang = (typeof BOT_LANGS)[number];

/** Ikki tilli matn. Kamida bitta til to'ldirilishi kerak. */
export const localizedSchema = z.object({
  uz: z.string().max(3500).default(""),
  ru: z.string().max(3500).default(""),
});
export type Localized = z.infer<typeof localizedSchema>;

/** Slug ID — callback_data ichida ishlatiladi, shuning uchun qisqa va xavfsiz. */
const slugId = z
  .string()
  .min(1)
  .max(24)
  .regex(/^[a-z0-9_]+$/, "Faqat kichik harf, raqam va pastki chiziq");

// ─── Tugma amallari ─────────────────────────────────────────────────────────

export const buttonActionSchema = z.discriminatedUnion("type", [
  /** Boshqa ekranga o'tish */
  z.object({ type: z.literal("screen"), screenId: slugId }),
  /** Anketani boshlash */
  z.object({ type: z.literal("form"), formId: slugId }),
  /** Oddiy matn javob (mini-sahifa: "Kompaniya haqida", "Kontaktlar") */
  z.object({ type: z.literal("text"), text: localizedSchema }),
  /** Mini App do'konini ochish (Telegram web_app) */
  z.object({ type: z.literal("webapp") }),
  /** Tashqi havola */
  z.object({ type: z.literal("url"), url: z.string().url().max(500) }),
  /** Haqiqiy katalogdan mahsulotlar ro'yxati (DB'dan) yoki Mini App'ni ochish */
  z.object({
    type: z.literal("catalog"),
    categoryId: z.string().max(40).nullable().default(null),
    /**
     * true bo'lsa: bot ichida matn ro'yxati o'rniga Mini App do'koni ochiladi
     * (kategoriya tanlangan bo'lsa o'sha kategoriyaga deep-link bilan). Chakana
     * do'konda mantiqiy — Mini App'da rasm/variant/savat allaqachon batafsil.
     */
    openInApp: z.boolean().default(false),
  }),
  /** Buyurtma kuzatish (kod so'raydi) */
  z.object({ type: z.literal("track_order") }),
  /** Operatorga ulash — Chat sahifasida suhbat ochiladi */
  z.object({ type: z.literal("operator") }),
  /** Til tanlash */
  z.object({ type: z.literal("language") }),
  /** Bir qadam orqaga */
  z.object({ type: z.literal("back") }),
  /** Bosh menyu */
  z.object({ type: z.literal("home") }),
]);
export type ButtonAction = z.infer<typeof buttonActionSchema>;

export const buttonSchema = z.object({
  id: slugId,
  label: localizedSchema,
  action: buttonActionSchema,
  /** Bitta qatorda yakka tursinmi (uzun matnli tugmalar uchun) */
  fullWidth: z.boolean().default(true),
});
export type BotButton = z.infer<typeof buttonSchema>;

// ─── Ekran ──────────────────────────────────────────────────────────────────

export const screenSchema = z.object({
  id: slugId,
  /** Admin panelida ko'rinadigan nom (mijoz ko'rmaydi) */
  name: z.string().min(1).max(80),
  text: localizedSchema,
  imageUrl: z.string().max(500).nullable().default(null),
  buttons: z.array(buttonSchema).max(24).default([]),
  /** Avtomatik "⬅️ Orqaga" tugmasi qo'shilsinmi */
  showBack: z.boolean().default(true),
});
export type BotScreen = z.infer<typeof screenSchema>;

// ─── Anketa (form) ──────────────────────────────────────────────────────────

export const FIELD_TYPES = ["text", "phone", "email", "number", "choice", "contact"] as const;

/** Anketa javobi Lead ustuniga yozilishi mumkin. */
export const LEAD_FIELDS = ["name", "phone", "email", "company", "position", "location"] as const;

export const fieldSchema = z.object({
  id: slugId,
  label: localizedSchema,
  type: z.enum(FIELD_TYPES).default("text"),
  required: z.boolean().default(true),
  /** `choice` uchun variantlar — inline tugmalar bo'lib chiqadi */
  options: z.array(localizedSchema).max(20).default([]),
  /** Javob Lead'ning qaysi ustuniga tushadi (null — faqat izohda qoladi) */
  mapTo: z.enum(LEAD_FIELDS).nullable().default(null),
});
export type BotFormField = z.infer<typeof fieldSchema>;

export const formSchema = z.object({
  id: slugId,
  name: z.string().min(1).max(80),
  /** Anketa boshida ko'rsatiladigan kirish matni */
  intro: localizedSchema,
  fields: z.array(fieldSchema).max(30).default([]),
  /** Yakuniy xabar — `{id}` lid kodiga almashtiriladi */
  successText: localizedSchema,
  /** Yaratilgan lid statusi */
  leadStatus: z.enum(["NEW", "CONTACTED", "QUALIFIED"]).default("NEW"),
  /** Lidga qo'shiladigan teglar (segmentlash uchun) */
  tags: z.array(z.string().max(30)).max(10).default([]),
  /** Admin Telegram'ga darhol xabar yuborilsinmi */
  notifyAdmin: z.boolean().default(true),
});
export type BotForm = z.infer<typeof formSchema>;

// ─── Sozlamalar ─────────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  /** Bosh ekran ID'si */
  startScreenId: slugId.default("main"),
  /** /start bosilganda ko'rsatiladigan salomlashuv (bo'sh — to'g'ridan bosh ekran) */
  welcome: localizedSchema.default({ uz: "", ru: "" }),
  defaultLang: z.enum(BOT_LANGS).default("uz"),
  /** Bot qaysi tillarda ishlaydi. Bitta til bo'lsa til tanlash so'ralmaydi. */
  languages: z.array(z.enum(BOT_LANGS)).min(1).max(2).default(["uz", "ru"]),
  askLanguageOnStart: z.boolean().default(false),
  /** Doimiy pastki klaviatura — Mini App do'kon tugmasi */
  showStoreButton: z.boolean().default(true),
  storeButtonLabel: localizedSchema.default({ uz: "🛍 Do'kon", ru: "🛍 Магазин" }),
  /** Tushunilmagan xabar bilan nima qilinadi */
  fallback: z.enum(["ai", "lead", "operator", "menu"]).default("lead"),
  /** Fallback "lead"/"operator" bo'lganda yuboriladigan tasdiq matni */
  fallbackText: localizedSchema.default({
    uz: "✅ Xabaringiz qabul qilindi. Operatorimiz tez orada bog'lanadi!",
    ru: "✅ Ваше сообщение принято. Оператор свяжется с вами в ближайшее время!",
  }),
  /** BotFather buyruqlar menyusi */
  commands: z
    .array(
      z.object({
        command: z.string().regex(/^[a-z0-9_]{1,32}$/),
        description: localizedSchema,
        /** Bosilganda ochiladigan ekran (bo'sh — bosh ekran) */
        screenId: slugId.nullable().default(null),
      }),
    )
    .max(10)
    .default([]),
});
export type BotSettings = z.infer<typeof settingsSchema>;

// ─── To'liq oqim ────────────────────────────────────────────────────────────

export const botFlowDefinitionSchema = z.object({
  version: z.literal(1).default(1),
  settings: settingsSchema.default({}),
  screens: z.array(screenSchema).max(60).default([]),
  forms: z.array(formSchema).max(30).default([]),
});
export type BotFlowDefinition = z.infer<typeof botFlowDefinitionSchema>;

// ─── Yordamchilar ───────────────────────────────────────────────────────────

/** Tilga mos matn. Bo'sh bo'lsa ikkinchi tilga tushadi. */
export function pick(text: Localized | undefined, lang: BotLang): string {
  if (!text) return "";
  const primary = text[lang]?.trim();
  if (primary) return primary;
  const other = lang === "uz" ? text.ru : text.uz;
  return other?.trim() ?? "";
}

/**
 * Oqimni tekshiradi — havolalar (screenId/formId) mavjudmi, ID'lar takrorlanmaganmi.
 * Admin UI va AI generator natijasini saqlashdan oldin ishlatiladi.
 */
export function validateFlowRefs(def: BotFlowDefinition): string[] {
  const errors: string[] = [];
  const screenIds = new Set<string>();
  const formIds = new Set<string>();

  for (const s of def.screens) {
    if (screenIds.has(s.id)) errors.push(`Ekran ID takrorlangan: "${s.id}"`);
    screenIds.add(s.id);
  }
  for (const f of def.forms) {
    if (formIds.has(f.id)) errors.push(`Anketa ID takrorlangan: "${f.id}"`);
    formIds.add(f.id);
  }

  if (!screenIds.has(def.settings.startScreenId)) {
    errors.push(`Bosh ekran topilmadi: "${def.settings.startScreenId}"`);
  }

  for (const s of def.screens) {
    for (const b of s.buttons) {
      if (b.action.type === "screen" && !screenIds.has(b.action.screenId)) {
        errors.push(`"${s.name}" ekranidagi "${pick(b.label, "uz")}" tugmasi mavjud bo'lmagan ekranga ishora qiladi: "${b.action.screenId}"`);
      }
      if (b.action.type === "form" && !formIds.has(b.action.formId)) {
        errors.push(`"${s.name}" ekranidagi "${pick(b.label, "uz")}" tugmasi mavjud bo'lmagan anketaga ishora qiladi: "${b.action.formId}"`);
      }
    }
  }

  for (const f of def.forms) {
    if (f.fields.length === 0) errors.push(`"${f.name}" anketasida savol yo'q`);
    const fieldIds = new Set<string>();
    for (const fld of f.fields) {
      if (fieldIds.has(fld.id)) errors.push(`"${f.name}" anketasida takroriy savol ID: "${fld.id}"`);
      fieldIds.add(fld.id);
      if (fld.type === "choice" && fld.options.length === 0) {
        errors.push(`"${f.name}" → "${pick(fld.label, "uz")}" variantli savol, lekin variantlar yo'q`);
      }
    }
  }

  for (const c of def.settings.commands) {
    if (c.screenId && !screenIds.has(c.screenId)) {
      errors.push(`/${c.command} buyrug'i mavjud bo'lmagan ekranga ishora qiladi: "${c.screenId}"`);
    }
  }

  return errors;
}

/** Erishib bo'lmaydigan ekranlar — admin UI ogohlantirishi uchun (xato emas). */
export function findOrphanScreens(def: BotFlowDefinition): string[] {
  const reachable = new Set<string>([def.settings.startScreenId]);
  for (const c of def.settings.commands) if (c.screenId) reachable.add(c.screenId);

  const byId = new Map(def.screens.map((s) => [s.id, s]));
  const queue = [...reachable];
  while (queue.length) {
    const cur = byId.get(queue.shift()!);
    if (!cur) continue;
    for (const b of cur.buttons) {
      if (b.action.type === "screen" && !reachable.has(b.action.screenId)) {
        reachable.add(b.action.screenId);
        queue.push(b.action.screenId);
      }
    }
  }
  return def.screens.filter((s) => !reachable.has(s.id)).map((s) => s.id);
}
