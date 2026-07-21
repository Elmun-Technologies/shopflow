import { Plus, Trash2, Sparkles } from "lucide-react";
import { useT } from "../i18n";

// ─────────────────────────────────────────────────────────────────────────────
// Product "boy kontent" (rich content) editor.
//
// Product.content — Public API v1 va single-product landing uchun ishlatiladigan
// ixtiyoriy marketing JSON. Shakli flat ({tagline,...}) yoki per-locale
// ({uz:{...}, ru:{...}}) bo'lishi mumkin (backend `localizeContent` ikkalasini ham
// tushunadi). Bu editor per-locale (UZ/RU) shaklida saqlaydi va yozadi.
//
// Mahalliylashtirilgan (per-locale) maydonlar: tagline, highlights, benefits,
// ingredients, howToUse, faq. Umumiy (til-neytral) maydonlar: servings, bespoke —
// faqat `uz` bazasida saqlanadi (backend merge orqali barcha tillarga tarqaladi).
//
// Noma'lum kalitlar (masalan, seed orqali qo'yilgan name/description/badges
// override'lari) `_extra` ichida saqlanib, yozishda qaytariladi — ma'lumot yo'qolmaydi.
// ─────────────────────────────────────────────────────────────────────────────

export type ContentLocale = "uz" | "ru";
const LOCALES: ContentLocale[] = ["uz", "ru"];

interface Benefit {
  icon: string;
  title: string;
  description: string;
}
interface Ingredient {
  name: string;
  amount: string;
  dailyValue: string;
}
interface Faq {
  question: string;
  answer: string;
}
interface LocaleContent {
  _extra: Record<string, unknown>;
  tagline: string;
  highlights: string[];
  benefits: Benefit[];
  ingredients: Ingredient[];
  howToUse: string;
  faq: Faq[];
}
export interface ProductContentState {
  loc: Record<ContentLocale, LocaleContent>;
  servings: string;
  bespoke: boolean;
}

// Editor tomonidan boshqariladigan (mahalliylashtirilgan) kalitlar — `_extra` dan chiqariladi.
const LOCALIZED_KEYS = new Set([
  "tagline",
  "highlights",
  "benefits",
  "ingredients",
  "howToUse",
  "faq",
]);
// Umumiy kalitlar — alohida boshqariladi, `_extra` ga tushmaydi.
const SHARED_KEYS = new Set(["servings", "bespoke"]);

