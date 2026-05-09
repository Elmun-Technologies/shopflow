import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Trophy } from "lucide-react";
import type { GiveawayContest, GiveawayStatus, GiveawayPrizeType, GiveawayAudience } from "../../data/marketingData";
import { initialGiveaways, giveawayStatusLabels, giveawayPrizeTypeLabels, giveawayAudienceLabels } from "../../data/marketingData";
import EmptyState from "../EmptyState";

const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-slate-200 border-t border-slate-800";

function GiveawayStatusBadge({ status }: { status: GiveawayStatus }) {
  const map: Record<GiveawayStatus, string> = {
    draft: "bg-slate-700 text-slate-300",
    active: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    ended: "bg-slate-700/50 text-slate-400",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{giveawayStatusLabels[status]}</span>;
}

export default function GiveawayPage() {
  const [contests, setContests] = useState<GiveawayContest[]>(initialGiveaways);
  const [search, setSearch] = useState("");
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");
  const [editItem, setEditItem] = useState<GiveawayContest | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contests.filter((c) => !q || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [contests, search]);

  const stats = useMemo(() => {
    const active = contests.filter((c) => c.status === "active").length;
    const totalParticipants = contests.reduce((s, c) => s + c.participantCount, 0);
    return {
      totalContests: contests.length,
      active,
      totalParticipants,
    };
  }, [contests]);

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-slate-800"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-white">{editItem ? "Giveawaytni tahrirlash" : "Yangi giveaway"}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Bekor</button>
            <button className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Saqlash</button>
          </div>
        </div>

        <GiveawayForm initial={editItem} error={formError} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Giveaway</h1>
          <p className="text-sm text-slate-500 mt-1">Giveaway va sovrinlar musobaqa</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Jami musobaqa</p>
            <p className="text-lg font-semibold text-white">{stats.totalContests}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Faol</p>
            <p className="text-lg font-semibold text-emerald-400">{stats.active}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Ishtirokchilar</p>
            <p className="text-lg font-semibold text-white">{stats.totalParticipants.toLocaleString()}</p>
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
          Yangi giveaway
        </button>
      </div>

      {contests.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <EmptyState
            icon={Trophy}
            title="Giveaway yarating"
            description="Hali giveaway musobaqa yaratilmagan. Xaridorlari jalb qilish uchun birinchi giveawayni yarating."
            buttonText="Yangi giveaway"
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-yellow-400"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full min-w-[850px]">
            <thead className="bg-slate-900/80">
              <tr>
                <th className={thClass}>Sarlavha</th>
                <th className={thClass}>Sovrin turi</th>
                <th className={thClass}>Miqdar</th>
                <th className={thClass}>Auditoriya</th>
                <th className={thClass}>Tugallanish</th>
                <th className={thClass}>Ishtirokchilar</th>
                <th className={thClass}>Holat</th>
                <th className={`${thClass} text-right`}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40">
                  <td className={tdClass + " font-medium"}>{c.title}</td>
                  <td className={tdClass + " text-xs"}>{giveawayPrizeTypeLabels[c.prizeType as GiveawayPrizeType]}</td>
                  <td className={tdClass}>{c.prizeCount}</td>
                  <td className={tdClass + " text-xs"}>{giveawayAudienceLabels[c.audience as GiveawayAudience]}</td>
                  <td className={tdClass + " text-xs text-slate-400"}>{c.endAt}</td>
                  <td className={tdClass}>{c.participantCount.toLocaleString()}</td>
                  <td className={tdClass}><GiveawayStatusBadge status={c.status} /></td>
                  <td className={tdClass + " text-right whitespace-nowrap"}>
                    <button onClick={() => { setEditItem(c); setPageMode("edit"); }} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(c.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
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
                <button onClick={() => { setContests((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-medium">O'chirish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GiveawayForm({ initial, error }: { initial: GiveawayContest | null; error: string | null }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [prizeType, setPrizeType] = useState<GiveawayPrizeType>(initial?.prizeType ?? "discount");
  const [prizeCount, setPrizeCount] = useState(initial?.prizeCount ?? 1);
  const [discountType, setDiscountType] = useState(initial?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? 0);
  const [productName, setProductName] = useState(initial?.productName ?? "");
  const [pointsAmount, setPointsAmount] = useState(initial?.pointsAmount ?? 0);
  const [audience, setAudience] = useState<GiveawayAudience>(initial?.audience ?? "all");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [status, setStatus] = useState<GiveawayStatus>(initial?.status ?? "draft");

  return (
    <form className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Giveaway ma'lumotlari</h3>
          <div>
            <label className={labelClass}>Sarlavha</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Tavsifi</label>
            <textarea className={inputClass + " min-h-[100px]"} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Auditoriya</label>
              <select className={inputClass} value={audience} onChange={(e) => setAudience(e.target.value as GiveawayAudience)}>
                <option value="all">Barcha foydalanuvchilar</option>
                <option value="new_subscribers">Faqat yangi obunachalar</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Tugallanish sanasi</label>
              <input type="date" className={inputClass} value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Sovrin ma'lumotlari</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Sovrin turi</label>
              <select className={inputClass} value={prizeType} onChange={(e) => setPrizeType(e.target.value as GiveawayPrizeType)}>
                <option value="discount">Chegirma</option>
                <option value="product">Mahsulot</option>
                <option value="points">Ballar</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Sovrin soni</label>
              <input type="number" className={inputClass} value={prizeCount} onChange={(e) => setPrizeCount(Number(e.target.value))} />
            </div>
          </div>

          {prizeType === "discount" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Chegirma turi</label>
                <select className={inputClass} value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                  <option value="percent">Foiz (%)</option>
                  <option value="fixed">Soʻm</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Chegirma miqdori</label>
                <input type="number" className={inputClass} value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
              </div>
            </div>
          )}

          {prizeType === "product" && (
            <div>
              <label className={labelClass}>Mahsulot nomi</label>
              <input className={inputClass} value={productName} onChange={(e) => setProductName(e.target.value)} />
            </div>
          )}

          {prizeType === "points" && (
            <div>
              <label className={labelClass}>Ball soni</label>
              <input type="number" className={inputClass} value={pointsAmount} onChange={(e) => setPointsAmount(Number(e.target.value))} />
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Holat</h3>
          <div>
            <label className={labelClass}>Statusi</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as GiveawayStatus)}>
              <option value="draft">Qoralama</option>
              <option value="active">Faol</option>
              <option value="ended">Tugagan</option>
            </select>
          </div>
          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        </div>
      </div>
    </form>
  );
}
