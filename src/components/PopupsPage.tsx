// Admin: marketing popup'larini boshqarish sahifasi.
// Vitrina ustida ko'rsatiladigan modal/banner'larni bu yerda yaratasiz.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Megaphone, Edit2, Trash2, Loader2, Eye, EyeOff, X, ChevronRight, Image as ImageIcon,
} from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";
import { useT } from "../i18n";
import { useConfirm } from "./ui/ConfirmDialog";

type PopupKind = "MODAL" | "BANNER" | "TOAST";
type PopupTrigger = "ON_OPEN" | "AFTER_DELAY" | "ON_TAB_CHANGE" | "ON_CART_ABANDON";

interface Popup {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  kind: PopupKind;
  trigger: PopupTrigger;
  triggerDelaySec: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxImpressionsPerUser: number;
  cooldownHours: number;
  priority: number;
  impressions: number;
  clicks: number;
  createdAt: string;
}

const KIND_LABEL: Record<PopupKind, string> = {
  MODAL: "Modal (to'liq ekran)",
  BANNER: "Banner (yuqori)",
  TOAST: "Toast (kichik)",
};

const TRIGGER_LABEL: Record<PopupTrigger, string> = {
  ON_OPEN: "App ochilganda",
  AFTER_DELAY: "Kechikish bilan",
  ON_TAB_CHANGE: "Tab bosilganda",
  ON_CART_ABANDON: "Savatda mahsulot (Phase 2)",
};

const popupsApi = {
  list: () => api<{ popups: Popup[] }>("/popups"),
  create: (data: Partial<Popup>) => api<Popup>("/popups", { method: "POST", body: data as never }),
  update: (id: string, data: Partial<Popup>) => api<Popup>(`/popups/${id}`, { method: "PATCH", body: data as never }),
  remove: (id: string) => api<void>(`/popups/${id}`, { method: "DELETE" }),
};