// ── Coercion yordamchilari (kelgan JSON ishonchsiz) ───────────────────────────
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function asStr(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function emptyLocale(): LocaleContent {
  return {
    _extra: {},
    tagline: "",
    highlights: [],
    benefits: [],
    ingredients: [],
    howToUse: "",
    faq: [],
  };
}

function parseLocale(src: unknown): LocaleContent {
  const lc = emptyLocale();
  if (!isObj(src)) return lc;
  lc.tagline = asStr(src.tagline);
  lc.howToUse = asStr(src.howToUse);
  lc.highlights = asArr(src.highlights).map(asStr).filter(Boolean);
  lc.benefits = asArr(src.benefits)
    .filter(isObj)
    .map((b) => ({ icon: asStr(b.icon), title: asStr(b.title), description: asStr(b.description) }));
  lc.ingredients = asArr(src.ingredients)
    .filter(isObj)
    .map((g) => ({ name: asStr(g.name), amount: asStr(g.amount), dailyValue: asStr(g.dailyValue) }));
  lc.faq = asArr(src.faq)
    .filter(isObj)
    .map((f) => ({ question: asStr(f.question), answer: asStr(f.answer) }));
  // Noma'lum kalitlarni saqlab qolamiz (name/description/badges/... override'lari).
  for (const [k, v] of Object.entries(src)) {
    if (!LOCALIZED_KEYS.has(k) && !SHARED_KEYS.has(k)) lc._extra[k] = v;
  }
  return lc;
}

/** Product.content (flat yoki per-locale) → editor holati. */
export function parseProductContent(content: unknown): ProductContentState {
  const hasLocaleKeys =
    isObj(content) && LOCALES.some((l) => l in content && isObj((content as Record<string, unknown>)[l]));
  const uzSrc = hasLocaleKeys ? (content as Record<string, unknown>).uz : content;
  const ruSrc = hasLocaleKeys ? (content as Record<string, unknown>).ru : undefined;
  // Umumiy maydonlar uz bazasidan (yoki flat'dan) o'qiladi.
  const base = isObj(uzSrc) ? uzSrc : isObj(content) ? content : {};
  const servingsRaw = base.servings;
  return {
    loc: { uz: parseLocale(uzSrc), ru: parseLocale(ruSrc) },
    servings: typeof servingsRaw === "number" || typeof servingsRaw === "string" ? String(servingsRaw) : "",
    bespoke: base.bespoke === true,
  };
}

function cleanLocale(lc: LocaleContent): Record<string, unknown> {
  const o: Record<string, unknown> = { ...lc._extra };
  const tagline = lc.tagline.trim();
  if (tagline) o.tagline = tagline;
  else delete o.tagline;

  const howToUse = lc.howToUse.trim();
  if (howToUse) o.howToUse = howToUse;
  else delete o.howToUse;

  const highlights = lc.highlights.map((s) => s.trim()).filter(Boolean);
  if (highlights.length) o.highlights = highlights;
  else delete o.highlights;

  const benefits = lc.benefits
    .map((b) => {
      const icon = b.icon.trim();
      return { ...(icon ? { icon } : {}), title: b.title.trim(), description: b.description.trim() };
    })
    .filter((b) => b.title || b.description);
  if (benefits.length) o.benefits = benefits;
  else delete o.benefits;

  const ingredients = lc.ingredients
    .map((g) => {
      const dailyValue = g.dailyValue.trim();
      return { name: g.name.trim(), amount: g.amount.trim(), ...(dailyValue ? { dailyValue } : {}) };
    })
    .filter((g) => g.name);
  if (ingredients.length) o.ingredients = ingredients;
  else delete o.ingredients;

  const faq = lc.faq
    .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
    .filter((f) => f.question || f.answer);
  if (faq.length) o.faq = faq;
  else delete o.faq;

  return o;
}

/** Editor holati → Product.content (per-locale) yoki undefined (hammasi bo'sh bo'lsa). */
export function serializeProductContent(state: ProductContentState): Record<string, unknown> | undefined {
  const uz = cleanLocale(state.loc.uz);
  const ru = cleanLocale(state.loc.ru);
  // Umumiy maydonlarni uz bazasiga yozamiz (backend merge orqali ru'ga ham tarqaladi).
  const servings = parseInt(state.servings, 10);
  if (Number.isFinite(servings) && servings > 0) uz.servings = servings;
  else delete uz.servings;
  if (state.bespoke) uz.bespoke = true;
  else delete uz.bespoke;

  const out: Record<string, unknown> = {};
  if (Object.keys(uz).length) out.uz = uz;
  if (Object.keys(ru).length) out.ru = ru;
  return Object.keys(out).length ? out : undefined;
}

// ── UI qismlari ───────────────────────────────────────────────────────────────

function labelCls() {
  return "block text-xs font-medium text-slate-500 mb-1.5";
}

function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((val, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={val}
            onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
            placeholder={placeholder}
            className="input flex-1"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            aria-label={addLabel}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-700 hover:text-forest-900"
      >
        <Plus className="w-3.5 h-3.5" /> {addLabel}
      </button>
    </div>
  );
}

function CardListEditor<T>({
  items,
  onChange,
  makeEmpty,
  addLabel,
  renderRow,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  makeEmpty: () => T;
  addLabel: string;
  renderRow: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="relative rounded-xl border border-cream-300 bg-cream-50 p-3 pr-9">
          {renderRow(item, (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))))}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            aria-label={addLabel}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, makeEmpty()])}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-700 hover:text-forest-900"
      >
        <Plus className="w-3.5 h-3.5" /> {addLabel}
      </button>
    </div>
  );
}

