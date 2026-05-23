import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Gift } from "lucide-react";
import type { GiftPromotion, GiftConditionType } from "../../data/marketingData";
import { initialGiftPromotions } from "../../data/marketingData";
import EmptyState from "../EmptyState";

const inputClass = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 focus:ring-1 focus:ring-leaf-500/20";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-forest-700 border-t border-cream-300";

function ProgressBar({ used, limit }: { used: number; limit: number | null }) {
  if (!limit) return <span className="text-xs text-slate-500">Cheklovsiz</span>;
  const percent = Math.min((used / limit) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-cream-200 rounded-full overflow-hidden">
        <div className="h-full bg-leaf-400" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-slate-500">{used}/{limit}</span>
    </div>
  );
}

export default function SovgalarPage() {
  const [gifts, setGifts] = useState<GiftPromotion[]>(initialGiftPromotions);
  const [search, setSearch] = useState("");
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");
  const [editItem, setEditItem] = useState<GiftPromotion | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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

  const handleSave = (data: Omit<GiftPromotion, "id" | "usedCount" | "createdAt">) => {
    if (!data.name.trim()) {
      setFormError("Aksiya nomi bo'sh bo'lishi mumkin emas");
      return;
    }
    if (editItem) {
      setGifts((prev) => prev.map((g) => (g.id === editItem.id ? { ...editItem, ...data } : g)));
    } else {
      const newGift: GiftPromotion = {
        id: `gift-${Date.now()}`,
        usedCount: 0,
        createdAt: new Date().toISOString(),
        ...data,
      };
      setGifts((prev) => [newGift, ...prev]);
    }
    setPageMode("list");
    setEditItem(null);
    setFormError(null);
  };

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-cream-300">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-cream-100" aria-label="Orqaga"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-forest-800">{editItem ? "Sovg'a tahrirlash" : "Yangi sovg'a aksiyasi"}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">Bekor</button>
            <button form="gift-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 text-forest-800 font-medium">Saqlash</button>
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
          <h1 className="text-2xl font-bold text-forest-800">Sovg'alar aksiyasi</h1>
          <p className="text-sm text-slate-500 mt-1">Sovg'a aksiyalarini boshqaring</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Aksiyalar</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalGifts}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Faol</p>
            <p className="text-lg font-semibold text-forest-700">{stats.activeGifts}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Foydalanildi</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalUsed}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish..." className={inputClass + " pl-10"} />
        </div>
        <button onClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-leaf-400 text-forest-800 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          Yangi sovg'a
        </button>
      </div>

      {gifts.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <EmptyState
            icon={Gift}
            title="Sovg'a aksiyasi yarating"
            description="Hali sovg'a aksiyasi yaratilmagan. Xaridorlarga sovg'a berish uchun birinchi aksiyani yarating."
            buttonText="Yangi sovg'a"
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-pink-600"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <table className="w-full min-w-[900px]">
            <thead className="bg-white/80">
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
                <tr key={g.id} className="hover:bg-cream-100/40">
                  <td className={tdClass + " font-medium"}>{g.name}</td>
                  <td className={tdClass + " text-xs"}>{g.conditionType === "quantity" ? `${g.conditionValue} ta mahsulot` : `${g.conditionValue.toLocaleString()} so'm`}</td>
                  <td className={tdClass + " text-xs"}>{g.giftDescription}</td>
                  <td className={tdClass}><ProgressBar used={g.usedCount} limit={g.usageLimit} /></td>
                  <td className={tdClass + " text-xs text-slate-500"}>{g.endAt}</td>
                  <td className={tdClass}><span className={`inline-block px-2 py-1 rounded text-xs font-medium ${g.active ? "bg-leaf-100 text-forest-700" : "bg-cream-200/70 text-slate-500"}`}>{g.active ? "Faol" : "O'chiq"}</span></td>
                  <td className={tdClass + " text-right whitespace-nowrap space-x-1"}>
                    <button onClick={() => { setEditItem(g); setPageMode("edit"); }} className="p-1.5 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(g.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-cream-100"><Trash2 className="w-4 h-4" /></button>
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
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border border-cream-300 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-forest-800 font-medium mb-2">O'chirishni tasdiqlang</p>
              <p className="text-sm text-slate-500 mb-6">Bu amalni qaytarib bo'lmaydi.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">Bekor</button>
                <button onClick={() => { setGifts((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-forest-800 font-medium">O'chirish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface GiftFormProps {
  initial: GiftPromotion | null;
  error: string | null;
  onSave: (data: Omit<GiftPromotion, "id" | "usedCount" | "createdAt">) => void;
}

function GiftForm({ initial, error, onSave }: GiftFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [conditionType, setConditionType] = useState<GiftConditionType>(initial?.conditionType ?? "quantity");
  const [conditionValue, setConditionValue] = useState(initial?.conditionValue ?? 0);
  const [triggerProducts, setTriggerProducts] = useState(initial?.triggerProducts.join(", ") ?? "");
  const [giftDescription, setGiftDescription] = useState(initial?.giftDescription ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? 1);
  const [usageLimit, setUsageLimit] = useState<number | null>(initial?.usageLimit ?? null);
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description,
      conditionType,
      conditionValue,
      triggerProducts: triggerProducts.split(",").map((s) => s.trim()).filter(Boolean),
      giftDescription,
      priority,
      usageLimit,
      startAt,
      endAt,
      active,
    });
  };

  return (
    <form id="gift-form" onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">Aksiya ma'lumotlari</h3>
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
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">Sovg'a ma'lumotlari</h3>
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
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">Sozlamalar</h3>
          <div>
            <label className={labelClass}>Prioritet</label>
            <input type="number" className={inputClass} value={priority} onChange={(e) => setPriority(Number(e.target.value))} min="1" />
          </div>
          <div>
            <label className={labelClass}>Foydalanish cheklovi</label>
            <input type="number" className={inputClass} value={usageLimit ?? ""} onChange={(e) => setUsageLimit(e.target.value === "" ? null : Number(e.target.value))} placeholder="Bo'sh = cheklovsiz" />
          </div>
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
