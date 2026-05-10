import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileSpreadsheet, FileText, Package, Loader2, Download, ClipboardList } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

interface Props {
  open: boolean;
  onClose: () => void;
}

const statusOptions: Array<{ value: string; label: string }> = [
  { value: "pending", label: "Yangi" },
  { value: "confirmed", label: "Tasdiqlandi" },
  { value: "preparing", label: "Tayyorlanmoqda" },
  { value: "shipping", label: "Yetkazilmoqda" },
  { value: "delivered", label: "Yetkazildi" },
  { value: "cancelled", label: "Bekor qilindi" },
];

export default function AssemblySheetDrawer({ open, onClose }: Props) {
  const { toast } = useNotifications();
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [exportType, setExportType] = useState<"by_orders" | "by_products">("by_orders");
  const [loading, setLoading] = useState(false);

  function toggle(s: string) {
    const next = new Set(statuses);
    if (next.has(s)) next.delete(s); else next.add(s);
    setStatuses(next);
  }

  async function download() {
    setLoading(true);
    try {
      const blob = await api.orders.exportCsv({
        statuses: statuses.size > 0 ? Array.from(statuses) : undefined,
        type: exportType,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportType === "by_orders" ? "buyurtmalar" : "mahsulotlar"}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ kind: "success", title: "Yuklandi" });
      onClose();
    } catch (err) {
      toast({ kind: "error", title: "Xato", description: err instanceof ApiError ? err.message : "Yuklab bo'lmadi" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] bg-black/70 flex items-stretch justify-end" onClick={onClose}>
          <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-slate-900 border-l border-slate-800 overflow-y-auto"
          >
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">Yig'uv varaqasi</h2>
                  <p className="text-xs text-slate-500">Buyurtmalarni CSV faylga eksport qilish</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 1. Status */}
              <div>
                <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">1</span>
                  Holat
                </p>
                <p className="text-xs text-slate-500 mb-3">Eksportga qaysi holatdagi buyurtmalarni qo'shish (bo'sh = barchasi)</p>
                <div className="space-y-1.5">
                  {statusOptions.map((s) => (
                    <label key={s.value} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-800/50 cursor-pointer" onClick={(e) => { e.preventDefault(); toggle(s.value); }}>
                      <div className={`w-4 h-4 rounded border-2 ${statuses.has(s.value) ? "bg-emerald-600 border-emerald-500" : "border-slate-600"} flex items-center justify-center`}>
                        {statuses.has(s.value) && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <span className="text-sm text-slate-300">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 2. Export type */}
              <div>
                <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">2</span>
                  Eksport turi
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportType("by_orders")}
                    className={`p-4 rounded-xl border-2 transition-colors ${exportType === "by_orders" ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-800/40 hover:border-slate-700"}`}
                  >
                    <ClipboardList className={`w-6 h-6 mx-auto mb-2 ${exportType === "by_orders" ? "text-emerald-400" : "text-slate-400"}`} />
                    <p className={`text-sm font-medium ${exportType === "by_orders" ? "text-emerald-400" : "text-slate-300"}`}>Buyurtma bo'yicha</p>
                  </button>
                  <button
                    onClick={() => setExportType("by_products")}
                    className={`p-4 rounded-xl border-2 transition-colors ${exportType === "by_products" ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 bg-slate-800/40 hover:border-slate-700"}`}
                  >
                    <Package className={`w-6 h-6 mx-auto mb-2 ${exportType === "by_products" ? "text-emerald-400" : "text-slate-400"}`} />
                    <p className={`text-sm font-medium ${exportType === "by_products" ? "text-emerald-400" : "text-slate-300"}`}>Mahsulot bo'yicha</p>
                  </button>
                </div>
              </div>

              {/* 3. Format */}
              <div>
                <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">3</span>
                  Fayl turi
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-500/10">
                    <FileSpreadsheet className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-400">CSV (Excel)</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">UTF-8</p>
                  </div>
                  <div className="p-4 rounded-xl border-2 border-slate-800 bg-slate-800/40 opacity-50">
                    <FileText className="w-6 h-6 mx-auto mb-2 text-slate-500" />
                    <p className="text-sm text-slate-500">PDF</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">Tez orada</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-900 border-t border-slate-800 p-4 flex gap-2">
              <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg">Bekor</button>
              <button onClick={download} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Yuklab olish
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
