import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Zap } from "lucide-react";
import type { MarketingSource } from "../../data/marketingData";
import { initialSources } from "../../data/marketingData";
import EmptyState from "../EmptyState";
import { useT } from "../../i18n";

const inputClass = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 focus:ring-1 focus:ring-leaf-500/20";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-forest-700 border-t border-cream-300";

function ROIBadge({ spend, conversions }: { spend: number; conversions: number }) {
  const { t } = useT();
  const costPerConversion = spend > 0 && conversions > 0 ? (spend / conversions).toFixed(0) : "0";
  return <span className="text-xs text-slate-700">{t("manba.costPerConv", { value: costPerConversion })}</span>;
}

export default function ManbaPage() {
  const { t } = useT();
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
      setFormError(t("manba.err.nameRequired"));
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
        <div className="flex items-center gap-4 pb-4 border-b border-cream-300">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-cream-100" aria-label={t("common.back")}><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-forest-800">{editItem ? t("manba.editTitle") : t("manba.newTitle")}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
            <button form="source-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 text-forest-800 font-medium">{t("common.save")}</button>
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
          <h1 className="text-2xl font-bold text-forest-800">{t("manba.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("manba.subtitle")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("manba.stat.total")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalSources}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("manba.spendMonthly")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalSpend.toLocaleString()} {t("mkt.sum")}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("manba.conversions")}</p>
            <p className="text-lg font-semibold text-forest-700">{stats.totalConversions}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.search")} className={inputClass + " pl-10"} />
        </div>
        <button onClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-leaf-400 hover:bg-leaf-500 text-forest-800 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          {t("manba.new")}
        </button>
      </div>

      {sources.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <EmptyState
            icon={Zap}
            title={t("manba.empty.title")}
            description={t("manba.empty.desc")}
            buttonText={t("manba.new")}
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-cream-300"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <table className="w-full min-w-[850px]">
            <thead className="bg-white/80">
              <tr>
                <th className={thClass}>{t("manba.col.name")}</th>
                <th className={thClass}>{t("manba.col.channel")}</th>
                <th className={thClass}>{t("manba.col.utmSource")}</th>
                <th className={thClass}>{t("manba.spendMonthly")}</th>
                <th className={thClass}>{t("manba.conversions")}</th>
                <th className={thClass}>{t("manba.col.cost")}</th>
                <th className={thClass}>{t("mkt.col.status")}</th>
                <th className={`${thClass} text-right`}>{t("mkt.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-cream-100/40">
                  <td className={tdClass + " font-medium"}>{s.name}</td>
                  <td className={tdClass + " text-xs"}>{s.channel}</td>
                  <td className={tdClass + " text-xs font-mono text-slate-500"}>{s.utmSource}</td>
                  <td className={tdClass}>{s.spendMonthly.toLocaleString()} {t("mkt.sum")}</td>
                  <td className={tdClass}>{s.conversions}</td>
                  <td className={tdClass}><ROIBadge spend={s.spendMonthly} conversions={s.conversions} /></td>
                  <td className={tdClass}><span className={`inline-block px-2 py-1 rounded text-xs font-medium ${s.active ? "bg-leaf-100 text-forest-700" : "bg-cream-200/70 text-slate-500"}`}>{s.active ? t("mkt.active") : t("mkt.inactive")}</span></td>
                  <td className={tdClass + " text-right whitespace-nowrap"}>
                    <button onClick={() => { setEditItem(s); setPageMode("edit"); }} className="p-1.5 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(s.id)} className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-cream-100"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">{t("mkt.noData")}</div>}
        </motion.div>
      )}

      <AnimatePresence>
        {pendingDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={() => setPendingDelete(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border border-cream-300 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-forest-800 font-medium mb-2">{t("mkt.confirmDelete.title")}</p>
              <p className="text-sm text-slate-500 mb-6">{t("mkt.confirmDelete.body")}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
                <button onClick={() => { setSources((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-600 text-white font-medium">{t("common.delete")}</button>
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
  const { t } = useT();
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
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("manba.form.section")}</h3>
          <div>
            <label className={labelClass}>{t("manba.col.name")}</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("manba.form.channel")}</label>
            <input className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Meta Ads, SEO, Telegram..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("manba.form.utmSource")}</label>
              <input className={inputClass} value={utmSource} onChange={(e) => setUtmSource(e.target.value)} placeholder="instagram, google..." />
            </div>
            <div>
              <label className={labelClass}>{t("manba.form.utmMedium")}</label>
              <input className={inputClass} value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} placeholder="cpc, organic..." />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("manba.form.results")}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("manba.form.spendMonthly")}</label>
              <input type="number" className={inputClass} value={spendMonthly} onChange={(e) => setSpendMonthly(Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>{t("manba.conversions")}</label>
              <input type="number" className={inputClass} value={conversions} onChange={(e) => setConversions(Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("mkt.col.status")}</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="sr-only" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <div className={`w-5 h-5 rounded border ${active ? "bg-leaf-400 border-leaf-500" : "border-slate-300"}`}>
              {active && <div className="w-full h-full flex items-center justify-center text-forest-800 text-xs">✓</div>}
            </div>
            <span className="text-sm text-slate-700">{t("mkt.active")}</span>
          </label>
          {error && <div className="rounded-lg border border-red-200 bg-red-100 px-3 py-2 text-sm text-red-600">{error}</div>}
        </div>
      </div>
    </form>
  );
}
