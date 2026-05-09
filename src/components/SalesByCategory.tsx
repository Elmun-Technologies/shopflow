import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Tag } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

const COLORS = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#ec4899", "#06b6d4", "#84cc16"];

export default function SalesByCategory() {
  const { onShopEvent } = useNotifications();
  const [data, setData] = useState<Array<{ categoryId: string | null; categoryName: string; revenue: number; orderCount: number; itemsSold: number }> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setData(await api.analytics.salesByCategory());
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return onShopEvent((ev) => {
      if (ev.type === "order.created" || ev.type === "order.updated") void load();
    });
  }, [onShopEvent]);

  const totalRevenue = (data ?? []).reduce((s, c) => s + c.revenue, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <h3 className="text-base font-semibold text-white mb-1">Kategoriya bo'yicha</h3>
      <p className="text-sm text-slate-500 mb-4">Sotuv hissasi (real-time)</p>

      {loading && !data ? (
        <div className="h-32 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-600" /></div>
      ) : !data || data.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-8">Hali ma'lumot yo'q</p>
      ) : (
        <div className="space-y-3">
          {data.map((c, i) => {
            const pct = totalRevenue > 0 ? (c.revenue / totalRevenue) * 100 : 0;
            const color = COLORS[i % COLORS.length];
            return (
              <div key={c.categoryId ?? "uncat"}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm text-slate-300">{c.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500">{c.itemsSold} dona</span>
                    <span className="text-white font-semibold">{c.revenue.toLocaleString()} so'm</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
          <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 inline-flex items-center gap-1"><Tag className="w-3 h-3" /> {data.length} kategoriya</span>
            <span className="text-emerald-400 font-semibold">Jami: {totalRevenue.toLocaleString()} so'm</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
