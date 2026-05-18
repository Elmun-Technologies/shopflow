import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Zap } from "lucide-react";
import type { MarketingSource } from "../../data/marketingData";
import { initialSources } from "../../data/marketingData";
import EmptyState from "../EmptyState";

const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-slate-200 border-t border-slate-800";

function ROIBadge({ spend, conversions }: { spend: number; conversions: number }) {
  const costPerConversion = spend > 0 && conversions > 0 ? (spend / conversions).toFixed(0) : "0";
  return <span className="text-xs text-slate-300">{costPerConversion} so'm/ta</span>;
}

export default function ManbaPage() {
  const [sources, setSources] = useState<MarketingSource[]>(initialSources);
  const [search, setSearch] = useState("");
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");
  const [editItem, setEditItem] = useState<MarketingSource | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sources.filter((s) => !q || s.name.toLowerCase().includes(q) || s.channel.toLowerCase().includes(q));
  }, [sources, search]);

  const stats = useMemo(() => {
    const activeCount = sources.filter((s) => s.active).length;
    const totalSpend = sources.reduce((s, src) => s + src.spendMonthly, 0);
    const totalConversions = sources.reduce((s, src) => s + src.conversions, 0);
    return {
      totalSources: sources.length,
      activeCount,
      totalSpend,
      totalConversions,
    };
  }, [sources]);

  const handleSave = (data: Omit<MarketingSource, "id">) => {
    if (!data.name.trim()) {
      setFormError("Manba nomi bo'sh bo'lishi mumkin emas");
      return;
    }
    if (editItem) {
      setSources((prev) => prev.map((s) => (s.id === editItem.id ? { ...editItem, ...data } : s)));
    } else {
      const newSource: MarketingSource = { id: `source-${Date.now()}`, ...data };
      setSources((prev) => [newSource, ...prev]);
    }
    setPageMode("list");
    setEditItem(null);
    setFormError(null);
  };

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Orqaga"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-white">{editItem ? "Manba tahrirlash" : "Yangi manba"}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Bekor</button>
            <button form="source-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Saqlash</button>
          </div>
        </div>

        <SourceForm initial={editItem} error={formError} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reklama manbalar</h1>
          <p className="text-sm text-slate-500 mt-1">Reklama manba va kanallarini boshqaring</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Jami manbalar</p>
            <p className="text-lg font-semibold text-white">{stats.totalSources}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Ushbu oy xaraji</p>
            <p className="text-lg font-semibold text-white">{stats.totalSpend.toLocaleString()} so'm</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Konversiyalar</p>
            <p className="text-lg font-semibold text-emerald-400">{stats.totalConversions}</p>
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
          Yangi manba
        </button>
      </div>

      {sources.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <EmptyState
            icon={Zap}
            title="Reklama manbasini qo'shing"
            description="Hali reklama manbasi qo'shilmagan. ROI takip qilish uchun birinchi manbani qo'shing."
            buttonText="Yangi manba"
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-yellow-400"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full min-w-[850px]">
            <thead className="bg-slate-900/80">
              <tr>
                <th className={thClass}>Manba nomi</th>
                <th className={thClass}>Kanal</th>
                <th className={thClass}>UTM source</th>
                <th className={thClass}>Ushbu oy xaraji</th>
                <th className={thClass}>Konversiyalar</th>
                <th className={thClass}>Narxi</th>
                <th className={thClass}>Holat</th>
                <th className={`${thClass} text-right`}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-800/40">
                  <td className={tdClass + " font-medium"}>{s.name}</td>
                  <td className={tdClass + " text-xs"}>{s.channel}</td>
                  <td className={tdClass + " text-xs font-mono text-slate-400"}>{s.utmSource}</td>
                  <td className={tdClass}>{s.spendMonthly.toLocaleString()} so'm</td>
                  <td className={tdClass}>{s.conversions}</td>
                  <td className={tdClass}><ROIBadge spend={s.spendMonthly} conversions={s.conversions} /></td>
                  <td className={tdClass}><span className={`inline-block px-2 py-1 rounded text-xs font-medium ${s.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/50 text-slate-400"}`}>{s.active ? "Faol" : "O'chiq"}</span></td>
                  <td className={tdClass + " text-right whitespace-nowrap"}>
                    <button onClick={() => { setEditItem(s); setPageMode("edit"); }} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(s.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
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
                <button onClick={() => { setSources((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-medium">O'chirish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SourceFormProps {
  initial: MarketingSource | null;
  error: string | null;
  onSave: (data: Omit<MarketingSource, "id">) => void;
}

function SourceForm({ initial, error, onSave }: SourceFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState(initial?.channel ?? "");
  const [utmSource, setUtmSource] = useState(initial?.utmSource ?? "");
  const [utmMedium, setUtmMedium] = useState(initial?.utmMedium ?? "");
  const [spendMonthly, setSpendMonthly] = useState(initial?.spendMonthly ?? 0);
  const [conversions, setConversions] = useState(initial?.conversions ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, channel, utmSource, utmMedium, spendMonthly, conversions, active });
  };

  return (
    <form id="source-form" onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Manba ma'lumotlari</h3>
          <div>
            <label className={labelClass}>Manba nomi</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Kanal/Platforma</label>
            <input className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Meta Ads, SEO, Telegram..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>UTM Source</label>
              <input className={inputClass} value={utmSource} onChange={(e) => setUtmSource(e.target.value)} placeholder="instagram, google..." />
            </div>
            <div>
              <label className={labelClass}>UTM Medium</label>
              <input className={inputClass} value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} placeholder="cpc, organic..." />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Natijalar</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ushbu oy xaraji (so'm)</label>
              <input type="number" className={inputClass} value={spendMonthly} onChange={(e) => setSpendMonthly(Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Konversiyalar</label>
              <input type="number" className={inputClass} value={conversions} onChange={(e) => setConversions(Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Holat</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="sr-only" checked={active} onChange={(e) => setActive(e.target.checked)} />
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
