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
import { Loader2, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useAsync } from "../hooks/useAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCompactCurrency } from "../utils/format";
import type { ChartTooltipProps } from "../utils/chart";
import { useT } from "../i18n";

export default function RevenueChart() {
  const { tenant } = useAuth();
  const { t } = useT();
  const currency = tenant?.currency ?? "UZS";
  const { data, loading } = useAsync(() => dashboardApi.revenueTrend(), []);
  const series = data ?? [];

  // Hero statistika — joriy oy va o'zgarish
  const stats = useMemo(() => {
    if (series.length < 2) return { current: 0, change: 0 };
    const last = series[series.length - 1].revenue;
    const prev = series[series.length - 2].revenue;
    const change = prev > 0 ? ((last - prev) / prev) * 100 : 0;
    return { current: last, change };
  }, [series]);

  const Tip = ({ active, payload, label }: ChartTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-cream-100/95 backdrop-blur border border-cream-300 rounded-xl px-3.5 py-2.5 shadow-2xl">
          <p className="text-xs text-slate-500 mb-1">{label}</p>
          <p className="text-base font-bold text-forest-800">
            {formatCompactCurrency(payload[0].value as number, currency)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {String((payload[0].payload as { orders?: number } | undefined)?.orders ?? 0)} buyurtma
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25 }}
      className="bg-white rounded-2xl p-5"
      style={{ border: "1px solid #EAEAE0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-forest-800">{t("widget.revenue")}</h3>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl md:text-3xl font-bold text-forest-800 tracking-tight">
              {formatCompactCurrency(stats.current, currency)}
            </p>
            {stats.change !== 0 && (
              <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${
                stats.change >= 0 ? "bg-leaf-100 text-forest-700" : "bg-rose-100 text-rose-600"
              }`}>
                <TrendingUp className={`w-3 h-3 ${stats.change < 0 ? "rotate-180" : ""}`} />
                {Math.abs(stats.change).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">Oxirgi 12 oy</p>
        </div>
      </div>

      <div className="h-64">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : series.every((s) => s.revenue === 0) ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            Hali yopilgan buyurtmalar yo'q
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5FA340" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#5FA340" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="#E5E5DA" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                dy={5}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                tickFormatter={(value) => formatCompactCurrency(Number(value), currency)}
                width={50}
              />
              <Tooltip content={<Tip />} cursor={{ stroke: "#94A3B8", strokeDasharray: "3 3" }} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#5FA340"
                strokeWidth={2.5}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 5, fill: "#5FA340", stroke: "#FFFFFF", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
