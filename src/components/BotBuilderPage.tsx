// Bot konstruktori — Telegram bot suhbat oqimini vizual qurish.
//
// Uch ustun: chapda ekran/anketa ro'yxati, o'rtada tanlangan elementning
// tahrirlagichi, o'ngda jonli Telegram preview (tugmalar bosiladi — oqim
// haqiqiy botdagidek yuriladi).
//
// Oqim `BotFlow.definition` JSON'i sifatida saqlanadi; kontrakt backend'dagi
// `bot-flow-schema.ts` bilan bir xil.

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Plus, Trash2, Save, Sparkles, LayoutTemplate, ChevronRight, ChevronUp,
  ChevronDown, X, Settings2, MessageSquare, ClipboardList, AlertTriangle,
  CheckCircle2, Loader2, Home, ArrowLeft, Link2, Store, Package, Headphones,
  Globe, FileText, Eye, Power, RotateCcw,
} from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";
import { useT } from "../i18n";
import { PageSkeleton } from "./ui/Skeleton";

// ─── Tiplar (backend bot-flow-schema.ts bilan bir xil) ──────────────────────

type BotLang = "uz" | "ru";
interface Localized { uz: string; ru: string }

type ButtonAction =
  | { type: "screen"; screenId: string }
  | { type: "form"; formId: string }
  | { type: "text"; text: Localized }
  | { type: "webapp" }
  | { type: "url"; url: string }
  | { type: "catalog"; categoryId: string | null }
  | { type: "track_order" }
  | { type: "operator" }
  | { type: "language" }
  | { type: "back" }
  | { type: "home" };

type ActionType = ButtonAction["type"];

interface BotButton { id: string; label: Localized; action: ButtonAction; fullWidth: boolean }
interface BotScreen { id: string; name: string; text: Localized; imageUrl: string | null; buttons: BotButton[]; showBack: boolean }

type FieldType = "text" | "phone" | "email" | "number" | "choice" | "contact";
type LeadField = "name" | "phone" | "email" | "company" | "position" | "location";

interface BotFormField {
  id: string; label: Localized; type: FieldType; required: boolean;
  options: Localized[]; mapTo: LeadField | null;
}
interface BotForm {
  id: string; name: string; intro: Localized; fields: BotFormField[];
  successText: Localized; leadStatus: "NEW" | "CONTACTED" | "QUALIFIED";
  tags: string[]; notifyAdmin: boolean;
}

interface BotSettings {
  startScreenId: string;
  welcome: Localized;
  defaultLang: BotLang;
  languages: BotLang[];
  askLanguageOnStart: boolean;
  showStoreButton: boolean;
  storeButtonLabel: Localized;
  fallback: "ai" | "lead" | "operator" | "menu";
  fallbackText: Localized;
  commands: Array<{ command: string; description: Localized; screenId: string | null }>;
}

interface BotFlowDefinition {
  version: 1;
  settings: BotSettings;
  screens: BotScreen[];
  forms: BotForm[];
}

interface FlowResponse {
  enabled: boolean;
  template: string | null;
  lastBrief: string | null;
  updatedAt: string | null;
  definition: BotFlowDefinition;
  corrupted: boolean;
  errors: string[];
  orphanScreens: string[];
  bot: { connected: boolean; username: string | null; channelId: string | null };
  productCount: number;
  aiAvailable: boolean;
}

interface TemplateMeta {
  id: "retail" | "b2b" | "blank";
  name: Localized;
  description: Localized;
  screens: number;
  forms: number;
}

// ─── Yordamchilar ───────────────────────────────────────────────────────────

const ACTION_TYPES: ActionType[] = [
  "screen", "form", "text", "webapp", "url", "catalog", "track_order", "operator", "language", "back", "home",
];

const ACTION_ICON: Record<ActionType, React.ElementType> = {
  screen: ChevronRight, form: ClipboardList, text: FileText, webapp: Store, url: Link2,
  catalog: Package, track_order: Package, operator: Headphones, language: Globe,
  back: ArrowLeft, home: Home,
};

const FIELD_TYPES: FieldType[] = ["text", "phone", "email", "number", "choice", "contact"];
const LEAD_FIELDS: LeadField[] = ["name", "phone", "email", "company", "position", "location"];

/** Slug — ID maydonlari uchun (backend ^[a-z0-9_]{1,24}$ talab qiladi). */
function slugify(input: string, fallback = "item"): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "j", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya", ʻ: "", "'": "", "‘": "", "’": "",
  };
  const out = input
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return out || fallback;
}

/** Ro'yxatda takrorlanmaydigan ID yasaydi. */
function uniqueId(base: string, taken: string[]): string {
  const root = slugify(base).slice(0, 20) || "item";
  if (!taken.includes(root)) return root;
  for (let i = 2; i < 100; i++) {
    const candidate = `${root}_${i}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${root}_${Date.now() % 1000}`;
}

function emptyLocalized(): Localized { return { uz: "", ru: "" }; }

function pickText(text: Localized | undefined, lang: BotLang): string {
  if (!text) return "";
  return text[lang]?.trim() || (lang === "uz" ? text.ru : text.uz)?.trim() || "";
}

/** Telegram HTML → preview uchun oddiy render. */
function renderTgHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|i|u|s|code|pre)&gt;/g, "<$1$2>")
    .replace(/\n/g, "<br/>");
}

// ─── Kichik UI bo'laklari ───────────────────────────────────────────────────

