// Sodiqlik dasturi — real /api/loyalty integratsiyasi
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award, Plus, Pencil, Gift, TrendingUp, Users, Loader2, X, AlertCircle,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../api/client";
import EmptyState from "../EmptyState";
import { useT } from "../../i18n";

interface LoyaltyRule {
  id: string;
  name: string;
  description: string | null;
  type: string;
  earnPerAmount: number | null;
  earnPerThreshold: number | null;
  redeemRate: number | null;
  active: boolean;
  createdAt: string;
}

interface LoyaltyStats {
  totalAccounts: number;
  totalBalance: number;
  totalEarned: number;
  totalSpent: number;
  byType: Array<{ type: string; count: number; total: number }>;
}

const TYPE_LABELS: Record<string, { labelKey: string; icon: typeof Award; color: string }> = {
  purchase:    { labelKey: "loyalty.type.purchase", icon: TrendingUp, color: "#10b981" },
  birthday:    { labelKey: "loyalty.type.birthday", icon: Gift, color: "#8b5cf6" },
  referral:    { labelKey: "loyalty.type.referral", icon: Users, color: "#3b82f6" },
  first_order: { labelKey: "loyalty.type.first_order", icon: Award, color: "#f59e0b" },
};

const cls = "w-full bg-cream-100 border border-cream-300 rounded-xl px-3 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 transition-colors";

