// Mahsulot sharhlari moderatsiya sahifasi.
// - PENDING/APPROVED/REJECTED filter tablari
// - Photos display (card + detail modal)
// - Reject reason input (modal + textarea)
// - Bulk moderation — bir vaqtda 10+ sharhni approve/reject qilish
// - Delete (faqat OWNER/ADMIN — UI darajada cheklov yo'q, server tekshiradi)

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, X, Star, MessageSquare, Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import EmptyState from "../EmptyState";
import { api } from "../../api/client";
import { useAppToast } from "../ui/Toast";
import { useConfirm } from "../ui/ConfirmDialog";
import { useT } from "../../i18n";

interface ApiReview {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  customerId: string | null;
  customerName: string;
  rating: number;
  text: string;
  photos: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  moderatedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
}

interface ApiStats {
  avgRating: number;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

type Filter = "all" | "PENDING" | "APPROVED" | "REJECTED";

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${cls} ${i < rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ApiReview["status"] }) {
  const { t } = useT();
  const map: Record<ApiReview["status"], { cls: string; labelKey: string }> = {
    PENDING: { cls: "bg-amber-100 text-amber-700 border-amber-300", labelKey: "reviews.status.pending" },
    APPROVED: { cls: "bg-leaf-100 text-forest-700 border-leaf-400/50", labelKey: "reviews.status.approved" },
    REJECTED: { cls: "bg-red-100 text-red-600 border-red-300", labelKey: "reviews.status.rejected" },
  };
  const { cls, labelKey } = map[status];
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>{t(labelKey)}</span>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" });
}

