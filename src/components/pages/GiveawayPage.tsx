import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Trophy } from "lucide-react";
import type { GiveawayContest, GiveawayStatus, GiveawayPrizeType, GiveawayAudience } from "../../data/marketingData";
import { initialGiveaways, giveawayStatusLabels, giveawayPrizeTypeLabels, giveawayAudienceLabels } from "../../data/marketingData";
import EmptyState from "../EmptyState";
import { useT } from "../../i18n";

const inputClass = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 focus:ring-1 focus:ring-leaf-500/20";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-forest-700 border-t border-cream-300";

function GiveawayStatusBadge({ status }: { status: GiveawayStatus }) {
  const map: Record<GiveawayStatus, string> = {
    draft: "bg-cream-200 text-slate-700",
    active: "bg-leaf-100 text-forest-700 border border-leaf-400/50",
    ended: "bg-cream-200/70 text-slate-500",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{giveawayStatusLabels[status]}</span>;
}

export default function GiveawayPage() {
  const { t } = useT();
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

  const handleSave = (data: Omit<GiveawayContest, "id" | "participantCount" | "createdAt">) => {
    if (!data.title.trim()) {
      setFormError(t("giveaway.err.titleRequired"));
      return;
    }
    if (editItem) {
      setContests((prev) => prev.map((c) => (c.id === editItem.id ? { ...editItem, ...data } : c)));
    } else {
      const newContest: GiveawayContest = {
        id: `giveaway-${Date.now()}`,
        participantCount: 0,
        createdAt: new Date().toISOString(),
        ...data,
      };
      setContests((prev) => [newContest, ...prev]);
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
          <h1 className="text-2xl font-bold text-forest-800">{editItem ? t("giveaway.edit") : t("giveaway.new")}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
            <button form="giveaway-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 text-forest-800 font-medium">{t("common.save")}</button>
          </div>
        </div>

        <GiveawayForm initial={editItem} error={formError} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-800">{t("giveaway.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("giveaway.subtitle")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("giveaway.stat.total")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalContests}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("mkt.active")}</p>
            <p className="text-lg font-semibold text-forest-700">{stats.active}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("giveaway.stat.participants")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalParticipants.toLocaleString()}</p>
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
          {t("giveaway.new")}
        </button>
      </div>

      {contests.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <EmptyState
            icon={Trophy}
            title={t("giveaway.empty.title")}
            description={t("giveaway.empty.desc")}
            buttonText={t("giveaway.new")}
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-cream-300"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <table className="w-full min-w-[850px]">
            <thead className="bg-white/80">
              <tr>
                <th className={thClass}>{t("giveaway.col.title")}</th>
                <th className={thClass}>{t("giveaway.col.prizeType")}</th>
                <th className={thClass}>{t("giveaway.col.amount")}</th>
                <th className={thClass}>{t("giveaway.col.audience")}</th>
                <th className={thClass}>{t("giveaway.col.endsAt")}</th>
                <th className={thClass}>{t("giveaway.col.participants")}</th>
                <th className={thClass}>{t("giveaway.col.status")}</th>
                <th className={`${thClass} text-right`}>{t("giveaway.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-cream-100/40">
                  <td className={tdClass + " font-medium"}>{c.title}</td>
                  <td className={tdClass + " text-xs"}>{giveawayPrizeTypeLabels[c.prizeType as GiveawayPrizeType]}</td>
                  <td className={tdClass}>{c.prizeCount}</td>
                  <td className={tdClass + " text-xs"}>{giveawayAudienceLabels[c.audience as GiveawayAudience]}</td>
                  <td className={tdClass + " text-xs text-slate-500"}>{c.endAt}</td>
                  <td className={tdClass}>{c.participantCount.toLocaleString()}</td>
                  <td className={tdClass}><GiveawayStatusBadge status={c.status} /></td>
                  <td className={tdClass + " text-right whitespace-nowrap"}>
                    <button onClick={() => { setEditItem(c); setPageMode("edit"); }} className="p-1.5 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(c.id)} className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-cream-100"><Trash2 className="w-4 h-4" /></button>
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
                <button onClick={() => { setContests((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-600 text-white font-medium">{t("common.delete")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface GiveawayFormProps {
  initial: GiveawayContest | null;
  error: string | null;
  onSave: (data: Omit<GiveawayContest, "id" | "participantCount" | "createdAt">) => void;
}

function GiveawayForm({ initial, error, onSave }: GiveawayFormProps) {
  const { t } = useT();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [prizeType, setPrizeType] = useState<GiveawayPrizeType>(initial?.prizeType ?? "discount");
  const [prizeCount, setPrizeCount] = useState(initial?.prizeCount ?? 1);
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(initial?.discountType ?? "percent");
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? 0);
  const [productName, setProductName] = useState(initial?.productName ?? "");
  const [pointsAmount, setPointsAmount] = useState(initial?.pointsAmount ?? 0);
  const [audience, setAudience] = useState<GiveawayAudience>(initial?.audience ?? "all");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [status, setStatus] = useState<GiveawayStatus>(initial?.status ?? "draft");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      prizeType,
      prizeCount,
      discountType: prizeType === "discount" ? discountType : undefined,
      discountValue: prizeType === "discount" ? discountValue : undefined,
      productName: prizeType === "product" ? productName : undefined,
      pointsAmount: prizeType === "points" ? pointsAmount : undefined,
      audience,
      endAt,
      status,
    });
  };

  return (
    <form id="giveaway-form" onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("giveaway.form.infoSection")}</h3>
          <div>
            <label className={labelClass}>{t("giveaway.col.title")}</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("giveaway.form.description")}</label>
            <textarea className={inputClass + " min-h-[100px]"} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("giveaway.col.audience")}</label>
              <select className={inputClass} value={audience} onChange={(e) => setAudience(e.target.value as GiveawayAudience)}>
                <option value="all">{t("giveaway.audience.all")}</option>
                <option value="new_subscribers">{t("giveaway.audience.newSubscribers")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("giveaway.form.endDate")}</label>
              <input type="date" className={inputClass} value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("giveaway.form.prizeSection")}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t("giveaway.col.prizeType")}</label>
              <select className={inputClass} value={prizeType} onChange={(e) => setPrizeType(e.target.value as GiveawayPrizeType)}>
                <option value="discount">{t("giveaway.prize.discount")}</option>
                <option value="product">{t("giveaway.prize.product")}</option>
                <option value="points">{t("giveaway.prize.points")}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t("giveaway.form.prizeCount")}</label>
              <input type="number" className={inputClass} value={prizeCount} onChange={(e) => setPrizeCount(Number(e.target.value))} />
            </div>
          </div>

          {prizeType === "discount" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t("giveaway.form.discountType")}</label>
                <select className={inputClass} value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}>
                  <option value="percent">{t("giveaway.discountType.percent")}</option>
                  <option value="fixed">{t("giveaway.discountType.fixed")}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t("giveaway.form.discountValue")}</label>
                <input type="number" className={inputClass} value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
              </div>
            </div>
          )}

          {prizeType === "product" && (
            <div>
              <label className={labelClass}>{t("giveaway.form.productName")}</label>
              <input className={inputClass} value={productName} onChange={(e) => setProductName(e.target.value)} />
            </div>
          )}

          {prizeType === "points" && (
            <div>
              <label className={labelClass}>{t("giveaway.form.pointsAmount")}</label>
              <input type="number" className={inputClass} value={pointsAmount} onChange={(e) => setPointsAmount(Number(e.target.value))} />
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("giveaway.col.status")}</h3>
          <div>
            <label className={labelClass}>{t("giveaway.form.statusLabel")}</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as GiveawayStatus)}>
              <option value="draft">{t("giveaway.status.draft")}</option>
              <option value="active">{t("mkt.active")}</option>
              <option value="ended">{t("giveaway.status.ended")}</option>
            </select>
          </div>
          {error && <div className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-600">{error}</div>}
        </div>
      </div>
    </form>
  );
}