export default function PopupsPage() {
  const { t } = useT();
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Popup | null>(null);
  const [creating, setCreating] = useState(false);
  const toast = useAppToast();
  const confirmDialog = useConfirm();

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await popupsApi.list();
      setPopups(res.popups);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklashda xato");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleActive = async (popup: Popup) => {
    try {
      await popupsApi.update(popup.id, { active: !popup.active });
      toast.success(popup.active ? "Popup yashirildi" : "Popup yoqildi");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yangilanmadi");
    }
  };

  const remove = async (popup: Popup) => {
    const ok = await confirmDialog({
      title: "Popup o'chirilsinmi?",
      description: `"${popup.title}" butunlay o'chiriladi.`,
      kind: "danger",
      confirmText: "O'chirish",
    });
    if (!ok) return;
    try {
      await popupsApi.remove(popup.id);
      toast.success("Popup o'chirildi");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirilmadi");
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest-800 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-forest-700" />
            {t("popups.title")}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("popups.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-medium text-forest-800"
        >
          <Plus className="w-4 h-4" />
          {t("popups.newPopup")}
        </button>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : popups.length === 0 ? (
        <div className="bg-white border border-cream-300 rounded-xl py-20 px-6 text-center">
          <Megaphone className="w-12 h-12 text-cream-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-forest-800 mb-1">Hozircha popup yo'q</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Birinchi popup'ingizni yarating — mijoz Mini App'ga kirganda chegirma, e'lon yoki taklif ko'rsatiladi.
          </p>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-medium text-forest-800"
          >
            <Plus className="w-4 h-4" />
            Birinchi popup yaratish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {popups.map((p) => (
            <PopupCard
              key={p.id}
              popup={p}
              onToggle={() => toggleActive(p)}
              onEdit={() => setEditing(p)}
              onDelete={() => remove(p)}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PopupEditor
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function PopupCard({
  popup, onToggle, onEdit, onDelete,
}: {
  popup: Popup; onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const ctr = popup.impressions > 0 ? Math.round((popup.clicks / popup.impressions) * 100) : 0;
  return (
    <div className="bg-white border border-cream-300 rounded-2xl p-4 hover:border-cream-300 transition-colors">
      <div className="flex items-start gap-3 mb-3">
        {popup.imageUrl ? (
          <img src={popup.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-cream-100 flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-5 h-5 text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-forest-800 truncate flex-1">{popup.title}</h3>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                popup.active ? "bg-leaf-100 text-forest-700" : "bg-cream-100 text-slate-500"
              }`}
            >
              {popup.active ? "Faol" : "O'chirilgan"}
            </span>
          </div>
          <p className="text-xs text-slate-500 line-clamp-2">{popup.body}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] text-slate-500">
            <span className="px-2 py-0.5 bg-cream-100 rounded">{KIND_LABEL[popup.kind]}</span>
            <span className="px-2 py-0.5 bg-cream-100 rounded">{TRIGGER_LABEL[popup.trigger]}</span>
            {popup.priority > 0 && <span>P:{popup.priority}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-cream-300 pt-3">
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span>👁 {popup.impressions}</span>
          <span>🖱 {popup.clicks}</span>
          {popup.impressions > 0 && <span>CTR: {ctr}%</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onToggle} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100" title={popup.active ? "Yashirish" : "Yoqish"}>
            {popup.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100" title="Tahrirlash">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-100" title="O'chirish">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PopupEditor({
  initial, onClose, onSaved,
}: {
  initial: Popup | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    body: initial?.body ?? "",
    imageUrl: initial?.imageUrl ?? "",
    ctaText: initial?.ctaText ?? "",
    ctaUrl: initial?.ctaUrl ?? "",
    kind: initial?.kind ?? ("MODAL" as PopupKind),
    trigger: initial?.trigger ?? ("ON_OPEN" as PopupTrigger),
    triggerDelaySec: initial?.triggerDelaySec ?? 0,
    active: initial?.active ?? true,
    maxImpressionsPerUser: initial?.maxImpressionsPerUser ?? 1,
    cooldownHours: initial?.cooldownHours ?? 24,
    priority: initial?.priority ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const toast = useAppToast();

  const save = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Sarlavha va matn bo'sh bo'lmasin");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        imageUrl: form.imageUrl.trim() || null,
        ctaText: form.ctaText.trim() || null,
        ctaUrl: form.ctaUrl.trim() || null,
      };
      if (isEdit && initial) {
        await popupsApi.update(initial.id, payload as never);
        toast.success("Popup saqlandi");
      } else {
        await popupsApi.create(payload as never);
        toast.success("Popup yaratildi");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlashda xato");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={onClose}>
      <div
        className="bg-white border border-cream-300 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-cream-300 px-5 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-forest-800">{isEdit ? "Popup tahrirlash" : "Yangi popup"}</h2>
          <button onClick={onClose} className="p-1 -mr-1 text-slate-500 hover:text-forest-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Sarlavha *" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <FieldArea label="Matn *" value={form.body} onChange={(v) => setForm({ ...form, body: v })} />
          <Field label="Rasm URL (ixtiyoriy)" value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} placeholder="https://..." />

          <div className="grid grid-cols-2 gap-3">
            <Field label="CTA tugma matni" value={form.ctaText} onChange={(v) => setForm({ ...form, ctaText: v })} placeholder="Xarid qilish" />
            <Field label="CTA URL/yo'l" value={form.ctaUrl} onChange={(v) => setForm({ ...form, ctaUrl: v })} placeholder="/promotions" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Turi"
              value={form.kind}
              onChange={(v) => setForm({ ...form, kind: v as PopupKind })}
              options={(Object.entries(KIND_LABEL) as Array<[PopupKind, string]>).map(([k, l]) => ({ value: k, label: l }))}
            />
            <SelectField
              label="Trigger"
              value={form.trigger}
              onChange={(v) => setForm({ ...form, trigger: v as PopupTrigger })}
              options={(Object.entries(TRIGGER_LABEL) as Array<[PopupTrigger, string]>).map(([k, l]) => ({ value: k, label: l }))}
            />
          </div>

          {form.trigger === "AFTER_DELAY" && (
            <Field
              label="Kechikish (soniya)"
              type="number"
              value={String(form.triggerDelaySec)}
              onChange={(v) => setForm({ ...form, triggerDelaySec: Number(v) || 0 })}
            />
          )}

          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-cream-300">
            <Field
              label="Maks. ko'rsatish (kishi/popup)"
              type="number"
              value={String(form.maxImpressionsPerUser)}
              onChange={(v) => setForm({ ...form, maxImpressionsPerUser: Number(v) || 0 })}
            />
            <Field
              label="Cooldown (soat)"
              type="number"
              value={String(form.cooldownHours)}
              onChange={(v) => setForm({ ...form, cooldownHours: Number(v) || 0 })}
            />
            <Field
              label="Prioritet"
              type="number"
              value={String(form.priority)}
              onChange={(v) => setForm({ ...form, priority: Number(v) || 0 })}
            />
          </div>

          <label className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="w-4 h-4 rounded bg-cream-100 border-cream-300 text-emerald-500 focus:ring-emerald-500/50"
            />
            <span className="text-sm text-forest-700">Faol</span>
          </label>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-cream-300 px-5 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm text-slate-700 bg-cream-100 hover:bg-cream-200 rounded-lg font-medium"
          >
            Bekor
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 text-sm bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg font-semibold text-forest-800 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Saqlash" : "Yaratish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
      />
    </label>
  );
}

function FieldArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 resize-none"
      />
    </label>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-cream-100 border border-cream-300 rounded-lg pl-3 pr-9 py-2 text-sm text-forest-800 appearance-none focus:outline-none focus:border-leaf-500/60"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 rotate-90 pointer-events-none" />
      </div>
    </label>
  );
}