export default function IzohlarPage() {
  const { t } = useT();
  const toast = useAppToast();
  const confirm = useConfirm();
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<Filter>("PENDING");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<ApiReview | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const reload = async () => {
    try {
      const res = await api<{ items: ApiReview[]; stats: ApiStats }>("/reviews");
      setReviews(res.items);
      setStats(res.stats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reviews.loadFailed"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      const matchSearch =
        !q ||
        r.customerName.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.text.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [reviews, search, filterStatus]);

  const moderate = async (id: string, status: "APPROVED" | "REJECTED", reason?: string) => {
    setBusyId(id);
    try {
      await api(`/reviews/${id}`, {
        method: "PATCH",
        body: status === "REJECTED" ? { status, rejectReason: reason ?? null } : { status },
      });
      toast.success(status === "APPROVED" ? t("reviews.approved") : t("reviews.rejected"));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: t("reviews.deleteConfirm.title"),
      description: t("reviews.deleteConfirm.body"),
      kind: "danger",
      confirmText: t("common.delete"),
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api(`/reviews/${id}`, { method: "DELETE" });
      toast.success(t("reviews.deleted"));
      setDetail(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectingId) return;
    await moderate(rejectingId, "REJECTED", rejectReason || undefined);
    setRejectingId(null);
    setRejectReason("");
    setDetail(null);
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      const visibleIds = filtered.map((r) => r.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const bulkModerate = async (status: "APPROVED" | "REJECTED") => {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: status === "APPROVED"
        ? t("reviews.bulkConfirm.approveTitle", { count: selected.size })
        : t("reviews.bulkConfirm.rejectTitle", { count: selected.size }),
      description: status === "APPROVED"
        ? t("reviews.bulkConfirm.approveBody")
        : t("reviews.bulkConfirm.rejectBody"),
      confirmText: status === "APPROVED" ? t("reviews.approve") : t("reviews.reject"),
      kind: status === "REJECTED" ? "danger" : "default",
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      // Backend'da hozircha bulk endpoint yo'q — har birini ketma-ket so'raymiz
      const ids = Array.from(selected);
      await Promise.all(
        ids.map((id) =>
          api(`/reviews/${id}`, { method: "PATCH", body: { status } }).catch(() => null),
        ),
      );
      toast.success(status === "APPROVED"
        ? t("reviews.bulkApproved", { count: ids.length })
        : t("reviews.bulkRejected", { count: ids.length }));
      setSelected(new Set());
      await reload();
    } finally {
      setBulkBusy(false);
    }
  };

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const someVisibleSelected = filtered.some((r) => selected.has(r.id));

  const statBoxes = stats
    ? [
        { label: t("reviews.stat.avgRating"), value: stats.total > 0 ? stats.avgRating.toFixed(1) + "★" : "—", color: "text-amber-500" },
        { label: t("reviews.status.pending"), value: stats.pending, color: "text-amber-600" },
        { label: t("reviews.status.approved"), value: stats.approved, color: "text-forest-700" },
        { label: t("reviews.status.rejected"), value: stats.rejected, color: "text-red-600" },
      ]
    : [];

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: "PENDING", label: t("reviews.status.pending"), count: stats?.pending },
    { key: "APPROVED", label: t("reviews.status.approved"), count: stats?.approved },
    { key: "REJECTED", label: t("reviews.status.rejected"), count: stats?.rejected },
    { key: "all", label: t("reviews.tab.all"), count: stats?.total },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-800">{t("reviews.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("reviews.subtitle")}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
          {statBoxes.map((s) => (
            <div key={s.label} className="rounded-xl bg-white border border-cream-300 px-3 py-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</p>
              <p className={`text-lg font-semibold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("reviews.searchPlaceholder")}
            className="w-full bg-white border border-cream-300 rounded-lg px-3 py-2 pl-10 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setFilterStatus(tab.key); setSelected(new Set()); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filterStatus === tab.key
                  ? "bg-leaf-400 text-forest-800"
                  : "bg-white border border-cream-300 text-slate-600 hover:text-forest-900"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  filterStatus === tab.key ? "bg-forest-700/15 text-forest-800" : "bg-cream-200 text-slate-500"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 px-3 py-2 bg-leaf-100 border border-leaf-300/60 rounded-xl"
        >
          <span className="text-sm font-medium text-forest-800 mr-1">
            {t("reviews.selectedCount", { count: selected.size })}
          </span>
          <button
            onClick={() => bulkModerate("APPROVED")}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-xs font-medium text-forest-800 transition-colors"
          >
            {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {t("reviews.approve")}
          </button>
          <button
            onClick={() => bulkModerate("REJECTED")}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 border border-red-300 disabled:opacity-50 rounded-lg text-xs font-medium text-red-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {t("reviews.reject")}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-forest-900"
          >
            {t("common.cancel")}
          </button>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            {t("common.loading")}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={t("reviews.empty.title")}
            description={t("reviews.empty.description")}
            buttonText={t("reviews.clearFilter")}
            onButtonClick={() => { setSearch(""); setFilterStatus("all"); }}
            iconColor="text-cream-300"
          />
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">{t("mkt.noData")}</div>
        ) : (
          <div>
            {filtered.length > 1 && (
              <div className="flex items-center gap-2 px-4 py-2 border-b border-cream-300 bg-cream-100/40">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => { if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected; }}
                  onChange={toggleAll}
                  aria-label={t("reviews.selectAll")}
                  className="w-4 h-4 rounded border-cream-300 text-leaf-500 cursor-pointer"
                />
                <span className="text-xs text-slate-500">{t("reviews.selectAll")}</span>
              </div>
            )}
            <div className="divide-y divide-cream-300/60">
              {filtered.map((r) => {
                const isSelected = selected.has(r.id);
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-3 p-4 transition-colors cursor-pointer ${
                      isSelected ? "bg-leaf-100/30" : "hover:bg-cream-100/40"
                    }`}
                    onClick={() => setDetail(r)}
                  >
                    <div className="flex items-start pt-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(r.id)}
                        aria-label={r.customerName}
                        className="w-4 h-4 rounded border-cream-300 text-leaf-500 cursor-pointer"
                      />
                    </div>
                    {r.productImage ? (
                      <img src={r.productImage} alt={r.productName} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-cream-100 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-5 h-5 text-cream-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-medium text-forest-800 text-sm">{r.customerName}</h4>
                        <StarRating rating={r.rating} />
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-slate-500 truncate mb-1">{r.productName}</p>
                      <p className="text-sm text-slate-700 line-clamp-2">{r.text}</p>
                      {r.photos.length > 0 && (
                        <div className="flex gap-1.5 mt-2">
                          {r.photos.slice(0, 4).map((p, i) => (
                            <img key={i} src={p} alt="" className="w-10 h-10 rounded object-cover border border-cream-300" />
                          ))}
                          {r.photos.length > 4 && (
                            <div className="w-10 h-10 rounded bg-cream-100 border border-cream-300 flex items-center justify-center text-[10px] text-slate-500">
                              +{r.photos.length - 4}
                            </div>
                          )}
                        </div>
                      )}
                      {r.status === "REJECTED" && r.rejectReason && (
                        <p className="text-[11px] text-red-600 mt-1.5 italic">{t("reviews.reasonLabel")}: {r.rejectReason}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-2">{formatDate(r.createdAt)}</p>
                    </div>
                    {r.status === "PENDING" && (
                      <div className="flex flex-col sm:flex-row gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => moderate(r.id, "APPROVED")}
                          disabled={busyId === r.id}
                          className="p-2 rounded-lg bg-leaf-100 text-forest-700 hover:bg-leaf-200 disabled:opacity-50"
                          title={t("reviews.approve")}
                        >
                          {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => { setRejectingId(r.id); setRejectReason(""); }}
                          disabled={busyId === r.id}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
                          title={t("reviews.reject")}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              className="bg-white border border-cream-300 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4 gap-3">
                <div className="flex gap-3 min-w-0">
                  {detail.productImage && (
                    <img src={detail.productImage} alt={detail.productName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-forest-800 truncate">{detail.customerName}</h3>
                    <p className="text-sm text-slate-500 truncate">{detail.productName}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <StarRating rating={detail.rating} size="md" />
                      <StatusBadge status={detail.status} />
                    </div>
                  </div>
                </div>
                <button onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-cream-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-slate-700 mb-4 whitespace-pre-wrap">{detail.text}</p>

              {detail.photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
                  {detail.photos.map((p, i) => (
                    <a key={i} href={p} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-cream-300 hover:opacity-90 transition-opacity">
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {detail.status === "REJECTED" && detail.rejectReason && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-xs font-medium text-red-700 mb-1">{t("reviews.rejectReasonTitle")}</p>
                  <p className="text-sm text-red-600">{detail.rejectReason}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-4 border-t border-cream-300">
                <p className="text-xs text-slate-500">
                  {t("reviews.createdAt")}: {formatDate(detail.createdAt)}
                  {detail.moderatedAt && (
                    <> · {t("reviews.moderatedAt")}: {formatDate(detail.moderatedAt)}</>
                  )}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => remove(detail.id)}
                    disabled={busyId === detail.id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-cream-100 hover:bg-red-100 text-slate-600 hover:text-red-600 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t("common.delete")}
                  </button>
                  {detail.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => { setRejectingId(detail.id); setRejectReason(""); }}
                        disabled={busyId === detail.id}
                        className="px-3 py-2 rounded-lg text-sm bg-red-100 text-red-600 hover:bg-red-200 border border-red-300 disabled:opacity-50 font-medium"
                      >
                        {t("reviews.reject")}
                      </button>
                      <button
                        onClick={() => { moderate(detail.id, "APPROVED"); setDetail(null); }}
                        disabled={busyId === detail.id}
                        className="px-3 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 font-medium"
                      >
                        {busyId === detail.id ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t("reviews.approve")}
                      </button>
                    </>
                  )}
                  {detail.status === "REJECTED" && (
                    <button
                      onClick={() => { moderate(detail.id, "APPROVED"); setDetail(null); }}
                      disabled={busyId === detail.id}
                      className="px-3 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 font-medium"
                    >
                      {t("reviews.approve")}
                    </button>
                  )}
                  {detail.status === "APPROVED" && (
                    <button
                      onClick={() => { setRejectingId(detail.id); setRejectReason(""); }}
                      disabled={busyId === detail.id}
                      className="px-3 py-2 rounded-lg text-sm bg-red-100 text-red-600 hover:bg-red-200 border border-red-300 disabled:opacity-50 font-medium"
                    >
                      {t("reviews.reject")}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject reason modal */}
      <AnimatePresence>
        {rejectingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60"
            onClick={() => setRejectingId(null)}
          >
            <motion.div
              initial={{ scale: 0.96 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.96 }}
              className="bg-white border border-cream-300 rounded-2xl p-5 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-forest-800 mb-2">{t("reviews.rejectModalTitle")}</h3>
              <p className="text-sm text-slate-500 mb-3">
                {t("reviews.rejectModalHint")}
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("reviews.rejectModalPlaceholder")}
                rows={4}
                maxLength={500}
                autoFocus
                className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 resize-none"
              />
              <p className="text-[10px] text-slate-400 mt-1 text-right">{rejectReason.length}/500</p>
              <div className="flex gap-2 justify-end mt-3">
                <button
                  onClick={() => { setRejectingId(null); setRejectReason(""); }}
                  className="px-3 py-2 rounded-lg text-sm bg-cream-100 hover:bg-cream-200 text-slate-700"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={submitReject}
                  disabled={busyId === rejectingId}
                  className="px-3 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium"
                >
                  {busyId === rejectingId ? <Loader2 className="w-4 h-4 animate-spin inline" /> : t("reviews.reject")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
