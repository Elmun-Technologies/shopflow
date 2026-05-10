import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Gift } from "lucide-react";
import type { GiftPromotion, GiftConditionType } from "../../data/marketingData";
import { initialGiftPromotions } from "../../data/marketingData";
import EmptyState from "../EmptyState";
import { useShopSetting } from "../../lib/useShopSetting";

const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-slate-200 border-t border-slate-800";

function ProgressBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) return <span className="text-xs text-slate-400">Cheklovsiz</span>;
  const percent = Math.min((used / limit) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-slate-400">{used}/{limit}</span>
    </div>
  );
}

type GiftFormValues = Omit<GiftPromotion, "id" | "usedCount" | "createdAt">;

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}`;
}

export default function SovgalarPage() {
  const [gifts, setGifts] = useShopSetting<GiftPromotion[]>("marketing.gifts", initialGiftPromotions);
  const [search, setSearch] = useState("");
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");
  const [editItem, setEditItem] = useState<GiftPromotion | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function handleSave(values: GiftFormValues) {
    if (!values.name.trim()) { setFormError("Aksiya nomi kerak"); return; }
    if (!values.giftDescription.trim()) { setFormError("Sovg'a tavsifi kerak"); return; }
    if (editItem) {
      setGifts((prev) => prev.map((x) => (x.id === editItem.id ? { ...editItem, ...values } : x)));
    } else {
      setGifts((prev) => [{ id: newId("gift"), usedCount: 0, createdAt: new Date().toISOString().slice(0, 10), ...values }, ...prev]);
    }
    setPageMode("list");
    setEditItem(null);
    setFormError(null);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gifts.filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [gifts, search]);

  const stats = useMemo(() => {
    const totalActive = gifts.filter((g) => g.active).length;
    const totalUsed = gifts.reduce((s, g) => s + g.usedCount, 0);
    return {
      totalGifts: gifts.length,
      activeGifts: totalActive,
      totalUsed,
    };
  }, [gifts]);

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-slate-800"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-white">{editItem ? "Sovg'a tahrirlash" : "Yangi sovg'a aksiyasi"}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Bekor</button>
            <button form="gift-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Saqlash</button>
          </div>
        </div>

        <GiftForm initial={editItem} error={formError} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sovg'alar aksiyasi</h1>
          <p className="text-sm text-slate-500 mt-1">Sovg'a aksiyalarini boshqaring</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Aksiyalar</p>
            <p className="text-lg font-semibold text-white">{stats.totalGifts}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Faol</p>
            <p className="text-lg font-semibold text-emerald-400">{stats.activeGifts}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Foydalanildi</p>
            <p className="text-lg font-semibold text-white">{stats.totalUsed}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish..." className={inputClass + " pl-10"} />
        </div>
        <button onClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          Yangi sovg'a
        </button>
      </div>

      {gifts.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <EmptyState
            icon={Gift}
            title="Sovg'a aksiyasi yarating"
            description="Hali sovg'a aksiyasi yaratilmagan. Xaridorlarga sovg'a berish uchun birinchi aksiyani yarating."
            buttonText="Yangi sovg'a"
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-pink-400"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-900/80">
              <tr>
                <th className={thClass}>Nomi</th>
                <th className={thClass}>Shart</th>
                <th className={thClass}>Sovg'a</th>
                <th className={thClass}>Foydalanish</th>
                <th className={thClass}>Muddati</th>
                <th className={thClass}>Holat</th>
                <th className={`${thClass} text-right`}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="hover:bg-slate-800/40">
                  <td className={tdClass + " font-medium"}>{g.name}</td>
                  <td className={tdClass + " text-xs"}>{g.conditionType === "quantity" ? `${g.conditionValue} ta mahsulot` : `${g.conditionValue.toLocaleString()} so'm`}</td>
                  <td className={tdClass + " text-xs"}>{g.giftDescription}</td>
                  <td className={tdClass}><ProgressBar used={g.usedCount} limit={g.usageLimit} /></td>
                  <td className={tdClass + " text-xs text-slate-400"}>{g.endAt}</td>
                  <td className={tdClass}><span className={`inline-block px-2 py-1 rounded text-xs font-medium ${g.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/50 text-slate-400"}`}>{g.active ? "Faol" : "O'chiq"}</span></td>
                  <td className={tdClass + " text-right whitespace-nowrap space-x-1"}>
                    <button onClick={() => { setEditItem(g); setPageMode("edit"); }} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(g.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
        </motion.div>
      )}

      <AnimatePresence>
        {pendingDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={() => setPendingDelete(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-white font-medium mb-2">O'chirishni tasdiqlang</p>
              <p className="text-sm text-slate-400 mb-6">Bu amalni qaytarib bo'lmaydi.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Bekor</button>
                <button onClick={() => { setGifts((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-medium">O'chirish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GiftForm({ initial, error, onSave }: { initial: GiftPromotion | null; error: string | null; onSave: (v: GiftFormValues) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [conditionType, setConditionType] = useState<GiftConditionType>(initial?.conditionType ?? "quantity");
  const [conditionValue, setConditionValue] = useState(initial?.conditionValue ?? 0);
  const [triggerProducts, setTriggerProducts] = useState(initial?.triggerProducts.join(", ") ?? "");
  const [giftDescription, setGiftDescription] = useState(initial?.giftDescription ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? 1);
  const [usageLimit, setUsageLimit] = useState<number | null>(initial?.usageLimit ?? 0);
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  return (
    <form id="gift-form" onSubmit={(e) => { e.preventDefault(); onSave({ name, description, conditionType, conditionValue, triggerProducts: triggerProducts.split(",").map((s) => s.trim()).filter(Boolean), giftDescription, priority, usageLimit, startAt, endAt, active }); }} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Aksiya ma'lumotlari</h3>
          <div>
            <label className={labelClass}>Aksiya nomi</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Tavsifi</label>
            <textarea className={inputClass + " min-h-[100px]"} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Shart turi</label>
              <select className={inputClass} value={conditionType} onChange={(e) => setConditionType(e.target.value as GiftConditionType)}>
                <option value="quantity">Mahsulot soni</option>
                <option value="amount">Xarid summasi</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Shart qiymati</label>
              <input type="number" className={inputClass} value={conditionValue} onChange={(e) => setConditionValue(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Triggerlovchi mahsulotlar (vergul bilan ajratilgan)</label>
            <input className={inputClass} value={triggerProducts} onChange={(e) => setTriggerProducts(e.target.value)} placeholder="Smartfon, Noutbuk" />
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Sovg'a ma'lumotlari</h3>
          <div>
            <label className={labelClass}>Sovg'a tavsifi</label>
            <input className={inputClass} value={giftDescription} onChange={(e) => setGiftDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Muddati (boshlang'ich)</label>
              <input type="date" className={inputClass} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Muddati (tugallanish)</label>
              <input type="date" className={inputClass} value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Sozlamalar</h3>
          <div>
            <label className={labelClass}>Prioritet</label>
            <input type="number" className={inputClass} value={priority} onChange={(e) => setPriority(Number(e.target.value))} min="1" />
          </div>
          <div>
            <label className={labelClass}>Foydalanish cheklovi</label>
            <input type="number" className={inputClass} value={usageLimit ?? ""} onChange={(e) => setUsageLimit(e.target.value === "" ? null : Number(e.target.value))} placeholder="Bo'sh = cheklovsiz" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer" onClick={() => setActive((v) => !v)}>
            <div className={`w-5 h-5 rounded border ${active ? "bg-emerald-600 border-emerald-500" : "border-slate-600"}`}>
              {active && <div className="w-full h-full flex items-center justify-center text-white text-xs">✓</div>}
            </div>
            <span className="text-sm text-slate-300">Faol</span>
          </label>
          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        </div>
      </div>
    </form>
  );
}
