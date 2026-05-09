import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Globe } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

const SOURCE_COLORS: Record<string, string> = {
  miniapp: "#10b981",
  telegram: "#3b82f6",
  admin: "#a855f7",
};

export default function TrafficSources() {
  const { onShopEvent } = useNotifications();
  const [data, setData] = useState<Array<{ source: string; label: string; orders: number; revenue: number; customers: number }> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setData(await api.analytics.traffic());
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
      if (ev.type === "order.created") void load();
    });
  }, [onShopEvent]);

  const totalCustomers = (data ?? []).reduce((s, d) => s + d.customers, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.9 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <h3 className="text-base font-semibold text-white mb-1">Trafik manbai</h3>
      <p className="text-sm text-slate-500 mb-4">Buyurtma kelgan joy bo'yicha</p>

      {loading && !data ? (
        <div className="h-32 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-600" /></div>
      ) : !data || data.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-8">Hali ma'lumot yo'q</p>
      ) : (
        <div className="space-y-3">
          {data.map((s) => {
            const color = SOURCE_COLORS[s.source] ?? "#94a3b8";
            return (
              <div key={s.source} className="bg-slate-800/40 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium text-white">{s.label}</span>
                  </div>
                  <span className="text-xs text-slate-400">{s.customers} mijoz</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Buyurtma</p>
                    <p className="text-white font-semibold">{s.orders}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tushum</p>
                    <p className="text-emerald-400 font-semibold">{s.revenue.toLocaleString()} so'm</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="pt-3 mt-1 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 inline-flex items-center gap-1"><Globe className="w-3 h-3" /> {data.length} ta manba</span>
            <span className="text-slate-300">{totalCustomers} ta unique mijoz</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
