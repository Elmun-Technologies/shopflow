import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { dashboardApi } from "../api/endpoints";
import type { ChartTooltipProps } from "../utils/chart";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

const Tip = ({ active, payload, label }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    const percentage = (item.payload as { percentage?: number } | undefined)?.percentage ?? 0;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-sm font-semibold text-emerald-400">{item.value} buyurtma</p>
        <p className="text-xs text-slate-500">{percentage}% jami</p>
      </div>
    );
  }
  return null;
};

export default function TrafficSources() {
  const { data, loading } = useAsync(() => dashboardApi.trafficSources(), []);
  const sources = data ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.9 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <h3 className="text-base font-semibold text-white mb-1">Kanal manbalari</h3>
      <p className="text-sm text-slate-500 mb-4">Buyurtmalar qaysi kanaldan kelmoqda</p>

      <div className="h-52">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
          </div>
        ) : sources.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            Kanal bo'yicha buyurtmalar yo'q
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sources} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="source"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                width={100}
              />
              <Tooltip content={<Tip />} />
              <Bar dataKey="visitors" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {sources.map((s, index) => (
                  <Cell key={`${s.channelId ?? index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {sources.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {sources.map((s, index) => (
            <div key={`${s.channelId ?? index}-l`} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className="text-xs text-slate-400 truncate">{s.source}</span>
              <span className="text-xs font-medium text-white ml-auto">{s.percentage}%</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
