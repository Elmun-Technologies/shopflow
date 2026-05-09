import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

const timeRanges: Array<{ label: string; days: number }> = [
  { label: "7 kun", days: 7 },
  { label: "30 kun", days: 30 },
  { label: "90 kun", days: 90 },
  { label: "1 yil", days: 365 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const revenue = payload[0]?.value ?? 0;
    const orders = payload[0]?.payload?.orders ?? 0;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 shadow-xl">
        <p className="text-sm font-medium text-slate-300 mb-1">{label}</p>
        <p className="text-lg font-bold text-white">{Number(revenue).toLocaleString()} so'm</p>
        <p className="text-xs text-slate-500 mt-0.5">{orders} buyurtma</p>
      </div>
    );
  }
  return null;
};

export default function RevenueChart() {
  const { onShopEvent } = useNotifications();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Array<{ date: string; revenue: number; orders: number }> | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const d = await api.analytics.revenue(days);
      setData(d);
    } catch (err) {
      if (err instanceof ApiError) console.warn("Revenue load:", err.message);
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
  }, [days, onShopEvent]);

  const formatted = useMemo(() => {
    if (!data) return [];
    return data.map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" }),
    }));
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-white">Daromad dinamikasi</h3>
          <p className="text-sm text-slate-500 mt-0.5">Telegram bot orqali kelgan haqiqiy buyurtmalar</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          {timeRanges.map((range) => (
            <button
              key={range.label}
              onClick={() => setDays(range.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                days === range.days
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        {loading && !data ? (
          <div className="h-full flex items-center justify-center text-slate-600"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formatted} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 5, fill: "#10b981", stroke: "#0f172a", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
