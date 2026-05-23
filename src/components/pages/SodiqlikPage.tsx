import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, ChevronLeft, Award } from "lucide-react";
import type { LoyaltyRule, LoyaltyRuleType, LoyaltySettings } from "../../data/marketingData";
import { initialLoyaltyRules, initialLoyaltySettings, loyaltyRuleTypeLabels, loyaltyRuleTypeDescriptions } from "../../data/marketingData";
import EmptyState from "../EmptyState";

const inputClass = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 focus:ring-1 focus:ring-leaf-500/20";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";

export default function SodiqlikPage() {
  const [rules, setRules] = useState<LoyaltyRule[]>(initialLoyaltyRules);
  const [settings, setSettings] = useState<LoyaltySettings>(initialLoyaltySettings);
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit" | "settings">("list");
  const [editItem, setEditItem] = useState<LoyaltyRule | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const stats = useMemo(() => {
    const activeRules = rules.filter((r) => r.active).length;
    return {
      totalRules: rules.length,
      activeRules,
      enabled: settings.enabled,
      pointValue: settings.pointValue,
    };
  }, [rules, settings]);

  const handleSaveRule = (data: Omit<LoyaltyRule, "id">) => {
    if (!data.name.trim()) {
      setFormError("Qoida nomi bo'sh bo'lishi mumkin emas");
      return;
    }
    if (editItem) {
      setRules((prev) => prev.map((r) => (r.id === editItem.id ? { ...editItem, ...data } : r)));
    } else {
      const newRule: LoyaltyRule = { id: `rule-${Date.now()}`, ...data };
      setRules((prev) => [newRule, ...prev]);
    }
    setPageMode("list");
    setEditItem(null);
    setFormError(null);
  };

  if (pageMode === "settings") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-cream-300">
          <button onClick={() => setPageMode("list")} className="p-2 rounded-lg hover:bg-cream-100" aria-label="Orqaga"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-forest-800">Sodiqlik dasturi sozlamalari</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setPageMode("list")} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">Bekor</button>
            <button onClick={() => setPageMode("list")} className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 text-forest-800 font-medium">Saqlash</button>
          </div>
        </div>

        <SettingsForm settings={settings} onUpdate={setSettings} />
      </div>
    );
  }

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-cream-300">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-cream-100" aria-label="Orqaga"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-forest-800">{editItem ? "Qoidani tahrirlash" : "Yangi qoida"}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">Bekor</button>
            <button form="rule-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 text-forest-800 font-medium">Saqlash</button>
          </div>
        </div>

        <RuleForm initial={editItem} error={formError} onSave={handleSaveRule} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-800">Sodiqlik dasturi</h1>
          <p className="text-sm text-slate-500 mt-1">Sodiqlik ballaini boshqaring va qoidalarni o'rnatish</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Jami qoidalar</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalRules}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Faol qoidalar</p>
            <p className="text-lg font-semibold text-forest-700">{stats.activeRules}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Ball qiymati</p>
            <p className="text-lg font-semibold text-forest-800">{stats.pointValue}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={() => setPageMode("settings")} className="px-4 py-2 rounded-lg text-sm bg-cream-100 hover:bg-cream-200 text-forest-800 font-medium">
          Sozlamalar
        </button>
        <button onClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-leaf-400 text-forest-800 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          Yangi qoida
        </button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        {rules.length === 0 ? (
          <div className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
            <EmptyState
              icon={Award}
              title="Sodiqlik qoidasi yarating"
              description="Hali sodiqlik dasturi qoidalari yaratilmagan. Xaridorlarga ball berish uchun birinchi qoidani yarating."
              buttonText="Yangi qoida"
              onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
              iconColor="text-amber-500"
            />
          </div>
        ) : (
          rules.map((r) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-cream-300 bg-white/50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-forest-800 mb-1">{r.name}</h3>
                  <p className="text-sm text-slate-500 mb-2">{r.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="px-2 py-1 rounded bg-cream-100">{loyaltyRuleTypeLabels[r.type]}</span>
                    <span className="px-2 py-1 rounded bg-cream-100">{r.pointsValue} ball</span>
                    {r.purchaseRate && <span className="px-2 py-1 rounded bg-cream-100">Har {r.purchaseRate} so'mda 1 ball</span>}
                    {r.minSpend && <span className="px-2 py-1 rounded bg-cream-100">Min: {r.minSpend.toLocaleString()} so'm</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${r.active ? "bg-leaf-100 text-forest-700" : "bg-cream-200/70 text-slate-500"}`}>
                    {r.active ? "Faol" : "O'chiq"}
                  </span>
                  <button onClick={() => { setEditItem(r); setPageMode("edit"); }} className="p-1.5 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => setPendingDelete(r.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-cream-100"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={() => setPendingDelete(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border border-cream-300 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-forest-800 font-medium mb-2">O'chirishni tasdiqlang</p>
              <p className="text-sm text-slate-500 mb-6">Bu amalni qaytarib bo'lmaydi.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">Bekor</button>
                <button onClick={() => { setRules((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-forest-800 font-medium">O'chirish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface RuleFormProps {
  initial: LoyaltyRule | null;
  error: string | null;
  onSave: (data: Omit<LoyaltyRule, "id">) => void;
}

function RuleForm({ initial, error, onSave }: RuleFormProps) {
  const [type, setType] = useState<LoyaltyRuleType>(initial?.type ?? "registration");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [pointsValue, setPointsValue] = useState(initial?.pointsValue ?? 0);
  const [purchaseRate, setPurchaseRate] = useState(initial?.purchaseRate ?? 0);
  const [minSpend, setMinSpend] = useState(initial?.minSpend ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ type, name, description, pointsValue, purchaseRate, minSpend, active });
  };

  return (
    <form id="rule-form" onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">Qoida ma'lumotlari</h3>
          <div>
            <label className={labelClass}>Qoida turi</label>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as LoyaltyRuleType)}>
              <option value="registration">Ro'yxatdan o'tish</option>
              <option value="purchase">Xarid uchun ballar</option>
              <option value="spend_goal">X sarfla, Y ol</option>
              <option value="review">Sharh yozish</option>
            </select>
            <p className="text-xs text-slate-500 mt-2">{loyaltyRuleTypeDescriptions[type]}</p>
          </div>
          <div>
            <label className={labelClass}>Qoida nomi</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Tavsifi</label>
            <textarea className={inputClass + " min-h-[100px]"} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">Ball qiymatlari</h3>
          <div>
            <label className={labelClass}>Ball qiymati</label>
            <input type="number" className={inputClass} value={pointsValue} onChange={(e) => setPointsValue(Number(e.target.value))} />
          </div>
          {(type === "purchase" || type === "spend_goal") && (
            <div>
              <label className={labelClass}>Xarid norma (so'mda)</label>
              <input type="number" className={inputClass} value={purchaseRate} onChange={(e) => setPurchaseRate(Number(e.target.value))} placeholder="Har qancha so'mda bir ball" />
            </div>
          )}
          {type === "spend_goal" && (
            <div>
              <label className={labelClass}>Minimum sarfash miqdori</label>
              <input type="number" className={inputClass} value={minSpend} onChange={(e) => setMinSpend(Number(e.target.value))} />
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">Holat</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="sr-only" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <div className={`w-5 h-5 rounded border ${active ? "bg-emerald-600 border-emerald-500" : "border-slate-600"}`}>
              {active && <div className="w-full h-full flex items-center justify-center text-forest-800 text-xs">✓</div>}
            </div>
            <span className="text-sm text-slate-700">Faol</span>
          </label>
          {error && <div className="rounded-lg border border-red-500/40 bg-rose-100 px-3 py-2 text-sm text-red-300">{error}</div>}
        </div>
      </div>
    </form>
  );
}

function SettingsForm({ settings, onUpdate }: { settings: LoyaltySettings; onUpdate: (s: LoyaltySettings) => void }) {
  return (
    <form className="grid grid-cols-3 gap-6">
      <div className="col-span-2">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">Umumiy sozlamalar</h3>
          <div>
            <label className={labelClass}>Ball qiymati (1 ball = ? so'm)</label>
            <input
              type="number"
              className={inputClass}
              value={settings.pointValue}
              onChange={(e) => onUpdate({ ...settings, pointValue: Number(e.target.value) })}
            />
            <p className="text-xs text-slate-500 mt-2">Mijozlar qancha so'mning o'rniga 1 ballni foydalana oladi</p>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">Dastur holati</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="sr-only" checked={settings.enabled} onChange={(e) => onUpdate({ ...settings, enabled: e.target.checked })} />
            <div className={`w-5 h-5 rounded border ${settings.enabled ? "bg-emerald-600 border-emerald-500" : "border-slate-600"}`}>
              {settings.enabled && <div className="w-full h-full flex items-center justify-center text-forest-800 text-xs">✓</div>}
            </div>
            <span className="text-sm text-slate-700">Dastur faol</span>
          </label>
        </div>
      </div>
    </form>
  );
}
