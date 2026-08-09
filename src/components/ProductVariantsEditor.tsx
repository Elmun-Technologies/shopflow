// Mahsulot variantlari muharriri — marketplace uslubidagi mahsulot kartasi.
//
// Ikki qism:
//   1. O'qlar (Hajm / Rang / …) — har birida qiymatlar ro'yxati
//   2. Variantlar — o'q qiymatlari kombinatsiyasi, har birida o'z artikuli,
//      narxi, zaxirasi, rasmlari va xarakteristikasi
//
// Narx/zaxira qoidasi backend `lib/variant-shape.ts` bilan bir xil: kartada
// eng arzon **sotib olinadigan** variant narxi ko'rinadi.

import { useMemo, useState } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronUp, X, Layers, ImagePlus,
  Loader2, AlertTriangle, Sparkles, GripVertical,
} from "lucide-react";
import { useT } from "../i18n";

// "50000" → "50,000" (ProductsPage bilan bir xil formatlash)
function formatGrouped(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

function unformatGrouped(formatted: string): string {
  return String(formatted).replace(/\D/g, "");
}

// ─── Tiplar (backend variant-shape.ts bilan bir xil) ────────────────────────

export interface LocalizedText { uz: string; ru: string }

export interface OptionValue { id: string; label: LocalizedText }
export interface ProductOption { id: string; name: LocalizedText; values: OptionValue[] }

export interface VariantAttribute { label: LocalizedText; value: LocalizedText }

export interface VariantDraft {
  id?: string;
  sku: string;
  name: string;
  optionValues: Record<string, string>;
  price: number;
  oldPrice: number | null;
  stock: number;
  active: boolean;
  images: string[];
  attributes: VariantAttribute[];
  sortOrder: number;
}

const MAX_OPTIONS = 3;
const MAX_VARIANT_IMAGES = 8;

// ─── Yordamchilar ───────────────────────────────────────────────────────────

function emptyLocalized(): LocalizedText { return { uz: "", ru: "" }; }

function pick(t: LocalizedText | undefined, lang: "uz" | "ru"): string {
  if (!t) return "";
  return t[lang]?.trim() || (lang === "uz" ? t.ru : t.uz)?.trim() || "";
}

/** Slug — o'q va qiymat ID'lari uchun (backend ^[a-z0-9_]{1,40}$ kutadi). */
function slugify(input: string, fallback: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "j", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya", "\u02bb": "", "\u2018": "", "\u2019": "",
  };
  const out = input
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");
  return out.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || fallback;
}

function uniqueId(base: string, taken: string[], fallback: string): string {
  const root = slugify(base, fallback);
  if (!taken.includes(root)) return root;
  for (let i = 2; i < 200; i++) {
    const candidate = `${root}_${i}`.slice(0, 40);
    if (!taken.includes(candidate)) return candidate;
  }
  return `${fallback}_${taken.length + 1}`;
}

/** Variant nomini o'q qiymatlaridan yig'adi: "1 kg / Qora". */
export function buildVariantLabel(
  options: ProductOption[],
  optionValues: Record<string, string>,
  lang: "uz" | "ru" = "uz",
): string {
  const parts: string[] = [];
  for (const opt of options) {
    const valueId = optionValues[opt.id];
    if (!valueId) continue;
    const value = opt.values.find((v) => v.id === valueId);
    if (value) parts.push(pick(value.label, lang) || valueId);
  }
  return parts.join(" / ");
}

/** Barcha o'q qiymatlari kombinatsiyasi (dekart ko'paytmasi). */
function combinations(options: ProductOption[]): Array<Record<string, string>> {
  if (options.length === 0) return [];
  let acc: Array<Record<string, string>> = [{}];
  for (const opt of options) {
    const next: Array<Record<string, string>> = [];
    for (const base of acc) {
      for (const value of opt.values) {
        next.push({ ...base, [opt.id]: value.id });
      }
    }
    acc = next;
  }
  return acc;
}

function comboKey(optionValues: Record<string, string>, options: ProductOption[]): string {
  return options.map((o) => `${o.id}=${optionValues[o.id] ?? ""}`).join("&");
}

