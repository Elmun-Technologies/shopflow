import { useId, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Image } from "lucide-react";
import type { MarketingBanner, BannerPlacement } from "../../data/marketingData";
import { initialBanners, bannerPlacementLabels } from "../../data/marketingData";
import EmptyState from "../EmptyState";
import { useT } from "../../i18n";

const inputClass = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 focus:ring-1 focus:ring-leaf-500/20";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-forest-700 border-t border-cream-300";

function CTRBadge({ impressions, clicks }: { impressions: number; clicks: number }) {
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0";
  return <span className="text-xs text-slate-700">{ctr}%</span>;
}

export default function BannerPage() {
  const { t } = useT();
  const [banners, setBanners] = useState<MarketingBanner[]>(initialBanners);
  const [search, setSearch] = useState("");
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");
  const [editItem, setEditItem] = useState<MarketingBanner | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return banners.filter((b) => !q || b.title.toLowerCase().includes(q));
  }, [banners, search]);

  const stats = useMemo(() => {
    const totalActive = banners.filter((b) => b.active).length;
    const totalImpressions = banners.reduce((s, b) => s + b.impressions, 0);
    const totalClicks = banners.reduce((s, b) => s + b.clicks, 0);
    return {
      totalBanners: banners.length,
      activeBanners: totalActive,
      impressions: totalImpressions,
      clicks: totalClicks,
    };
  }, [banners]);

  const handleSave = (data: Omit<MarketingBanner, "id" | "impressions" | "clicks">) => {
    if (!data.title.trim()) {
      setFormError(t("mkt.err.titleRequired"));
      return;
    }
    if (editItem) {
      setBanners((prev) => prev.map((b) => (b.id === editItem.id ? { ...editItem, ...data } : b)));
    } else {
      const newBanner: MarketingBanner = {
        id: `banner-${Date.now()}`,
        impressions: 0,
        clicks: 0,
        ...data,
      };
      setBanners((prev) => [newBanner, ...prev]);
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
          <h1 className="text-2xl font-bold text-forest-800">{editItem ? t("banner.editTitle") : t("banner.newTitle")}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
            <button form="banner-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 text-forest-800 font-medium">{t("common.save")}</button>
          </div>
        </div>

        <BannerForm initial={editItem} error={formError} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-800">{t("banner.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("banner.subtitle")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("banner.title")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalBanners}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("banner.stat.impressions")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.impressions.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("banner.stat.clicks")}</p>
            <p className="text-lg font-semibold text-forest-700">{stats.clicks.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.search")} className={inputClass + " pl-10"} />
        </div>
        <button onClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-leaf-400 text-forest-800 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          {t("banner.new")}
        </button>
      </div>

      {banners.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <EmptyState
            icon={Image}
            title={t("banner.empty.title")}
            description={t("banner.empty.desc")}
            buttonText={t("banner.new")}
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-orange-600"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <table className="w-full min-w-[800px]">
            <thead className="bg-white/80">
              <tr>
                <th className={thClass}>{t("banner.col.title")}</th>
                <th className={thClass}>{t("banner.col.placement")}</th>
                <th className={thClass}>{t("banner.stat.impressions")}</th>
                <th className={thClass}>{t("banner.stat.clicks")}</th>
                <th className={thClass}>{t("banner.col.ctr")}</th>
                <th className={thClass}>{t("mkt.col.status")}</th>
                <th className={`${thClass} text-right`}>{t("mkt.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-cream-100/40">
                  <td className={tdClass + " font-medium"}>{b.title}</td>
                  <td className={tdClass + " text-xs"}>{bannerPlacementLabels[b.placement as BannerPlacement]}</td>
                  <td className={tdClass}>{b.impressions.toLocaleString()}</td>
                  <td className={tdClass}>{b.clicks.toLocaleString()}</td>
                  <td className={tdClass}><CTRBadge impressions={b.impressions} clicks={b.clicks} /></td>
                  <td className={tdClass}><span className={`inline-block px-2 py-1 rounded text-xs font-medium ${b.active ? "bg-leaf-100 text-forest-700" : "bg-cream-200/70 text-slate-500"}`}>{b.active ? t("mkt.active") : t("mkt.inactive")}</span></td>
                  <td className={tdClass + " text-right whitespace-nowrap"}>
                    <button onClick={() => { setEditItem(b); setPageMode("edit"); }} className="p-1.5 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(b.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-cream-100"><Trash2 className="w-4 h-4" /></button>
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
                <button onClick={() => { setBanners((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-600 text-white font-medium">{t("common.delete")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface BannerFormProps {
  initial: MarketingBanner | null;
  error: string | null;
  onSave: (data: Omit<MarketingBanner, "id" | "impressions" | "clicks">) => void;
}

function BannerForm({ initial, error, onSave }: BannerFormProps) {
  const { t } = useT();
  const id = useId();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [placement, setPlacement] = useState<BannerPlacement>(initial?.placement ?? "home_hero");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [targetUrl, setTargetUrl] = useState(initial?.targetUrl ?? "");
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title, placement, imageUrl, targetUrl, startAt, endAt, active });
  };

  return (
    <form id="banner-form" onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("banner.form.section")}</h3>
          <div>
            <label htmlFor={`${id}-title`} className={labelClass}>{t("banner.col.title")}</label>
            <input id={`${id}-title`} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-placement`} className={labelClass}>{t("banner.col.placement")}</label>
            <select id={`${id}-placement`} className={inputClass} value={placement} onChange={(e) => setPlacement(e.target.value as BannerPlacement)}>
              <option value="home_hero">{t("banner.placement.homeHero")}</option>
              <option value="category_top">{t("banner.placement.categoryTop")}</option>
              <option value="cart_sidebar">{t("banner.placement.cartSidebar")}</option>
              <option value="checkout">{t("banner.placement.checkout")}</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-image`} className={labelClass}>{t("banner.form.imageUrl")}</label>
            <input id={`${id}-image`} className={inputClass} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label htmlFor={`${id}-target`} className={labelClass}>{t("banner.form.targetUrl")}</label>
            <input id={`${id}-target`} className={inputClass} value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("mkt.form.period")}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${id}-start`} className={labelClass}>{t("mkt.form.startDate")}</label>
              <input id={`${id}-start`} type="date" className={inputClass} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${id}-end`} className={labelClass}>{t("mkt.form.endDate")}</label>
              <input id={`${id}-end`} type="date" className={inputClass} value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("mkt.col.status")}</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="sr-only" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <div className={`w-5 h-5 rounded border ${active ? "bg-emerald-600 border-emerald-500" : "border-slate-600"}`}>
              {active && <div className="w-full h-full flex items-center justify-center text-forest-800 text-xs">✓</div>}
            </div>
            <span className="text-sm text-slate-700">{t("mkt.active")}</span>
          </label>
          {error && <div className="rounded-lg border border-red-500/40 bg-rose-100 px-3 py-2 text-sm text-red-300">{error}</div>}
        </div>
      </div>
    </form>
  );
}