function LocalizedInput({
  value, onChange, lang, otherLang, placeholder, multiline, rows = 3,
}: {
  value: Localized;
  onChange: (v: Localized) => void;
  lang: BotLang;
  otherLang: BotLang;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const { t } = useT();
  const missing = !value[otherLang]?.trim() && Boolean(value[lang]?.trim());
  const cls =
    "w-full px-3 py-2 rounded-xl border border-cream-300 bg-white text-sm text-slate-700 " +
    "focus:outline-none focus:ring-2 focus:ring-leaf-300 focus:border-leaf-400 placeholder:text-slate-400";

  return (
    <div>
      {multiline ? (
        <textarea
          className={cls + " resize-y"}
          rows={rows}
          value={value[lang] ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
        />
      ) : (
        <input
          className={cls}
          value={value[lang] ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
        />
      )}
      {missing && (
        <p className="mt-1 text-[11px] text-amber-600">
          {t("botflow.missingTranslation", { lang: otherLang.toUpperCase() })}
        </p>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-xl border border-cream-300 bg-white text-sm text-slate-700 " +
  "focus:outline-none focus:ring-2 focus:ring-leaf-300 focus:border-leaf-400";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm text-slate-700"
    >
      <span
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-leaf-400" : "bg-cream-300"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-4.5" : "left-0.5"}`}
          style={{ left: checked ? 18 : 2 }}
        />
      </span>
      {label}
    </button>
  );
}

// ─── Tugma tahrirlagichi ────────────────────────────────────────────────────

function ButtonRow({
  button, index, total, screens, forms, lang, otherLang,
  onChange, onDelete, onMove,
}: {
  button: BotButton;
  index: number;
  total: number;
  screens: BotScreen[];
  forms: BotForm[];
  lang: BotLang;
  otherLang: BotLang;
  onChange: (b: BotButton) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const Icon = ACTION_ICON[button.action.type] ?? ChevronRight;

  const setAction = (type: ActionType) => {
    let action: ButtonAction;
    switch (type) {
      case "screen": action = { type, screenId: screens[0]?.id ?? "main" }; break;
      case "form": action = { type, formId: forms[0]?.id ?? "" }; break;
      case "text": action = { type, text: emptyLocalized() }; break;
      case "url": action = { type, url: "https://" }; break;
      case "catalog": action = { type, categoryId: null }; break;
      default: action = { type } as ButtonAction;
    }
    onChange({ ...button, action });
  };

  return (
    <div className="rounded-xl border border-cream-300 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex flex-col">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="text-slate-300 hover:text-forest-700 disabled:opacity-30"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            className="text-slate-300 hover:text-forest-700 disabled:opacity-30"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="w-7 h-7 rounded-lg bg-leaf-100 text-forest-700 grid place-items-center shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </span>

        <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 text-left min-w-0">
          <p className="text-sm text-forest-800 truncate">
            {pickText(button.label, lang) || <span className="text-slate-400">{t("botflow.noLabel")}</span>}
          </p>
          <p className="text-[11px] text-slate-400 truncate">{t(`botflow.action.${button.action.type}`)}</p>
        </button>

        <button type="button" onClick={onDelete} className="text-slate-300 hover:text-rose-500 shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-cream-200"
          >
            <div className="p-3 space-y-3 bg-cream-50/60">
              <Field label={t("botflow.buttonLabel")}>
                <LocalizedInput value={button.label} onChange={(label) => onChange({ ...button, label })} lang={lang} otherLang={otherLang} />
              </Field>

              <Field label={t("botflow.buttonAction")}>
                <select className={inputCls} value={button.action.type} onChange={(e) => setAction(e.target.value as ActionType)}>
                  {ACTION_TYPES.map((a) => (
                    <option key={a} value={a}>{t(`botflow.action.${a}`)}</option>
                  ))}
                </select>
              </Field>

              {button.action.type === "screen" && (
                <Field label={t("botflow.targetScreen")}>
                  <select
                    className={inputCls}
                    value={button.action.screenId}
                    onChange={(e) => onChange({ ...button, action: { type: "screen", screenId: e.target.value } })}
                  >
                    {screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              )}

              {button.action.type === "form" && (
                <Field label={t("botflow.targetForm")}>
                  {forms.length === 0 ? (
                    <p className="text-xs text-amber-600">{t("botflow.noFormsYet")}</p>
                  ) : (
                    <select
                      className={inputCls}
                      value={button.action.formId}
                      onChange={(e) => onChange({ ...button, action: { type: "form", formId: e.target.value } })}
                    >
                      {forms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  )}
                </Field>
              )}

              {button.action.type === "text" && (
                <Field label={t("botflow.staticText")} hint={t("botflow.htmlHint")}>
                  <LocalizedInput
                    multiline
                    rows={5}
                    value={button.action.text}
                    onChange={(text) => onChange({ ...button, action: { type: "text", text } })}
                    lang={lang}
                    otherLang={otherLang}
                  />
                </Field>
              )}

              {button.action.type === "url" && (
                <Field label={t("botflow.url")}>
                  <input
                    className={inputCls}
                    value={button.action.url}
                    onChange={(e) => onChange({ ...button, action: { type: "url", url: e.target.value } })}
                  />
                </Field>
              )}

              <Toggle
                checked={!button.fullWidth}
                onChange={(v) => onChange({ ...button, fullWidth: !v })}
                label={t("botflow.halfWidth")}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Ekran tahrirlagichi ────────────────────────────────────────────────────

function ScreenEditor({
  screen, screens, forms, lang, otherLang, isStart, onChange, onDelete, onSetStart,
}: {
  screen: BotScreen;
  screens: BotScreen[];
  forms: BotForm[];
  lang: BotLang;
  otherLang: BotLang;
  isStart: boolean;
  onChange: (s: BotScreen) => void;
  onDelete: () => void;
  onSetStart: () => void;
}) {
  const { t } = useT();

  const addButton = () => {
    const id = uniqueId("btn", screen.buttons.map((b) => b.id));
    onChange({
      ...screen,
      buttons: [
        ...screen.buttons,
        { id, label: emptyLocalized(), action: { type: "screen", screenId: screens[0]?.id ?? "main" }, fullWidth: true },
      ],
    });
  };

  const updateButton = (i: number, b: BotButton) =>
    onChange({ ...screen, buttons: screen.buttons.map((x, idx) => (idx === i ? b : x)) });

  const moveButton = (i: number, dir: -1 | 1) => {
    const next = [...screen.buttons];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    onChange({ ...screen, buttons: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-forest-800 truncate">{screen.name}</h3>
          <code className="text-[11px] text-slate-400">{screen.id}</code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isStart ? (
            <span className="px-2 py-1 rounded-full bg-leaf-100 text-forest-700 text-[11px] font-medium">
              {t("botflow.startScreen")}
            </span>
          ) : (
            <>
              <button type="button" onClick={onSetStart} className="px-2.5 py-1 rounded-lg text-[11px] text-slate-500 hover:bg-cream-100">
                {t("botflow.makeStart")}
              </button>
              <button type="button" onClick={onDelete} className="text-slate-300 hover:text-rose-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <Field label={t("botflow.screenName")} hint={t("botflow.screenNameHint")}>
        <input className={inputCls} value={screen.name} onChange={(e) => onChange({ ...screen, name: e.target.value })} />
      </Field>

      <Field label={t("botflow.screenText")} hint={t("botflow.htmlHint")}>
        <LocalizedInput multiline rows={6} value={screen.text} onChange={(text) => onChange({ ...screen, text })} lang={lang} otherLang={otherLang} />
      </Field>

      <Field label={t("botflow.imageUrl")} hint={t("botflow.imageUrlHint")}>
        <input
          className={inputCls}
          value={screen.imageUrl ?? ""}
          placeholder="https://…"
          onChange={(e) => onChange({ ...screen, imageUrl: e.target.value.trim() || null })}
        />
      </Field>

      {!isStart && (
        <Toggle checked={screen.showBack} onChange={(v) => onChange({ ...screen, showBack: v })} label={t("botflow.showBack")} />
      )}

      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {t("botflow.buttons")} · {screen.buttons.length}
          </h4>
          <button
            type="button"
            onClick={addButton}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-leaf-100 text-forest-700 text-xs font-medium hover:bg-leaf-200"
          >
            <Plus className="w-3.5 h-3.5" /> {t("common.add")}
          </button>
        </div>

        {screen.buttons.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">{t("botflow.noButtons")}</p>
        ) : (
          <div className="space-y-2">
            {screen.buttons.map((b, i) => (
              <ButtonRow
                key={b.id}
                button={b}
                index={i}
                total={screen.buttons.length}
                screens={screens}
                forms={forms}
                lang={lang}
                otherLang={otherLang}
                onChange={(nb) => updateButton(i, nb)}
                onDelete={() => onChange({ ...screen, buttons: screen.buttons.filter((_, idx) => idx !== i) })}
                onMove={(dir) => moveButton(i, dir)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Anketa tahrirlagichi ───────────────────────────────────────────────────

function FieldRow({
  field, index, total, lang, otherLang, onChange, onDelete, onMove,
}: {
  field: BotFormField;
  index: number;
  total: number;
  lang: BotLang;
  otherLang: BotLang;
  onChange: (f: BotFormField) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-cream-300 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex flex-col">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="text-slate-300 hover:text-forest-700 disabled:opacity-30">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="text-slate-300 hover:text-forest-700 disabled:opacity-30">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="w-6 h-6 rounded-lg bg-cream-100 text-slate-500 grid place-items-center text-[11px] font-semibold shrink-0">
          {index + 1}
        </span>

        <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 text-left min-w-0">
          <p className="text-sm text-forest-800 truncate">
            {pickText(field.label, lang) || <span className="text-slate-400">{t("botflow.noQuestion")}</span>}
          </p>
          <p className="text-[11px] text-slate-400">
            {t(`botflow.field.${field.type}`)}
            {!field.required && ` · ${t("common.optional")}`}
            {field.mapTo && ` · ${t(`botflow.lead.${field.mapTo}`)}`}
          </p>
        </button>

        <button type="button" onClick={onDelete} className="text-slate-300 hover:text-rose-500 shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-cream-200"
          >
            <div className="p-3 space-y-3 bg-cream-50/60">
              <Field label={t("botflow.question")}>
                <LocalizedInput multiline rows={3} value={field.label} onChange={(label) => onChange({ ...field, label })} lang={lang} otherLang={otherLang} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t("botflow.fieldType")}>
                  <select
                    className={inputCls}
                    value={field.type}
                    onChange={(e) => {
                      const type = e.target.value as FieldType;
                      onChange({ ...field, type, options: type === "choice" ? field.options : [] });
                    }}
                  >
                    {FIELD_TYPES.map((f) => <option key={f} value={f}>{t(`botflow.field.${f}`)}</option>)}
                  </select>
                </Field>

                <Field label={t("botflow.mapTo")} hint={t("botflow.mapToHint")}>
                  <select
                    className={inputCls}
                    value={field.mapTo ?? ""}
                    onChange={(e) => onChange({ ...field, mapTo: (e.target.value || null) as LeadField | null })}
                  >
                    <option value="">{t("botflow.mapToNone")}</option>
                    {LEAD_FIELDS.map((f) => <option key={f} value={f}>{t(`botflow.lead.${f}`)}</option>)}
                  </select>
                </Field>
              </div>

              <Toggle checked={field.required} onChange={(v) => onChange({ ...field, required: v })} label={t("botflow.required")} />

              {field.type === "choice" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-500">{t("botflow.options")}</label>
                    <button
                      type="button"
                      onClick={() => onChange({ ...field, options: [...field.options, emptyLocalized()] })}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-leaf-100 text-forest-700 text-[11px] font-medium hover:bg-leaf-200"
                    >
                      <Plus className="w-3 h-3" /> {t("common.add")}
                    </button>
                  </div>
                  {field.options.length === 0 && (
                    <p className="text-[11px] text-amber-600">{t("botflow.optionsRequired")}</p>
                  )}
                  {field.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1">
                        <LocalizedInput
                          value={opt}
                          onChange={(v) => onChange({ ...field, options: field.options.map((o, idx) => (idx === i ? v : o)) })}
                          lang={lang}
                          otherLang={otherLang}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => onChange({ ...field, options: field.options.filter((_, idx) => idx !== i) })}
                        className="text-slate-300 hover:text-rose-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FormEditor({
  form, lang, otherLang, onChange, onDelete,
}: {
  form: BotForm;
  lang: BotLang;
  otherLang: BotLang;
  onChange: (f: BotForm) => void;
  onDelete: () => void;
}) {
  const { t } = useT();

  const addField = () => {
    const id = uniqueId("q", form.fields.map((f) => f.id));
    onChange({
      ...form,
      fields: [...form.fields, { id, label: emptyLocalized(), type: "text", required: true, options: [], mapTo: null }],
    });
  };

  const moveField = (i: number, dir: -1 | 1) => {
    const next = [...form.fields];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    onChange({ ...form, fields: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-forest-800 truncate">{form.name}</h3>
          <code className="text-[11px] text-slate-400">{form.id}</code>
        </div>
        <button type="button" onClick={onDelete} className="text-slate-300 hover:text-rose-500 shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <Field label={t("botflow.formName")} hint={t("botflow.screenNameHint")}>
        <input className={inputCls} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
      </Field>

      <Field label={t("botflow.formIntro")}>
        <LocalizedInput multiline rows={3} value={form.intro} onChange={(intro) => onChange({ ...form, intro })} lang={lang} otherLang={otherLang} />
      </Field>

      <Field label={t("botflow.successText")} hint={t("botflow.successHint")}>
        <LocalizedInput multiline rows={4} value={form.successText} onChange={(successText) => onChange({ ...form, successText })} lang={lang} otherLang={otherLang} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("botflow.leadStatus")}>
          <select
            className={inputCls}
            value={form.leadStatus}
            onChange={(e) => onChange({ ...form, leadStatus: e.target.value as BotForm["leadStatus"] })}
          >
            <option value="NEW">{t("leads.status.NEW")}</option>
            <option value="CONTACTED">{t("leads.status.CONTACTED")}</option>
            <option value="QUALIFIED">{t("leads.status.QUALIFIED")}</option>
          </select>
        </Field>

        <Field label={t("botflow.tags")} hint={t("botflow.tagsHint")}>
          <input
            className={inputCls}
            value={form.tags.join(", ")}
            onChange={(e) => onChange({ ...form, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10) })}
          />
        </Field>
      </div>

      <Toggle checked={form.notifyAdmin} onChange={(v) => onChange({ ...form, notifyAdmin: v })} label={t("botflow.notifyAdmin")} />

      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {t("botflow.questions")} · {form.fields.length}
          </h4>
          <button
            type="button"
            onClick={addField}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-leaf-100 text-forest-700 text-xs font-medium hover:bg-leaf-200"
          >
            <Plus className="w-3.5 h-3.5" /> {t("common.add")}
          </button>
        </div>

        {form.fields.length === 0 ? (
          <p className="text-xs text-amber-600 py-4 text-center">{t("botflow.noQuestions")}</p>
        ) : (
          <div className="space-y-2">
            {form.fields.map((f, i) => (
              <FieldRow
                key={f.id}
                field={f}
                index={i}
                total={form.fields.length}
                lang={lang}
                otherLang={otherLang}
                onChange={(nf) => onChange({ ...form, fields: form.fields.map((x, idx) => (idx === i ? nf : x)) })}
                onDelete={() => onChange({ ...form, fields: form.fields.filter((_, idx) => idx !== i) })}
                onMove={(dir) => moveField(i, dir)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sozlamalar ─────────────────────────────────────────────────────────────

function SettingsEditor({
  settings, screens, lang, otherLang, onChange,
}: {
  settings: BotSettings;
  screens: BotScreen[];
  lang: BotLang;
  otherLang: BotLang;
  onChange: (s: BotSettings) => void;
}) {
  const { t } = useT();

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-forest-800">{t("botflow.settings")}</h3>

      <Field label={t("botflow.welcome")} hint={t("botflow.welcomeHint")}>
        <LocalizedInput multiline rows={6} value={settings.welcome} onChange={(welcome) => onChange({ ...settings, welcome })} lang={lang} otherLang={otherLang} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("botflow.startScreen")}>
          <select
            className={inputCls}
            value={settings.startScreenId}
            onChange={(e) => onChange({ ...settings, startScreenId: e.target.value })}
          >
            {screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <Field label={t("botflow.defaultLang")}>
          <select
            className={inputCls}
            value={settings.defaultLang}
            onChange={(e) => onChange({ ...settings, defaultLang: e.target.value as BotLang })}
          >
            <option value="uz">O'zbekcha</option>
            <option value="ru">Русский</option>
          </select>
        </Field>
      </div>

      <Field label={t("botflow.languages")} hint={t("botflow.languagesHint")}>
        <div className="flex gap-2">
          {(["uz", "ru"] as BotLang[]).map((l) => {
            const on = settings.languages.includes(l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => {
                  const next = on ? settings.languages.filter((x) => x !== l) : [...settings.languages, l];
                  if (next.length === 0) return;
                  onChange({
                    ...settings,
                    languages: next,
                    defaultLang: next.includes(settings.defaultLang) ? settings.defaultLang : next[0],
                  });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  on ? "bg-leaf-100 text-forest-700" : "bg-cream-100 text-slate-400"
                }`}
              >
                {l === "uz" ? "🇺🇿 O'zbekcha" : "🇷🇺 Русский"}
              </button>
            );
          })}
        </div>
      </Field>

      {settings.languages.length > 1 && (
        <Toggle
          checked={settings.askLanguageOnStart}
          onChange={(v) => onChange({ ...settings, askLanguageOnStart: v })}
          label={t("botflow.askLanguage")}
        />
      )}

      <Toggle
        checked={settings.showStoreButton}
        onChange={(v) => onChange({ ...settings, showStoreButton: v })}
        label={t("botflow.showStoreButton")}
      />

      {settings.showStoreButton && (
        <Field label={t("botflow.storeButtonLabel")}>
          <LocalizedInput
            value={settings.storeButtonLabel}
            onChange={(storeButtonLabel) => onChange({ ...settings, storeButtonLabel })}
            lang={lang}
            otherLang={otherLang}
          />
        </Field>
      )}

      <Field label={t("botflow.fallback")} hint={t("botflow.fallbackHint")}>
        <select
          className={inputCls}
          value={settings.fallback}
          onChange={(e) => onChange({ ...settings, fallback: e.target.value as BotSettings["fallback"] })}
        >
          <option value="lead">{t("botflow.fallback.lead")}</option>
          <option value="operator">{t("botflow.fallback.operator")}</option>
          <option value="ai">{t("botflow.fallback.ai")}</option>
          <option value="menu">{t("botflow.fallback.menu")}</option>
        </select>
      </Field>

      {(settings.fallback === "lead" || settings.fallback === "ai") && (
        <Field label={t("botflow.fallbackText")}>
          <LocalizedInput
            multiline
            rows={3}
            value={settings.fallbackText}
            onChange={(fallbackText) => onChange({ ...settings, fallbackText })}
            lang={lang}
            otherLang={otherLang}
          />
        </Field>
      )}

      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t("botflow.commands")}</h4>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...settings,
                commands: [...settings.commands, { command: "menu", description: emptyLocalized(), screenId: null }],
              })
            }
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-leaf-100 text-forest-700 text-xs font-medium hover:bg-leaf-200"
          >
            <Plus className="w-3.5 h-3.5" /> {t("common.add")}
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mb-2">{t("botflow.commandsHint")}</p>

        <div className="space-y-2">
          {settings.commands.map((c, i) => (
            <div key={i} className="rounded-xl border border-cream-300 bg-white p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">/</span>
                <input
                  className={inputCls}
                  value={c.command}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      commands: settings.commands.map((x, idx) =>
                        idx === i ? { ...x, command: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 32) } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...settings, commands: settings.commands.filter((_, idx) => idx !== i) })}
                  className="text-slate-300 hover:text-rose-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <LocalizedInput
                value={c.description}
                onChange={(description) =>
                  onChange({ ...settings, commands: settings.commands.map((x, idx) => (idx === i ? { ...x, description } : x)) })
                }
                lang={lang}
                otherLang={otherLang}
              />
              <select
                className={inputCls}
                value={c.screenId ?? ""}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    commands: settings.commands.map((x, idx) => (idx === i ? { ...x, screenId: e.target.value || null } : x)),
                  })
                }
              >
                <option value="">{t("botflow.commandStart")}</option>
                {screens.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Telegram preview ───────────────────────────────────────────────────────

interface PreviewMsg { from: "bot" | "user"; text: string; buttons?: string[][] }

function TelegramPreview({
  def, lang, storeName, selectedScreenId, onNavigate,
}: {
  def: BotFlowDefinition;
  lang: BotLang;
  storeName: string;
  selectedScreenId: string | null;
  onNavigate: (screenId: string) => void;
}) {
  const { t } = useT();
  const [history, setHistory] = useState<PreviewMsg[]>([]);
  const [current, setCurrent] = useState<string>(def.settings.startScreenId);
  const [activeForm, setActiveForm] = useState<{ formId: string; index: number } | null>(null);

  const screen = def.screens.find((s) => s.id === current);

  // Konstruktorda ekran tanlansa preview ham o'sha ekranga o'tadi (WYSIWYG)
  useEffect(() => {
    if (selectedScreenId && selectedScreenId !== current) {
      setCurrent(selectedScreenId);
      setActiveForm(null);
      setHistory([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScreenId]);

  const form = activeForm ? def.forms.find((f) => f.id === activeForm.formId) : null;
  const field = form && activeForm ? form.fields[activeForm.index] : null;

  const handleButton = (b: BotButton) => {
    const label = pickText(b.label, lang) || b.id;
    setHistory((h) => [...h, { from: "user" as const, text: label }].slice(-8));

    switch (b.action.type) {
      case "screen":
        setCurrent(b.action.screenId);
        setActiveForm(null);
        onNavigate(b.action.screenId);
        break;
      case "form":
        setActiveForm({ formId: b.action.formId, index: 0 });
        break;
      case "home":
      case "back":
        setCurrent(def.settings.startScreenId);
        setActiveForm(null);
        break;
      default:
        break;
    }
  };

  const advanceForm = () => {
    if (!form || !activeForm) return;
    const next = activeForm.index + 1;
    if (next >= form.fields.length) {
      setHistory((h) => [...h, { from: "bot" as const, text: pickText(form.successText, lang).replace(/\{id\}/g, "LID-000123") }].slice(-8));
      setActiveForm(null);
      setCurrent(def.settings.startScreenId);
    } else {
      setActiveForm({ ...activeForm, index: next });
    }
  };

  const reset = () => {
    setHistory([]);
    setActiveForm(null);
    setCurrent(def.settings.startScreenId);
  };

  const welcome = pickText(def.settings.welcome, lang).replace(/\{store\}/g, storeName);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> {t("botflow.preview")}
        </span>
        <button type="button" onClick={reset} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-forest-700">
          <RotateCcw className="w-3 h-3" /> {t("botflow.restart")}
        </button>
      </div>

      {/* Telegram oynasi — mijoz ko'radigan dark theme */}
      <div className="flex-1 rounded-2xl overflow-hidden border border-cream-300 bg-[#17212b] flex flex-col min-h-0">
        <div className="px-4 py-3 bg-[#242f3d] flex items-center gap-2.5 shrink-0">
          <span className="w-8 h-8 rounded-full bg-leaf-400 grid place-items-center text-forest-800 text-xs font-bold">
            {storeName.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{storeName}</p>
            <p className="text-[11px] text-[#7d8b99]">bot</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          {welcome && (
            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-[#182533] px-3 py-2">
              <p className="text-[13px] text-[#e9edf0] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderTgHtml(welcome) }} />
            </div>
          )}

          {history.map((m, i) => (
            <div key={i} className={m.from === "user" ? "flex justify-end" : ""}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                  m.from === "user" ? "rounded-tr-md bg-[#2b5278]" : "rounded-tl-md bg-[#182533]"
                }`}
              >
                <p className="text-[13px] text-[#e9edf0] leading-relaxed" dangerouslySetInnerHTML={{ __html: renderTgHtml(m.text) }} />
              </div>
            </div>
          ))}

          {/* Aktiv anketa savoli */}
          {form && field && (
            <div className="max-w-[90%] space-y-1.5">
              <div className="rounded-2xl rounded-tl-md bg-[#182533] px-3 py-2">
                <p className="text-[11px] text-[#7d8b99] mb-1">
                  {(activeForm?.index ?? 0) + 1}/{form.fields.length}
                </p>
                <p
                  className="text-[13px] text-[#e9edf0] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderTgHtml(pickText(field.label, lang) || field.id) }}
                />
              </div>
              <div className="space-y-1">
                {field.type === "choice" ? (
                  field.options.map((o, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={advanceForm}
                      className="w-full px-3 py-2 rounded-xl bg-[#2b5278] text-[#e9edf0] text-[12px] hover:bg-[#35618f] text-left transition-colors"
                    >
                      {pickText(o, lang) || `#${i + 1}`}
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={advanceForm}
                    className="w-full px-3 py-2 rounded-xl bg-[#2b5278] text-[#e9edf0] text-[12px] hover:bg-[#35618f] transition-colors"
                  >
                    {field.type === "contact" ? t("botflow.previewSharePhone") : t("botflow.previewAnswer")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Joriy ekran */}
          {!form && screen && (
            <div className="max-w-[90%] space-y-1.5">
              <div className="rounded-2xl rounded-tl-md bg-[#182533] px-3 py-2">
                <p
                  className="text-[13px] text-[#e9edf0] leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: renderTgHtml(pickText(screen.text, lang).replace(/\{store\}/g, storeName) || screen.name),
                  }}
                />
              </div>
              <div className="space-y-1">
                {screen.buttons.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleButton(b)}
                    className={`px-3 py-2 rounded-xl bg-[#2b5278] text-[#e9edf0] text-[12px] hover:bg-[#35618f] transition-colors text-left ${
                      b.fullWidth ? "w-full" : "w-[calc(50%-2px)] inline-block mr-[2px]"
                    }`}
                  >
                    {pickText(b.label, lang) || b.id}
                  </button>
                ))}
                {screen.showBack && screen.id !== def.settings.startScreenId && (
                  <button
                    type="button"
                    onClick={() => { setCurrent(def.settings.startScreenId); onNavigate(def.settings.startScreenId); }}
                    className="w-full px-3 py-2 rounded-xl bg-[#232e3c] text-[#7d8b99] text-[12px] text-left"
                  >
                    ⬅️ {lang === "ru" ? "Назад" : "Orqaga"}
                  </button>
                )}
              </div>
            </div>
          )}

          {!screen && !form && (
            <p className="text-center text-[12px] text-[#7d8b99] py-8">{t("botflow.previewNoScreen")}</p>
          )}
        </div>

        {def.settings.showStoreButton && (
          <div className="p-2 bg-[#242f3d] shrink-0 flex gap-1.5">
            <span className="flex-1 px-3 py-2 rounded-lg bg-[#2f3d4d] text-[#e9edf0] text-[12px] text-center truncate">
              {pickText(def.settings.storeButtonLabel, lang) || "🛍"}
            </span>
            <span className="flex-1 px-3 py-2 rounded-lg bg-[#2f3d4d] text-[#e9edf0] text-[12px] text-center">
              {lang === "ru" ? "🏠 Меню" : "🏠 Menyu"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI generator modali ────────────────────────────────────────────────────

function AIModal({
  open, onClose, onApply, lastBrief, aiAvailable,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (def: BotFlowDefinition, warnings: string[]) => void;
  lastBrief: string | null;
  aiAvailable: boolean;
}) {
  const { t } = useT();
  const toast = useAppToast();
  const [brief, setBrief] = useState(lastBrief ?? "");
  const [useExisting, setUseExisting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) setBrief(lastBrief ?? ""); }, [open, lastBrief]);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api<{ definition: BotFlowDefinition; summary: string | null; warnings: string[] }>(
        "/bot-flow/generate",
        { method: "POST", body: { brief, useExisting } },
      );
      onApply(res.definition, res.warnings ?? []);
      toast.success(res.summary || t("botflow.aiDone"));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("botflow.aiFailed"));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/30 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white rounded-2xl border border-cream-300 shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-5 py-4 border-b border-cream-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-leaf-100 text-forest-700 grid place-items-center">
              <Sparkles className="w-4.5 h-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-forest-800">{t("botflow.aiTitle")}</h3>
              <p className="text-[11px] text-slate-400">{t("botflow.aiSubtitle")}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-forest-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {!aiAvailable && (
            <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{t("botflow.aiUnavailable")}</p>
            </div>
          )}

          <Field label={t("botflow.brief")} hint={t("botflow.briefHint")}>
            <textarea
              className={inputCls + " resize-y font-mono text-xs"}
              rows={14}
              value={brief}
              placeholder={t("botflow.briefPlaceholder")}
              onChange={(e) => setBrief(e.target.value)}
            />
          </Field>

          <Toggle checked={useExisting} onChange={setUseExisting} label={t("botflow.useExisting")} />
        </div>

        <div className="px-5 py-4 border-t border-cream-200 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">{brief.length} / 24000</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-cream-100">
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={loading || brief.trim().length < 20 || !aiAvailable}
              onClick={generate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-leaf-400 text-forest-800 text-sm font-medium hover:bg-leaf-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? t("botflow.generating") : t("botflow.generate")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Shablonlar modali ──────────────────────────────────────────────────────

function TemplatesModal({
  open, onClose, onApply, lang,
}: {
  open: boolean;
  onClose: () => void;
  onApply: (def: BotFlowDefinition, template: string) => void;
  lang: BotLang;
}) {
  const { t } = useT();
  const toast = useAppToast();
  const [templates, setTemplates] = useState<TemplateMeta[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    api<{ templates: TemplateMeta[] }>("/bot-flow/templates")
      .then((r) => setTemplates(r.templates))
      .catch(() => setTemplates([]));
  }, [open]);

  const apply = async (id: string) => {
    setBusy(id);
    try {
      const res = await api<{ definition: BotFlowDefinition; template: string }>("/bot-flow/template", {
        method: "POST",
        body: { id },
      });
      onApply(res.definition, res.template);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-900/30 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-white rounded-2xl border border-cream-300 shadow-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-cream-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-forest-800">{t("botflow.templates")}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-forest-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5">
          <p className="text-xs text-slate-500">{t("botflow.templatesHint")}</p>
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              disabled={busy !== null}
              onClick={() => apply(tpl.id)}
              className="w-full text-left p-3.5 rounded-xl border border-cream-300 hover:border-leaf-400 hover:bg-leaf-50/50 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-forest-800">{tpl.name[lang]}</span>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {tpl.screens} {t("botflow.screensShort")} · {tpl.forms} {t("botflow.formsShort")}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{tpl.description[lang]}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Asosiy sahifa ──────────────────────────────────────────────────────────

type Selection = { kind: "screen" | "form"; id: string } | { kind: "settings" };

export default function BotBuilderPage() {
  const { t, lang: uiLang } = useT();
  const toast = useAppToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<Omit<FlowResponse, "definition"> | null>(null);
  const [def, setDef] = useState<BotFlowDefinition | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "settings" });
  const [editLang, setEditLang] = useState<BotLang>(uiLang === "ru" ? "ru" : "uz");
  const [showAI, setShowAI] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);

  const otherLang: BotLang = editLang === "uz" ? "ru" : "uz";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<FlowResponse>("/bot-flow");
      const { definition, ...rest } = res;
      setDef(definition);
      setMeta(rest);
      setTemplate(rest.template);
      setDirty(false);
      setSelection(definition.screens.length ? { kind: "screen", id: definition.settings.startScreenId } : { kind: "settings" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = useCallback((next: BotFlowDefinition) => {
    setDef(next);
    setDirty(true);
  }, []);

  // ─── Lokal validatsiya — saqlashdan oldin ko'rinadi ────────────────────────
  const problems = useMemo(() => {
    if (!def) return [];
    const out: string[] = [];
    const screenIds = def.screens.map((s) => s.id);
    const formIds = def.forms.map((f) => f.id);

    if (!screenIds.includes(def.settings.startScreenId)) out.push(t("botflow.errNoStart"));

    for (const s of def.screens) {
      for (const b of s.buttons) {
        if (b.action.type === "screen" && !screenIds.includes(b.action.screenId)) {
          out.push(t("botflow.errBadScreenRef", { screen: s.name, button: pickText(b.label, editLang) || b.id }));
        }
        if (b.action.type === "form" && !formIds.includes(b.action.formId)) {
          out.push(t("botflow.errBadFormRef", { screen: s.name, button: pickText(b.label, editLang) || b.id }));
        }
      }
    }
    for (const f of def.forms) {
      if (f.fields.length === 0) out.push(t("botflow.errEmptyForm", { form: f.name }));
      for (const fl of f.fields) {
        if (fl.type === "choice" && fl.options.length === 0) {
          out.push(t("botflow.errNoOptions", { form: f.name, field: pickText(fl.label, editLang) || fl.id }));
        }
      }
    }
    return out;
  }, [def, editLang, t]);

  // ─── Amallar ──────────────────────────────────────────────────────────────

  const addScreen = () => {
    if (!def) return;
    const id = uniqueId("screen", def.screens.map((s) => s.id));
    const screen: BotScreen = {
      id,
      name: t("botflow.newScreen"),
      text: emptyLocalized(),
      imageUrl: null,
      buttons: [],
      showBack: true,
    };
    update({ ...def, screens: [...def.screens, screen] });
    setSelection({ kind: "screen", id });
  };

  const addForm = () => {
    if (!def) return;
    const id = uniqueId("form", def.forms.map((f) => f.id));
    const form: BotForm = {
      id,
      name: t("botflow.newForm"),
      intro: emptyLocalized(),
      fields: [{ id: "name", label: emptyLocalized(), type: "text", required: true, options: [], mapTo: "name" }],
      successText: { uz: "✅ So'rovingiz qabul qilindi. Raqami: #{id}", ru: "✅ Ваша заявка принята. Номер: #{id}" },
      leadStatus: "NEW",
      tags: ["bot"],
      notifyAdmin: true,
    };
    update({ ...def, forms: [...def.forms, form] });
    setSelection({ kind: "form", id });
  };

  const deleteScreen = async (id: string) => {
    if (!def) return;
    const refs = def.screens.flatMap((s) =>
      s.buttons.filter((b) => b.action.type === "screen" && b.action.screenId === id).map(() => s.name),
    );
    const ok = await confirm({
      title: t("botflow.deleteScreen"),
      description: refs.length ? t("botflow.deleteScreenRefs", { count: refs.length }) : t("botflow.deleteScreenConfirm"),
      confirmText: t("common.delete"),
      kind: "danger",
    });
    if (!ok) return;

    // Havolalarni ham tozalaymiz — buzuq oqim saqlanmasin
    const screens = def.screens
      .filter((s) => s.id !== id)
      .map((s) => ({ ...s, buttons: s.buttons.filter((b) => !(b.action.type === "screen" && b.action.screenId === id)) }));
    update({
      ...def,
      screens,
      settings: {
        ...def.settings,
        commands: def.settings.commands.map((c) => (c.screenId === id ? { ...c, screenId: null } : c)),
      },
    });
    setSelection({ kind: "screen", id: def.settings.startScreenId });
  };

  const deleteForm = async (id: string) => {
    if (!def) return;
    const ok = await confirm({
      title: t("botflow.deleteForm"),
      description: t("botflow.deleteFormConfirm"),
      confirmText: t("common.delete"),
      kind: "danger",
    });
    if (!ok) return;

    update({
      ...def,
      forms: def.forms.filter((f) => f.id !== id),
      screens: def.screens.map((s) => ({
        ...s,
        buttons: s.buttons.filter((b) => !(b.action.type === "form" && b.action.formId === id)),
      })),
    });
    setSelection({ kind: "settings" });
  };

  const save = async (enabled?: boolean) => {
    if (!def) return;
    setSaving(true);
    try {
      const res = await api<{ ok: true; enabled: boolean; updatedAt: string }>("/bot-flow", {
        method: "PUT",
        body: { definition: def, ...(enabled !== undefined && { enabled }), template },
      });
      setDirty(false);
      setMeta((m) => (m ? { ...m, enabled: res.enabled, updatedAt: res.updatedAt } : m));
      toast.success(t("botflow.saved"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common.error");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    if (!meta || !def) return;
    const next = !meta.enabled;
    if (next && problems.length) {
      toast.error(t("botflow.fixErrorsFirst"));
      return;
    }
    if (dirty) {
      await save(next);
      return;
    }
    try {
      await api<{ ok: true; enabled: boolean }>("/bot-flow/enabled", { method: "PATCH", body: { enabled: next } });
      setMeta({ ...meta, enabled: next });
      toast.success(next ? t("botflow.enabled") : t("botflow.disabled"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  };

  const applyDefinition = (next: BotFlowDefinition, tpl?: string) => {
    setDef(next);
    setDirty(true);
    if (tpl) setTemplate(tpl);
    setSelection({ kind: "screen", id: next.settings.startScreenId });
  };

  if (loading || !def || !meta) return <PageSkeleton />;

  const selectedScreen = selection.kind === "screen" ? def.screens.find((s) => s.id === selection.id) : undefined;
  const selectedForm = selection.kind === "form" ? def.forms.find((f) => f.id === selection.id) : undefined;

  return (
    <div className="space-y-4">
      {/* ─── Sarlavha ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-leaf-100 text-forest-700 grid place-items-center">
            <Bot className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-forest-800">{t("botflow.title")}</h1>
            <p className="text-xs text-slate-500">
              {def.screens.length} {t("botflow.screensShort")} · {def.forms.length} {t("botflow.formsShort")}
              {meta.bot.username && ` · @${meta.bot.username}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tahrir tili */}
          <div className="flex rounded-xl bg-cream-100 p-0.5">
            {(["uz", "ru"] as BotLang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setEditLang(l)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  editLang === l ? "bg-white text-forest-700 shadow-sm" : "text-slate-400"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cream-300 bg-white text-sm text-slate-600 hover:border-leaf-400"
          >
            <LayoutTemplate className="w-4 h-4" /> {t("botflow.templates")}
          </button>

          <button
            type="button"
            onClick={() => setShowAI(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cream-300 bg-white text-sm text-slate-600 hover:border-leaf-400"
          >
            <Sparkles className="w-4 h-4 text-leaf-600" /> {t("botflow.ai")}
          </button>

          <button
            type="button"
            onClick={toggleEnabled}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              meta.enabled
                ? "bg-leaf-100 text-forest-700 hover:bg-leaf-200"
                : "border border-cream-300 bg-white text-slate-500 hover:border-leaf-400"
            }`}
          >
            <Power className="w-4 h-4" />
            {meta.enabled ? t("botflow.on") : t("botflow.off")}
          </button>

          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => save()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-forest-700 text-white text-sm font-medium hover:bg-forest-800 disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("common.save")}
          </button>
        </div>
      </div>

      {/* ─── Holat bannerlari ─────────────────────────────────────────────── */}
      {!meta.bot.connected && (
        <div className="flex gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">{t("botflow.noBotToken")}</p>
        </div>
      )}

      {meta.corrupted && (
        <div className="flex gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-700 leading-relaxed">{t("botflow.corrupted")}</p>
        </div>
      )}

      {problems.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
          <p className="text-xs font-medium text-rose-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {t("botflow.problems", { count: problems.length })}
          </p>
          <ul className="text-[11px] text-rose-600 space-y-0.5 pl-5 list-disc">
            {problems.slice(0, 6).map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}

      {meta.enabled && problems.length === 0 && !dirty && (
        <div className="flex gap-2.5 p-3.5 rounded-2xl bg-leaf-50 border border-leaf-200">
          <CheckCircle2 className="w-4 h-4 text-leaf-600 shrink-0 mt-0.5" />
          <p className="text-xs text-forest-700 leading-relaxed">{t("botflow.liveHint")}</p>
        </div>
      )}

      {/* ─── Uch ustun ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-4 items-start">
        {/* Chap: struktura */}
        <div className="bg-white rounded-2xl border border-cream-300/80 p-3 space-y-4 lg:sticky lg:top-4">
          <button
            type="button"
            onClick={() => setSelection({ kind: "settings" })}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
              selection.kind === "settings" ? "bg-leaf-100 text-forest-700 font-medium" : "text-slate-600 hover:bg-cream-100"
            }`}
          >
            <Settings2 className="w-4 h-4" /> {t("botflow.settings")}
          </button>

          <div>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                {t("botflow.screens")}
              </h4>
              <button type="button" onClick={addScreen} className="text-slate-400 hover:text-forest-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-0.5">
              {def.screens.map((s) => {
                const orphan = meta.orphanScreens.includes(s.id) && s.id !== def.settings.startScreenId;
                const active = selection.kind === "screen" && selection.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelection({ kind: "screen", id: s.id })}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left ${
                      active ? "bg-leaf-100 text-forest-700 font-medium" : "text-slate-600 hover:bg-cream-100"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="flex-1 truncate">{s.name}</span>
                    {s.id === def.settings.startScreenId && <Home className="w-3 h-3 text-leaf-600 shrink-0" />}
                    {orphan && <span title={t("botflow.orphan")} className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                {t("botflow.forms")}
              </h4>
              <button type="button" onClick={addForm} className="text-slate-400 hover:text-forest-700">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {def.forms.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-slate-400">{t("botflow.noForms")}</p>
            ) : (
              <div className="space-y-0.5">
                {def.forms.map((f) => {
                  const active = selection.kind === "form" && selection.id === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelection({ kind: "form", id: f.id })}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left ${
                        active ? "bg-leaf-100 text-forest-700 font-medium" : "text-slate-600 hover:bg-cream-100"
                      }`}
                    >
                      <ClipboardList className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-[10px] text-slate-400 shrink-0">{f.fields.length}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* O'rta: tahrirlagich */}
        <div className="bg-white rounded-2xl border border-cream-300/80 p-5">
          {selection.kind === "settings" && (
            <SettingsEditor
              settings={def.settings}
              screens={def.screens}
              lang={editLang}
              otherLang={otherLang}
              onChange={(settings) => update({ ...def, settings })}
            />
          )}

          {selectedScreen && (
            <ScreenEditor
              screen={selectedScreen}
              screens={def.screens}
              forms={def.forms}
              lang={editLang}
              otherLang={otherLang}
              isStart={selectedScreen.id === def.settings.startScreenId}
              onChange={(s) => update({ ...def, screens: def.screens.map((x) => (x.id === s.id ? s : x)) })}
              onDelete={() => void deleteScreen(selectedScreen.id)}
              onSetStart={() => update({ ...def, settings: { ...def.settings, startScreenId: selectedScreen.id } })}
            />
          )}

          {selectedForm && (
            <FormEditor
              form={selectedForm}
              lang={editLang}
              otherLang={otherLang}
              onChange={(f) => update({ ...def, forms: def.forms.map((x) => (x.id === f.id ? f : x)) })}
              onDelete={() => void deleteForm(selectedForm.id)}
            />
          )}

          {selection.kind === "screen" && !selectedScreen && (
            <p className="text-sm text-slate-400 text-center py-8">{t("botflow.selectSomething")}</p>
          )}
        </div>

        {/* O'ng: preview */}
        <div className="lg:sticky lg:top-4 h-[640px]">
          <TelegramPreview
            def={def}
            lang={editLang}
            storeName={meta.bot.username ?? t("botflow.yourStore")}
            selectedScreenId={selection.kind === "screen" ? selection.id : null}
            onNavigate={(id) => setSelection({ kind: "screen", id })}
          />
        </div>
      </div>

      <AIModal
        open={showAI}
        onClose={() => setShowAI(false)}
        onApply={(d, warnings) => {
          applyDefinition(d, "ai");
          if (warnings.length) toast.error(warnings[0]);
        }}
        lastBrief={meta.lastBrief}
        aiAvailable={meta.aiAvailable}
      />

      <TemplatesModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onApply={(d, tpl) => applyDefinition(d, tpl)}
        lang={editLang}
      />
    </div>
  );
}