export default function ProductContentEditor({
  value,
  onChange,
  activeLocale,
  onLocaleChange,
}: {
  value: ProductContentState;
  onChange: (next: ProductContentState) => void;
  activeLocale: ContentLocale;
  onLocaleChange: (l: ContentLocale) => void;
}) {
  const { t } = useT();
  const lc = value.loc[activeLocale];
  const patchLocale = (patch: Partial<LocaleContent>) =>
    onChange({ ...value, loc: { ...value.loc, [activeLocale]: { ...lc, ...patch } } });

  return (
    <div className="space-y-4">
      {/* Til tanlash (UZ/RU) — mahalliylashtirilgan maydonlar uchun */}
      <div className="inline-flex rounded-lg bg-cream-100 p-0.5 text-xs font-semibold">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onLocaleChange(l)}
            className={
              "px-3 py-1.5 rounded-md transition " +
              (activeLocale === l ? "bg-white text-forest-800 shadow-sm" : "text-slate-500 hover:text-forest-700")
            }
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div>
        <label className={labelCls()}>{t("productContent.tagline")}</label>
        <input
          type="text"
          maxLength={160}
          value={lc.tagline}
          onChange={(e) => patchLocale({ tagline: e.target.value })}
          placeholder={t("productContent.taglinePlaceholder")}
          className="input"
        />
      </div>

      <div>
        <label className={labelCls()}>{t("productContent.highlights")}</label>
        <StringListEditor
          items={lc.highlights}
          onChange={(highlights) => patchLocale({ highlights })}
          placeholder={t("productContent.highlightPlaceholder")}
          addLabel={t("productContent.addHighlight")}
        />
      </div>

      <div>
        <label className={labelCls()}>{t("productContent.benefits")}</label>
        <CardListEditor<Benefit>
          items={lc.benefits}
          onChange={(benefits) => patchLocale({ benefits })}
          makeEmpty={() => ({ icon: "", title: "", description: "" })}
          addLabel={t("productContent.addBenefit")}
          renderRow={(b, update) => (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={b.icon}
                  onChange={(e) => update({ icon: e.target.value })}
                  placeholder={t("productContent.iconPlaceholder")}
                  className="input w-16 text-center"
                  maxLength={4}
                />
                <input
                  type="text"
                  value={b.title}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder={t("productContent.benefitTitle")}
                  className="input flex-1"
                />
              </div>
              <input
                type="text"
                value={b.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder={t("productContent.benefitDesc")}
                className="input"
              />
            </div>
          )}
        />
      </div>

      <div>
        <label className={labelCls()}>{t("productContent.ingredients")}</label>
        <CardListEditor<Ingredient>
          items={lc.ingredients}
          onChange={(ingredients) => patchLocale({ ingredients })}
          makeEmpty={() => ({ name: "", amount: "", dailyValue: "" })}
          addLabel={t("productContent.addIngredient")}
          renderRow={(g, update) => (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={g.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder={t("productContent.ingredientName")}
                className="input"
              />
              <input
                type="text"
                value={g.amount}
                onChange={(e) => update({ amount: e.target.value })}
                placeholder={t("productContent.ingredientAmount")}
                className="input"
              />
              <input
                type="text"
                value={g.dailyValue}
                onChange={(e) => update({ dailyValue: e.target.value })}
                placeholder={t("productContent.ingredientDaily")}
                className="input"
              />
            </div>
          )}
        />
      </div>

      <div>
        <label className={labelCls()}>{t("productContent.howToUse")}</label>
        <textarea
          rows={3}
          maxLength={2000}
          value={lc.howToUse}
          onChange={(e) => patchLocale({ howToUse: e.target.value })}
          placeholder={t("productContent.howToUsePlaceholder")}
          className="input resize-none"
        />
      </div>

      <div>
        <label className={labelCls()}>{t("productContent.faq")}</label>
        <CardListEditor<Faq>
          items={lc.faq}
          onChange={(faq) => patchLocale({ faq })}
          makeEmpty={() => ({ question: "", answer: "" })}
          addLabel={t("productContent.addFaq")}
          renderRow={(f, update) => (
            <div className="space-y-2">
              <input
                type="text"
                value={f.question}
                onChange={(e) => update({ question: e.target.value })}
                placeholder={t("productContent.faqQuestion")}
                className="input"
              />
              <textarea
                rows={2}
                value={f.answer}
                onChange={(e) => update({ answer: e.target.value })}
                placeholder={t("productContent.faqAnswer")}
                className="input resize-none"
              />
            </div>
          )}
        />
      </div>

      {/* Umumiy (til-neytral) maydonlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-cream-300">
        <div>
          <label className={labelCls()}>{t("productContent.servings")}</label>
          <input
            type="text"
            inputMode="numeric"
            value={value.servings}
            onChange={(e) => onChange({ ...value, servings: e.target.value.replace(/[^\d]/g, "") })}
            placeholder={t("productContent.servingsPlaceholder")}
            className="input"
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.bespoke}
            onChange={(e) => onChange({ ...value, bespoke: e.target.checked })}
            className="w-4 h-4 rounded border-cream-300 text-leaf-500 focus:ring-leaf-400"
          />
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
            <Sparkles className="w-4 h-4 text-leaf-500" /> {t("productContent.bespoke")}
          </span>
        </label>
      </div>
    </div>
  );
}