export default function SodiqlikPage() {
  const { t } = useT();
  const { data: rules, loading: rulesLoading, refetch: reloadRules } = useAsync<LoyaltyRule[]>(
    () => api("/loyalty/rules"), [],
  );
  const { data: stats, loading: statsLoading } = useAsync<LoyaltyStats>(
    () => api("/loyalty/stats"), [],
  );

  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState<LoyaltyRule | null>(null);

  const handleToggle = async (id: string, active: boolean) => {
    await api(`/loyalty/rules/${id}`, { method: "PATCH", body: { active } });
    reloadRules();
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
          <h1 className="text-2xl font-bold text-forest-900">{t("loyalty.title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("loyalty.subtitle")}
          </p>
        </div>
        <button
          onClick={() => { setEditRule(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-forest-700 hover:bg-forest-800 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("loyalty.newRule")}
        </button>
      </motion.div>

      {/* Stats */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("loyalty.stat.activeCustomers"), value: stats.totalAccounts, color: "#3b82f6" },
            { label: t("loyalty.stat.totalBalance"), value: stats.totalBalance.toLocaleString("uz-UZ"), color: "#8b5cf6", unit: t("loyalty.points") },
            { label: t("loyalty.stat.earned"), value: stats.totalEarned.toLocaleString("uz-UZ"), color: "#10b981", unit: t("loyalty.points") },
            { label: t("loyalty.stat.spent"), value: stats.totalSpent.toLocaleString("uz-UZ"), color: "#f59e0b", unit: t("loyalty.points") },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white border border-cream-300/80 rounded-2xl p-4"
              style={{ borderTop: `2px solid ${s.color}` }}
            >
              <p className="text-xl font-bold text-forest-800">
                {s.value}
                {s.unit && <span className="text-xs font-normal text-slate-400 ml-1">{s.unit}</span>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rules */}
      <div>
        <h2 className="text-base font-semibold text-forest-800 mb-3">{t("loyalty.rulesTitle")}</h2>

        {rulesLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        )}

        {!rulesLoading && (!rules || rules.length === 0) && (
          <EmptyState
            icon={Award}
            title={t("loyalty.empty.title")}
            description={t("loyalty.empty.description")}
            buttonText={t("loyalty.empty.button")}
            onButtonClick={() => setShowForm(true)}
          />
        )}

        <div className="space-y-3">
          {rules?.map((rule) => {
            const typeConf = TYPE_LABELS[rule.type] ?? { labelKey: "", icon: Award, color: "#94a3b8" };
            const TypeIcon = typeConf.icon;
            const typeLabel = typeConf.labelKey ? t(typeConf.labelKey) : rule.type;

            return (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-cream-300/80 rounded-2xl p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: typeConf.color + "15" }}
                  >
                    <TypeIcon className="w-5 h-5" style={{ color: typeConf.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-forest-800 text-sm">{rule.name}</p>
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: typeConf.color + "20", color: typeConf.color }}
                        >
                          {typeLabel}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          rule.active
                            ? "bg-leaf-100 text-forest-700 border-leaf-300/60"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}>
                          {rule.active ? t("loyalty.active") : t("loyalty.inactive")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggle(rule.id, !rule.active)}
                          className="text-xs px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          {rule.active ? t("loyalty.disable") : t("loyalty.enable")}
                        </button>
                        <button
                          onClick={() => { setEditRule(rule); setShowForm(true); }}
                          className="p-2 rounded-lg text-slate-400 hover:text-forest-800 hover:bg-cream-100 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {rule.description && (
                      <p className="text-xs text-slate-400 mt-1">{rule.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                      {rule.earnPerAmount && rule.earnPerThreshold && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {t("loyalty.earnPer", { amount: rule.earnPerThreshold.toLocaleString() })} →{" "}
                          <span className="font-semibold text-forest-700">{t("loyalty.pointsN", { count: rule.earnPerAmount })}</span>
                        </span>
                      )}
                      {rule.redeemRate && (
                        <span>
                          {t("loyalty.redeemPrefix")} <span className="font-semibold text-forest-700">{t("loyalty.sumN", { count: rule.redeemRate })}</span> {t("loyalty.discount")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <RuleFormModal
            rule={editRule}
            onClose={() => setShowForm(false)}
            onSaved={() => { setShowForm(false); reloadRules(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RuleFormModal({
  rule, onClose, onSaved,
}: { rule: LoyaltyRule | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const isEdit = !!rule;
  const [form, setForm] = useState({
    name: rule?.name ?? "",
    description: rule?.description ?? "",
    type: rule?.type ?? "purchase",
    earnPerAmount: rule?.earnPerAmount ?? 1,
    earnPerThreshold: rule?.earnPerThreshold ?? 1000,
    redeemRate: rule?.redeemRate ?? "",
    active: rule?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.name.trim()) { setError(t("loyalty.form.nameRequired")); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description || null,
        type: form.type,
        earnPerAmount: form.earnPerAmount ? Number(form.earnPerAmount) : null,
        earnPerThreshold: form.earnPerThreshold ? Number(form.earnPerThreshold) : null,
        redeemRate: form.redeemRate !== "" ? Number(form.redeemRate) : null,
        active: form.active,
      };
      if (isEdit) await api(`/loyalty/rules/${rule!.id}`, { method: "PATCH", body });
      else await api("/loyalty/rules", { method: "POST", body });
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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
        className="bg-cream-50 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-forest-800">{isEdit ? t("loyalty.editRule") : t("loyalty.newRule")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-forest-800 hover:bg-cream-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t("loyalty.form.name")} *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("loyalty.form.namePlaceholder")} className={cls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t("loyalty.form.ruleType")}</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={cls}>
              <option value="purchase">{t("loyalty.option.purchase")}</option>
              <option value="first_order">{t("loyalty.option.first_order")}</option>
              <option value="birthday">{t("loyalty.option.birthday")}</option>
              <option value="referral">{t("loyalty.option.referral")}</option>
            </select>
          </div>

          {form.type === "purchase" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t("loyalty.form.pointAmount")}</label>
                <input type="number" min={1} value={form.earnPerAmount} onChange={(e) => setForm((f) => ({ ...f, earnPerAmount: Number(e.target.value) }))} className={cls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t("loyalty.form.perSum")}</label>
                <input type="number" min={1} value={form.earnPerThreshold} onChange={(e) => setForm((f) => ({ ...f, earnPerThreshold: Number(e.target.value) }))} className={cls} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {t("loyalty.form.redeemRate")}
            </label>
            <input type="number" value={form.redeemRate} onChange={(e) => setForm((f) => ({ ...f, redeemRate: e.target.value }))} placeholder="10" className={cls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t("loyalty.form.description")}</label>
            <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t("loyalty.form.descriptionPlaceholder")} className={cls} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700">{t("loyalty.active")}</span>
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-cream-100 hover:bg-cream-200 transition-colors">{t("common.cancel")}</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-forest-700 hover:bg-forest-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? t("common.save") : t("loyalty.create")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
