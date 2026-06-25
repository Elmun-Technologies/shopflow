// Promo kodlar — real /api/promo-codes integratsiyasi
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, Tag, Copy, CheckCircle2,
  X, Loader2, AlertCircle, BarChart3,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../api/client";
import EmptyState from "../EmptyState";
import { useT } from "../../i18n";

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  maxDiscount: number | null;
  minOrderAmount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
}

const cls = "w-full bg-cream-100 border border-cream-300 rounded-xl px-3 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 transition-colors";

export default function PromoPage() {
  const { t } = useT();
  const fmtPrice = (v: number) => v.toLocaleString("uz-UZ") + " " + t("common.sum");
  const { data: codes, loading, refetch } = useAsync<PromoCode[]>(
    () => api("/promo-codes"), [],
  );

  const [showForm, setShowForm] = useState(false);
  const [editCode, setEditCode] = useState<PromoCode | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => null);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(t("promo.confirmDelete", { code }))) return;
    await api(`/promo-codes/${id}`, { method: "DELETE" });
    refetch();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await api(`/promo-codes/${id}`, { method: "PATCH", body: { active } });
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-forest-900">{t("promo.title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("promo.subtitle")}
          </p>
        </div>
        <button
          onClick={() => { setEditCode(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-forest-700 hover:bg-forest-800 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("promo.newCode")}
        </button>
      </motion.div>

      {/* Stats */}
      {codes && codes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("promo.stat.total"), value: codes.length, color: "#475569" },
            { label: t("mkt.active"), value: codes.filter(c => c.active).length, color: "#5FA340" },
            { label: t("promo.stat.used"), value: codes.reduce((s, c) => s + c.usageCount, 0), color: "#3b82f6" },
            { label: t("promo.stat.expired"), value: codes.filter(c => c.endsAt && new Date(c.endsAt) < new Date()).length, color: "#f59e0b" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white border border-cream-300/80 rounded-2xl p-4"
              style={{ borderTop: `2px solid ${s.color}` }}
            >
              <p className="text-2xl font-bold text-forest-800">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && (!codes || codes.length === 0) && (
        <EmptyState
          icon={Tag}
          title={t("promo.empty.title")}
          description={t("promo.empty.desc")}
          buttonText={t("promo.empty.btn")}
          onButtonClick={() => setShowForm(true)}
        />
      )}

      <div className="space-y-3">
        {codes?.map((code) => {
          const isExpired = code.endsAt && new Date(code.endsAt) < new Date();
          const usagePct = code.usageLimit ? Math.round((code.usageCount / code.usageLimit) * 100) : null;

          return (
            <motion.div
              key={code.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-cream-300/80 rounded-2xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    code.active && !isExpired ? "bg-leaf-100" : "bg-slate-100"
                  }`}>
                    <Tag className={`w-5 h-5 ${code.active && !isExpired ? "text-forest-700" : "text-slate-400"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => handleCopy(code.code)}
                        className="flex items-center gap-1.5 font-mono font-bold text-forest-800 hover:text-forest-700 transition-colors text-sm"
                        title={t("promo.copy")}
                      >
                        {code.code}
                        {copied === code.code
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-leaf-500" />
                          : <Copy className="w-3 h-3 text-slate-400" />
                        }
                      </button>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        !code.active
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : isExpired
                            ? "bg-amber-100 text-amber-600 border-amber-200"
                            : "bg-leaf-100 text-forest-700 border-leaf-300/60"
                      }`}>
                        {!code.active ? t("promo.status.inactive") : isExpired ? t("promo.status.expired") : t("mkt.active")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      <span className="font-semibold text-forest-700">
                        {code.discountType === "PERCENT"
                          ? `${code.discountValue}%`
                          : fmtPrice(code.discountValue)
                        } {t("promo.discount")}
                      </span>
                      {code.minOrderAmount && (
                        <span>{t("promo.min")} {fmtPrice(code.minOrderAmount)}</span>
                      )}
                      {code.usageLimit && (
                        <span>{t("promo.usedCount", { used: code.usageCount, limit: code.usageLimit })}</span>
                      )}
                      {!code.usageLimit && code.usageCount > 0 && (
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {t("promo.timesUsed", { count: code.usageCount })}
                        </span>
                      )}
                      {code.endsAt && (
                        <span>
                          {isExpired ? t("promo.expiredOn") : t("promo.expiresOn")}{" "}
                          {new Date(code.endsAt).toLocaleDateString("uz-UZ")}
                        </span>
                      )}
                    </div>
                    {/* Usage progress */}
                    {usagePct !== null && (
                      <div className="mt-2 h-1 bg-cream-200 rounded-full overflow-hidden w-32">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${usagePct}%`,
                            backgroundColor: usagePct >= 90 ? "#ef4444" : usagePct >= 60 ? "#f59e0b" : "#5FA340",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(code.id, !code.active)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      code.active
                        ? "text-slate-600 hover:bg-slate-100"
                        : "text-forest-700 hover:bg-leaf-100"
                    }`}
                  >
                    {code.active ? t("promo.deactivate") : t("promo.activate")}
                  </button>
                  <button
                    onClick={() => { setEditCode(code); setShowForm(true); }}
                    className="p-2 rounded-lg text-slate-400 hover:text-forest-800 hover:bg-cream-100 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(code.id, code.code)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <PromoFormModal
            code={editCode}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); refetch(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Forma ───────────────────────────────────────────────────────────────────

function PromoFormModal({
  code, onClose, onSaved,
}: { code: PromoCode | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const isEdit = !!code;
  const [form, setForm] = useState({
    code: code?.code ?? "",
    description: code?.description ?? "",
    discountType: code?.discountType ?? "PERCENT" as "PERCENT" | "FIXED",
    discountValue: code?.discountValue ?? 10,
    maxDiscount: code?.maxDiscount ?? "",
    minOrderAmount: code?.minOrderAmount ?? "",
    usageLimit: code?.usageLimit ?? "",
    perUserLimit: code?.perUserLimit ?? 1,
    startsAt: code?.startsAt ? code.startsAt.slice(0, 10) : "",
    endsAt: code?.endsAt ? code.endsAt.slice(0, 10) : "",
    active: code?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setForm((f) => ({ ...f, code }));
  };

  const save = async () => {
    if (!form.code.trim()) { setError(t("promo.err.codeRequired")); return; }
    if (!form.discountValue || form.discountValue <= 0) { setError(t("promo.err.valueRequired")); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxDiscount: form.maxDiscount !== "" ? Number(form.maxDiscount) : null,
        minOrderAmount: form.minOrderAmount !== "" ? Number(form.minOrderAmount) : null,
        usageLimit: form.usageLimit !== "" ? Number(form.usageLimit) : null,
        perUserLimit: Number(form.perUserLimit),
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt + "T23:59:59").toISOString() : null,
        active: form.active,
      };
      if (isEdit) await api(`/promo-codes/${code!.id}`, { method: "PATCH", body });
      else await api("/promo-codes", { method: "POST", body });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
        className="bg-cream-50 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-forest-800 text-lg">
            {isEdit ? t("promo.modal.editTitle") : t("promo.modal.newTitle")}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-forest-800 hover:bg-cream-100" aria-label={t("common.close")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          </div>
        )}

        <div className="space-y-3">
          {/* Kod */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t("promo.form.code")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SUMMER25"
                className={`${cls} font-mono flex-1`}
                maxLength={40}
              />
              <button
                type="button"
                onClick={generateCode}
                className="px-3 py-2 bg-cream-200 hover:bg-cream-300 rounded-xl text-xs font-medium text-slate-600 transition-colors whitespace-nowrap"
              >
                {t("promo.form.random")}
              </button>
            </div>
          </div>

          {/* Izoh */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t("promo.form.description")}</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t("promo.form.descriptionPh")}
              className={cls}
            />
          </div>

          {/* Chegirma turi + miqdori */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t("promo.form.type")}</label>
              <select
                value={form.discountType}
                onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as "PERCENT" | "FIXED" }))}
                className={cls}
              >
                <option value="PERCENT">{t("promo.type.percent")}</option>
                <option value="FIXED">{t("promo.type.fixed")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {form.discountType === "PERCENT" ? t("promo.form.percentValue") : t("promo.form.fixedValue")}
              </label>
              <input
                type="number"
                min={0}
                max={form.discountType === "PERCENT" ? 100 : undefined}
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: Number(e.target.value) }))}
                className={cls}
              />
            </div>
          </div>

          {/* Maksimal chegirma (foiz uchun) */}
          {form.discountType === "PERCENT" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t("promo.form.maxDiscount")}
              </label>
              <input
                type="number"
                value={form.maxDiscount}
                onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
                placeholder="50000"
                className={cls}
              />
            </div>
          )}

          {/* Minimal summa */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {t("promo.form.minOrder")}
            </label>
            <input
              type="number"
              value={form.minOrderAmount}
              onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))}
              placeholder="100000"
              className={cls}
            />
          </div>

          {/* Foydalanish limiti */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t("promo.form.totalLimit")}
              </label>
              <input
                type="number"
                value={form.usageLimit}
                onChange={(e) => setForm((f) => ({ ...f, usageLimit: e.target.value }))}
                placeholder="100"
                className={cls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t("promo.form.perUserLimit")}
              </label>
              <input
                type="number"
                min={1}
                value={form.perUserLimit}
                onChange={(e) => setForm((f) => ({ ...f, perUserLimit: Number(e.target.value) }))}
                className={cls}
              />
            </div>
          </div>

          {/* Sana */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t("promo.form.startDate")}</label>
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className={cls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">{t("promo.form.endDate")}</label>
              <input
                type="date"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                className={cls}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-slate-700">{t("mkt.active")}</span>
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-cream-100 hover:bg-cream-200 transition-colors">
            {t("common.cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-forest-700 hover:bg-forest-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? t("common.save") : t("promo.empty.btn")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