// ─── Kichik UI ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-2.5 py-1.5 rounded-lg border border-cream-300 bg-white text-sm text-slate-700 " +
  "focus:outline-none focus:ring-2 focus:ring-leaf-300 focus:border-leaf-400";

function LangInput({
  value, onChange, lang, placeholder, className = "",
}: {
  value: LocalizedText;
  onChange: (v: LocalizedText) => void;
  lang: "uz" | "ru";
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      className={inputCls + " " + className}
      value={value[lang] ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
    />
  );
}

// ─── Asosiy komponent ───────────────────────────────────────────────────────

export default function ProductVariantsEditor({
  options, variants, currency, onOptionsChange, onVariantsChange, uploadImage,
}: {
  options: ProductOption[];
  variants: VariantDraft[];
  currency: string;
  onOptionsChange: (o: ProductOption[]) => void;
  onVariantsChange: (v: VariantDraft[]) => void;
  /** ProductsPage'dagi yuklovchi qayta ishlatiladi */
  uploadImage: (file: File) => Promise<string>;
}) {
  const { t } = useT();
  const [lang, setLang] = useState<"uz" | "ru">("uz");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // ─── 1 kg Narx kalkulyatori state'lari ─────────────────────────────────────
  const [kgBaseUsd, setKgBaseUsd] = useState<string>("20");
  const [usdExchangeRate, setUsdExchangeRate] = useState<string>("12800");
  const [markupUsd, setMarkupUsd] = useState<string>("0");
  const [markupPercent, setMarkupPercent] = useState<string>("0");

  // ─── Tekshiruv (backend validateVariants bilan bir xil qoidalar) ──────────
  const problems = useMemo(() => {
    const out: string[] = [];
    if (variants.length === 0) return out;
    if (options.length === 0) {
      out.push(t("variants.errNoAxis"));
      return out;
    }
    const seenSku = new Set<string>();
    const seenCombo = new Set<string>();
    for (const v of variants) {
      const sku = v.sku.trim().toLowerCase();
      if (!sku) out.push(t("variants.errNoSku", { name: v.name || "?" }));
      else if (seenSku.has(sku)) out.push(t("variants.errDupSku", { sku: v.sku }));
      else seenSku.add(sku);

      for (const opt of options) {
        if (!v.optionValues[opt.id]) {
          out.push(t("variants.errMissingValue", { name: v.name || v.sku, axis: pick(opt.name, lang) || opt.id }));
        }
      }
      const key = comboKey(v.optionValues, options);
      if (seenCombo.has(key)) out.push(t("variants.errDupCombo", { name: v.name || v.sku }));
      seenCombo.add(key);
    }
    return [...new Set(out)];
  }, [options, variants, lang, t]);

  // ─── Karta narxi (backend qoidasi bilan bir xil) ──────────────────────────
  const summary = useMemo(() => {
    const active = variants.filter((v) => v.active);
    if (active.length === 0) return null;
    const inStock = active.filter((v) => v.stock > 0);
    const pool = inStock.length ? inStock : active;
    const anchor = pool.reduce((min, v) => (v.price < min.price ? v : min), pool[0]);
    const prices = active.map((v) => v.price);
    return {
      from: anchor.price,
      max: Math.max(...prices),
      varies: Math.min(...prices) !== Math.max(...prices),
      stock: active.reduce((s, v) => s + Math.max(0, v.stock), 0),
      count: active.length,
      anchorName: anchor.name,
    };
  }, [variants]);

  // ─── O'q amallari ─────────────────────────────────────────────────────────

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    const id = uniqueId(`oq_${options.length + 1}`, options.map((o) => o.id), "oq");
    onOptionsChange([...options, { id, name: emptyLocalized(), values: [] }]);
  };

  const updateOption = (i: number, next: ProductOption) =>
    onOptionsChange(options.map((o, idx) => (idx === i ? next : o)));

  const removeOption = (i: number) => {
    const removed = options[i];
    onOptionsChange(options.filter((_, idx) => idx !== i));
    // Variantlardan o'sha o'q qiymatini olib tashlaymiz — aks holda "noma'lum
    // qiymat" xatosi qoladi
    onVariantsChange(
      variants.map((v) => {
        const { [removed.id]: _drop, ...rest } = v.optionValues;
        return { ...v, optionValues: rest };
      }),
    );
  };

  const addValue = (optIdx: number, label: string) => {
    const opt = options[optIdx];
    const trimmed = label.trim();
    if (!trimmed) return;
    const id = uniqueId(trimmed, opt.values.map((v) => v.id), `v${opt.values.length + 1}`);
    updateOption(optIdx, {
      ...opt,
      values: [...opt.values, { id, label: { uz: trimmed, ru: trimmed } }],
    });
  };

  const removeValue = (optIdx: number, valueId: string) => {
    const opt = options[optIdx];
    updateOption(optIdx, { ...opt, values: opt.values.filter((v) => v.id !== valueId) });
    // Shu qiymatga tayangan variantlarni ham olib tashlaymiz
    onVariantsChange(variants.filter((v) => v.optionValues[opt.id] !== valueId));
  };

  // ─── Variant amallari ─────────────────────────────────────────────────────

  /** Yetishmayotgan kombinatsiyalar uchun variant yaratadi (mavjudlariga tegmaydi). */
  const generateMissing = () => {
    const existing = new Set(variants.map((v) => comboKey(v.optionValues, options)));
    const combos = combinations(options).filter((c) => !existing.has(comboKey(c, options)));
    if (combos.length === 0) return;

    const baseSku = variants[0]?.sku.split("-")[0] ?? "VAR";
    const taken = new Set(variants.map((v) => v.sku.toLowerCase()));

    const created: VariantDraft[] = combos.map((optionValues, i) => {
      const label = buildVariantLabel(options, optionValues, lang);
      let sku = `${baseSku}-${slugify(label, String(i + 1)).toUpperCase()}`.slice(0, 60);
      if (taken.has(sku.toLowerCase())) sku = `${sku}-${variants.length + i + 1}`.slice(0, 60);
      taken.add(sku.toLowerCase());
      return {
        sku,
        name: label,
        optionValues,
        price: variants[0]?.price ?? 0,
        oldPrice: null,
        stock: 0,
        active: true,
        images: [],
        attributes: [],
        sortOrder: variants.length + i,
      };
    });
    onVariantsChange([...variants, ...created]);
  };

  const updateVariant = (i: number, next: VariantDraft) =>
    onVariantsChange(variants.map((v, idx) => (idx === i ? next : v)));

  const removeVariant = (i: number) =>
    onVariantsChange(variants.filter((_, idx) => idx !== i));

  const moveVariant = (i: number, dir: -1 | 1) => {
    const target = i + dir;
    if (target < 0 || target >= variants.length) return;
    const next = [...variants];
    [next[i], next[target]] = [next[target], next[i]];
    onVariantsChange(next.map((v, idx) => ({ ...v, sortOrder: idx })));
  };

  const addVariantImages = async (i: number, files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploadingFor(i);
    setUploadError(null);
    try {
      const room = MAX_VARIANT_IMAGES - variants[i].images.length;
      const urls: string[] = [];
      for (const file of arr.slice(0, room)) urls.push(await uploadImage(file));
      updateVariant(i, { ...variants[i], images: [...variants[i].images, ...urls].slice(0, MAX_VARIANT_IMAGES) });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : t("productForm.imageUploadError"));
    } finally {
      setUploadingFor(null);
    }
  };

  const totalCombos = combinations(options).length;
  const missingCount = totalCombos - variants.length;

  return (
    <div className="space-y-4">
      {/* Sarlavha + til */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-forest-700" />
          <h4 className="text-sm font-semibold text-forest-800">{t("variants.title")}</h4>
        </div>
        <div className="flex rounded-lg bg-cream-100 p-0.5">
          {(["uz", "ru"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                lang === l ? "bg-white text-forest-700 shadow-sm" : "text-slate-400"
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">{t("variants.intro")}</p>

      {/* ─── O'qlar ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            {t("variants.axes")}
          </span>
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-leaf-100 text-forest-700 text-[11px] font-medium hover:bg-leaf-200"
            >
              <Plus className="w-3 h-3" /> {t("variants.addAxis")}
            </button>
          )}
        </div>

        {options.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">{t("variants.noAxes")}</p>
        ) : (
          options.map((opt, i) => (
            <AxisRow
              key={opt.id}
              option={opt}
              lang={lang}
              onChange={(next) => updateOption(i, next)}
              onRemove={() => removeOption(i)}
              onAddValue={(label) => addValue(i, label)}
              onRemoveValue={(valueId) => removeValue(i, valueId)}
            />
          ))
        )}
      </div>

      {/* ─── Kg kalkulyator bar ────────────────────────────────────────── */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            1 kg bazaviy narxidan modifikatsiya hisoblash ($ / so'm)
          </span>
        </div>
        <p className="text-[11px] text-emerald-700">
          Masalan: 1 kg = 20$, USD kursi va USD/so'm ustamani kiriting. "Hisoblash" bosilganda variantlar hajmi (5kg, 10kg, 20kg...) bo'yicha narxlar avto tiklanadi.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-emerald-800 mb-0.5">1 kg narxi ($ USD)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Masalan: 20"
              value={kgBaseUsd}
              onChange={(e) => setKgBaseUsd(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-emerald-800 mb-0.5">USD kursi (so'm)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Masalan: 12800"
              value={usdExchangeRate}
              onChange={(e) => setUsdExchangeRate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-emerald-800 mb-0.5">Kg ga ustama ($)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Masalan: 2"
              value={markupUsd}
              onChange={(e) => setMarkupUsd(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-emerald-800 mb-0.5">Variantga ustama (%)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="Masalan: 0"
              value={markupPercent}
              onChange={(e) => setMarkupPercent(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const baseUsd = parseFloat(kgBaseUsd) || 0;
            const rate = parseFloat(usdExchangeRate) || 1;
            const mUsd = parseFloat(markupUsd) || 0;
            const mPct = parseFloat(markupPercent) || 0;

            if (baseUsd <= 0 && variants.length === 0) return;

            const updated = variants.map((v) => {
              // Variant nomidan yoki valuelardan kg miqdorini topamiz (e.g., "5 kg", "10kg", "500 gr")
              const nameLower = (v.name + " " + Object.values(v.optionValues).join(" ")).toLowerCase();
              let weightInKg = 1;
              const kgMatch = nameLower.match(/(\d+(?:[.,]\d+)?)\s*kg/);
              const grMatch = nameLower.match(/(\d+(?:[.,]\d+)?)\s*gr/);

              if (kgMatch) {
                weightInKg = parseFloat(kgMatch[1].replace(",", "."));
              } else if (grMatch) {
                weightInKg = parseFloat(grMatch[1].replace(",", ".")) / 1000;
              }

              if (baseUsd > 0) {
                // (1kg narxi + kg ustamasi) * og'irlik ($ da)
                let itemPriceUsd = (baseUsd + mUsd) * weightInKg;
                if (mPct > 0) {
                  itemPriceUsd += itemPriceUsd * (mPct / 100);
                }
                const calculatedPriceSum = Math.round(itemPriceUsd * rate);
                return { ...v, price: calculatedPriceSum };
              }
              return v;
            });

            onVariantsChange(updated);
          }}
          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
        >
          Modifikatsiya narxlarini avto-hisoblash
        </button>
      </div>

      {/* ─── Generatsiya ───────────────────────────────────────────────── */}
      {options.length > 0 && options.every((o) => o.values.length > 0) && missingCount > 0 && (
        <button
          type="button"
          onClick={generateMissing}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-leaf-400 bg-leaf-50/50 text-forest-700 text-xs font-medium hover:bg-leaf-100"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {t("variants.generate", { count: missingCount })}
        </button>
      )}

      {/* ─── Xulosa ────────────────────────────────────────────────────── */}
      {summary && (
        <div className="rounded-xl bg-cream-100/70 border border-cream-300 px-3 py-2.5">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {t("variants.summary", {
              count: summary.count,
              price: `${summary.varies ? t("variants.from") + " " : ""}${formatGrouped(String(summary.from))} ${currency}`,
              stock: summary.stock,
            })}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {t("variants.summaryDefault", { name: summary.anchorName || "—" })}
          </p>
        </div>
      )}

      {/* ─── Xatolar ───────────────────────────────────────────────────── */}
      {problems.length > 0 && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 space-y-1">
          <p className="text-[11px] font-medium text-rose-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {t("variants.problems", { count: problems.length })}
          </p>
          <ul className="text-[11px] text-rose-600 space-y-0.5 pl-4 list-disc">
            {problems.slice(0, 5).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {uploadError && <p className="text-[11px] text-rose-600">{uploadError}</p>}

      {/* ─── Variantlar ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          {t("variants.list")} · {variants.length}
        </span>

        {variants.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">{t("variants.noVariants")}</p>
        ) : (
          variants.map((v, i) => (
            <VariantRow
              key={v.id ?? `new-${i}`}
              variant={v}
              index={i}
              total={variants.length}
              options={options}
              lang={lang}
              currency={currency}
              open={expanded === (v.id ?? `new-${i}`)}
              uploading={uploadingFor === i}
              onToggle={() => setExpanded(expanded === (v.id ?? `new-${i}`) ? null : (v.id ?? `new-${i}`))}
              onChange={(next) => updateVariant(i, next)}
              onRemove={() => removeVariant(i)}
              onMove={(dir) => moveVariant(i, dir)}
              onAddImages={(files) => addVariantImages(i, files)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── O'q qatori ─────────────────────────────────────────────────────────────

function AxisRow({
  option, lang, onChange, onRemove, onAddValue, onRemoveValue,
}: {
  option: ProductOption;
  lang: "uz" | "ru";
  onChange: (o: ProductOption) => void;
  onRemove: () => void;
  onAddValue: (label: string) => void;
  onRemoveValue: (valueId: string) => void;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState("");

  const commit = () => {
    if (!draft.trim()) return;
    // Vergul bilan bir nechta qiymat: "50 gr, 1 kg, 5 kg"
    for (const part of draft.split(",")) onAddValue(part);
    setDraft("");
  };

  return (
    <div className="rounded-xl border border-cream-300 bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <LangInput
          value={option.name}
          onChange={(name) => onChange({ ...option, name })}
          lang={lang}
          placeholder={t("variants.axisPlaceholder")}
          className="flex-1"
        />
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-rose-500 shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {option.values.map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cream-100 text-slate-600 text-[11px]"
          >
            {pick(v.label, lang) || v.id}
            <button type="button" onClick={() => onRemoveValue(v.id)} className="text-slate-400 hover:text-rose-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className={inputCls + " flex-1"}
          value={draft}
          placeholder={t("variants.valuePlaceholder")}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <button
          type="button"
          onClick={commit}
          className="px-2.5 py-1.5 rounded-lg bg-leaf-100 text-forest-700 text-[11px] font-medium hover:bg-leaf-200 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Variant qatori ─────────────────────────────────────────────────────────

function VariantRow({
  variant, index, total, options, lang, currency, open, uploading,
  onToggle, onChange, onRemove, onMove, onAddImages,
}: {
  variant: VariantDraft;
  index: number;
  total: number;
  options: ProductOption[];
  lang: "uz" | "ru";
  currency: string;
  open: boolean;
  uploading: boolean;
  onToggle: () => void;
  onChange: (v: VariantDraft) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onAddImages: (files: FileList) => void;
}) {
  const { t } = useT();

  const setOptionValue = (optionId: string, valueId: string) => {
    const optionValues = { ...variant.optionValues, [optionId]: valueId };
    // Nom qo'lda o'zgartirilmagan bo'lsa avtomatik yangilanadi
    const autoName = buildVariantLabel(options, variant.optionValues, lang);
    const name = !variant.name || variant.name === autoName
      ? buildVariantLabel(options, optionValues, lang)
      : variant.name;
    onChange({ ...variant, optionValues, name });
  };

  return (
    <div className={`rounded-xl border bg-white overflow-hidden ${variant.active ? "border-cream-300" : "border-cream-300 opacity-60"}`}>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex flex-col text-slate-300">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="hover:text-forest-700 disabled:opacity-30">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="hover:text-forest-700 disabled:opacity-30">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {variant.images[0] ? (
          <img src={variant.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
        ) : (
          <span className="w-9 h-9 rounded-lg bg-cream-100 grid place-items-center shrink-0">
            <GripVertical className="w-3.5 h-3.5 text-cream-300" />
          </span>
        )}

        <button type="button" onClick={onToggle} className="flex-1 text-left min-w-0">
          <p className="text-sm text-forest-800 truncate">{variant.name || t("variants.unnamed")}</p>
          <p className="text-[11px] text-slate-400 truncate">
            {formatGrouped(String(variant.price))} {currency} · {t("variants.stockShort", { n: variant.stock })}
            {variant.sku && ` · ${variant.sku}`}
          </p>
        </button>

        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-rose-500 shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="p-3 space-y-3 bg-cream-50/60 border-t border-cream-200">
          {/* O'q qiymatlari */}
          {options.map((opt) => (
            <div key={opt.id}>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                {pick(opt.name, lang) || opt.id}
              </label>
              <select
                className={inputCls}
                value={variant.optionValues[opt.id] ?? ""}
                onChange={(e) => setOptionValue(opt.id, e.target.value)}
              >
                <option value="">{t("variants.selectValue")}</option>
                {opt.values.map((v) => (
                  <option key={v.id} value={v.id}>{pick(v.label, lang) || v.id}</option>
                ))}
              </select>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">{t("variants.sku")}</label>
              <input className={inputCls} value={variant.sku} onChange={(e) => onChange({ ...variant, sku: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">{t("variants.name")}</label>
              <input className={inputCls} value={variant.name} onChange={(e) => onChange({ ...variant, name: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">{t("variants.price")}</label>
              <input
                className={inputCls}
                inputMode="numeric"
                value={formatGrouped(String(variant.price))}
                onChange={(e) => onChange({ ...variant, price: Number(unformatGrouped(e.target.value)) || 0 })}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">{t("variants.oldPrice")}</label>
              <input
                className={inputCls}
                inputMode="numeric"
                value={variant.oldPrice ? formatGrouped(String(variant.oldPrice)) : ""}
                onChange={(e) => {
                  const raw = unformatGrouped(e.target.value);
                  onChange({ ...variant, oldPrice: raw ? Number(raw) : null });
                }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">{t("variants.stock")}</label>
              <input
                className={inputCls}
                inputMode="numeric"
                value={formatGrouped(String(variant.stock))}
                onChange={(e) => onChange({ ...variant, stock: Number(unformatGrouped(e.target.value)) || 0 })}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...variant, active: !variant.active })}
            className="flex items-center gap-2 text-xs text-slate-700"
          >
            <span className={`relative w-9 h-5 rounded-full transition-colors ${variant.active ? "bg-leaf-400" : "bg-cream-300"}`}>
              <span
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: variant.active ? 18 : 2 }}
              />
            </span>
            {t("variants.activeLabel")}
          </button>

          {/* Rasmlar */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              {t("variants.images")} <span className="text-slate-400">({t("variants.imagesHint")})</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {variant.images.map((url, idx) => (
                <div key={url} className="relative w-14 h-14 rounded-lg overflow-hidden border border-cream-300 group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onChange({ ...variant, images: variant.images.filter((_, k) => k !== idx) })}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded bg-black/60 text-white grid place-items-center opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
              {variant.images.length < MAX_VARIANT_IMAGES && (
                <label className="w-14 h-14 rounded-lg border border-dashed border-cream-300 grid place-items-center cursor-pointer hover:border-leaf-400">
                  {uploading ? (
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4 text-slate-400" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) onAddImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Xarakteristika */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-medium text-slate-500">{t("variants.attributes")}</label>
              <button
                type="button"
                onClick={() => onChange({ ...variant, attributes: [...variant.attributes, { label: emptyLocalized(), value: emptyLocalized() }] })}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-leaf-100 text-forest-700 text-[11px] font-medium hover:bg-leaf-200"
              >
                <Plus className="w-3 h-3" /> {t("common.add")}
              </button>
            </div>
            {variant.attributes.map((attr, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <LangInput
                  value={attr.label}
                  onChange={(label) => onChange({ ...variant, attributes: variant.attributes.map((a, k) => (k === idx ? { ...a, label } : a)) })}
                  lang={lang}
                  placeholder={t("variants.attrLabel")}
                  className="flex-1"
                />
                <LangInput
                  value={attr.value}
                  onChange={(value) => onChange({ ...variant, attributes: variant.attributes.map((a, k) => (k === idx ? { ...a, value } : a)) })}
                  lang={lang}
                  placeholder={t("variants.attrValue")}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...variant, attributes: variant.attributes.filter((_, k) => k !== idx) })}
                  className="text-slate-300 hover:text-rose-500 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
