import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const p = payload[0].payload as { revenue: number; orders: number };
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-sm font-semibold text-emerald-400">{p.revenue.toLocaleString()} so'm</p>
        <p className="text-xs text-slate-500">{p.orders} buyurtma</p>
      </div>
    );
  }
  return null;
};

export default function WeeklySales() {
  const { onShopEvent } = useNotifications();
  const [data, setData] = useState<Array<{ day: string; revenue: number; orders: number }> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setData(await api.analytics.weeklySales());
    } catch (err) {
      if (err instanceof ApiError) console.warn("Weekly:", err.message);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <h3 className="text-base font-semibold text-white mb-1">Haftalik sotuv</h3>
      <p className="text-sm text-slate-500 mb-4">Oxirgi 7 kun, kun bo'yicha</p>

      <div className="h-52">
        {loading && !data ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-600" /></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data ?? []} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
