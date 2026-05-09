import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Check, X, Star, MessageSquare } from "lucide-react";
import type { ProductReview, ReviewStatus } from "../../data/marketingData";
import { initialReviews, reviewStatusLabels } from "../../data/marketingData";
import EmptyState from "../EmptyState";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-slate-600"}`} />
      ))}
    </div>
  );
}

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const map: Record<ReviewStatus, string> = {
    pending: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-400 border border-red-500/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full border ${map[status]}`}>{reviewStatusLabels[status]}</span>;
}

export default function IzohlarPage() {
  const [reviews, setReviews] = useState<ProductReview[]>(initialReviews);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | "all">("all");
  const [selectedReview, setSelectedReview] = useState<ProductReview | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      const matchesSearch = !q || r.customerName.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q) || r.text.toLowerCase().includes(q);
      const matchesStatus = filterStatus === "all" || r.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [reviews, search, filterStatus]);

  const stats = useMemo(() => {
    const pending = reviews.filter((r) => r.status === "pending").length;
    const approved = reviews.filter((r) => r.status === "approved").length;
    const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
    return { pending, approved, avgRating };
  }, [reviews]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mahsulot izohları</h1>
          <p className="text-sm text-slate-500 mt-1">Mijoz sharh va baholashlarini boshqaring</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">O'rtacha baho</p>
            <p className="text-lg font-semibold text-yellow-400">{stats.avgRating}★</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Ko'rib chiqilishi kerak</p>
            <p className="text-lg font-semibold text-yellow-400">{stats.pending}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Tasdiqlangan</p>
            <p className="text-lg font-semibold text-emerald-400">{stats.approved}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 pl-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === "all" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            Barchasi
          </button>
          <button
            onClick={() => setFilterStatus("pending")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === "pending" ? "bg-yellow-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            Ko'rib chiqilishi kerak
          </button>
          <button
            onClick={() => setFilterStatus("approved")}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === "approved" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
          >
            Tasdiqlangan
          </button>
        </div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        {reviews.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Hali izohlar yo'q"
            description="Xaridorlar hali mahsulot uchun izoh qoldirishmagan. Ular izoh qoldirganida bu yerda ko'rinadi."
            buttonText="Savdo sahifasiga o'tish"
            onButtonClick={() => {}}
            iconColor="text-yellow-400"
          />
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>
        ) : (
          <div className="space-y-3 p-4">
            {filtered.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 cursor-pointer hover:bg-slate-800/80 transition-colors"
                onClick={() => setSelectedReview(r)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-white">{r.customerName}</h4>
                      <StarRating rating={r.rating} />
                    </div>
                    <p className="text-sm text-slate-400 mb-2">{r.productName}</p>
                    <p className="text-sm text-slate-300 line-clamp-2">{r.text}</p>
                    <p className="text-xs text-slate-500 mt-2">{r.createdAt}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ReviewStatusBadge status={r.status} />
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setReviews(reviews.map(rv => rv.id === r.id ? { ...rv, status: "approved" as ReviewStatus } : rv)); }}
                          className="p-1.5 rounded text-slate-400 hover:text-emerald-400 hover:bg-slate-700"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setReviews(reviews.map(rv => rv.id === r.id ? { ...rv, status: "rejected" as ReviewStatus } : rv)); }}
                          className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedReview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={() => setSelectedReview(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedReview.customerName}</h3>
                  <p className="text-sm text-slate-400">{selectedReview.productName}</p>
                </div>
                <button onClick={() => setSelectedReview(null)} className="p-2 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
              </div>
              <div className="mb-4">
                <StarRating rating={selectedReview.rating} />
              </div>
              <p className="text-slate-300 mb-4 whitespace-pre-wrap">{selectedReview.text}</p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500">{selectedReview.createdAt}</p>
                <div className="flex gap-2">
                  {selectedReview.status === "pending" && (
                    <>
                      <button
                        onClick={() => { setReviews(reviews.map(r => r.id === selectedReview.id ? { ...r, status: "rejected" as ReviewStatus } : r)); setSelectedReview(null); }}
                        className="px-3 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-medium"
                      >
                        Rad etish
                      </button>
                      <button
                        onClick={() => { setReviews(reviews.map(r => r.id === selectedReview.id ? { ...r, status: "approved" as ReviewStatus } : r)); setSelectedReview(null); }}
                        className="px-3 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                      >
                        Tasdiqlash
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
