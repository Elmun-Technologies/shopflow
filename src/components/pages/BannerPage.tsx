import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Image } from "lucide-react";
import type { MarketingBanner, BannerPlacement } from "../../data/marketingData";
import { initialBanners, bannerPlacementLabels } from "../../data/marketingData";
import EmptyState from "../EmptyState";

const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-slate-200 border-t border-slate-800";

function CTRBadge({ impressions, clicks }: { impressions: number; clicks: number }) {
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : "0";
  return <span className="text-xs text-slate-300">{ctr}%</span>;
}

export default function BannerPage() {
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

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-slate-800"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-white">{editItem ? "Bannerni tahrirlash" : "Yangi banner"}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Bekor</button>
            <button className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Saqlash</button>
          </div>
        </div>

        <BannerForm initial={editItem} error={formError} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bannerlar</h1>
          <p className="text-sm text-slate-500 mt-1">Reklama bannerlarini boshqaring</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Bannerlar</p>
            <p className="text-lg font-semibold text-white">{stats.totalBanners}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Tashrif</p>
            <p className="text-lg font-semibold text-white">{stats.impressions.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Bostirishlar</p>
            <p className="text-lg font-semibold text-emerald-400">{stats.clicks.toLocaleString()}</p>
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
          Yangi banner
        </button>
      </div>

      {banners.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <EmptyState
            icon={Image}
            title="Banner yarating"
            description="Hali banner yaratilmagan. Reklama bannerlarini joylashtirish uchun birinchi bannerni yarating."
            buttonText="Yangi banner"
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-orange-400"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-900/80">
              <tr>
                <th className={thClass}>Sarlavha</th>
                <th className={thClass}>Joylashuvi</th>
                <th className={thClass}>Tashrif</th>
                <th className={thClass}>Bostirishlar</th>
                <th className={thClass}>CTR</th>
                <th className={thClass}>Holat</th>
                <th className={`${thClass} text-right`}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-slate-800/40">
                  <td className={tdClass + " font-medium"}>{b.title}</td>
                  <td className={tdClass + " text-xs"}>{bannerPlacementLabels[b.placement as BannerPlacement]}</td>
                  <td className={tdClass}>{b.impressions.toLocaleString()}</td>
                  <td className={tdClass}>{b.clicks.toLocaleString()}</td>
                  <td className={tdClass}><CTRBadge impressions={b.impressions} clicks={b.clicks} /></td>
                  <td className={tdClass}><span className={`inline-block px-2 py-1 rounded text-xs font-medium ${b.active ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700/50 text-slate-400"}`}>{b.active ? "Faol" : "O'chiq"}</span></td>
                  <td className={tdClass + " text-right whitespace-nowrap"}>
                    <button onClick={() => { setEditItem(b); setPageMode("edit"); }} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(b.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
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
                <button onClick={() => { setBanners((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-medium">O'chirish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BannerForm({ initial, error }: { initial: MarketingBanner | null; error: string | null }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [placement, setPlacement] = useState<BannerPlacement>(initial?.placement ?? "home_hero");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [targetUrl, setTargetUrl] = useState(initial?.targetUrl ?? "");
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  return (
    <form className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Banner ma'lumotlari</h3>
          <div>
            <label className={labelClass}>Sarlavha</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Joylashuvi</label>
            <select className={inputClass} value={placement} onChange={(e) => setPlacement(e.target.value as BannerPlacement)}>
              <option value="home_hero">Bosh sahifa (hero)</option>
              <option value="category_top">Kategoriya ustida</option>
              <option value="cart_sidebar">Savat yon panel</option>
              <option value="checkout">To'lov sahifasi</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Rasm URL</label>
            <input className={inputClass} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className={labelClass}>Maqsad URL</label>
            <input className={inputClass} value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Muddati</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Boshlang'ich sana</label>
              <input type="date" className={inputClass} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Tugallanish sanasi</label>
              <input type="date" className={inputClass} value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Holat</h3>
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
