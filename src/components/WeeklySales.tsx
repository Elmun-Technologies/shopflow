import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useQueryAsync } from "../hooks/useQueryAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCompactCurrency } from "../utils/format";
import type { ChartTooltipProps } from "../utils/chart";
import { useT } from "../i18n";
import { useMemo } from "react";

function makeTipComponent(currency: string) {
  return function Tip({ active, payload, label }: ChartTooltipProps) {
    if (active && payload && payload.length) {
      return (
        <div className="bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 shadow-xl">
          <p className="text-sm font-medium text-forest-800">{label}</p>
          <p className="text-sm font-semibold text-forest-700">
            {formatCompactCurrency(payload[0].value as number, currency)}
          </p>
        </div>
      );
    }
    return null;
  };
}

export default function WeeklySales() {
  const { tenant } = useAuth();
  const { t } = useT();
  const currency = tenant?.currency ?? "UZS";
  const { data, loading } = useQueryAsync(["dashboard", "weeklySales"], () => dashboardApi.weeklySales());
  const series = data ?? [];

  const Tip = useMemo(() => makeTipComponent(currency), [currency]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="bg-white border border-cream-300/80 rounded-2xl p-5"
    >
      <h3 className="text-base font-semibold text-forest-800">{t("widget.weeklySales")}</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">Oxirgi 7 kun</p>

      <div className="h-44">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : series.every((s) => s.sales === 0) ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            Bu hafta sotuvlar yo'q
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="weeklyBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#95D26F" stopOpacity={1} />
                  <stop offset="100%" stopColor="#5FA340" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="#E5E5DA" vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 10 }} dy={5} />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 10 }}
                tickFormatter={(value) => formatCompactCurrency(Number(value), currency)}
                width={42}
              />
              <Tooltip content={<Tip />} cursor={{ fill: "#1e293b40" }} />
              <Bar dataKey="sales" fill="url(#weeklyBarGrad)" radius={[16, 16, 16, 16]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </motion.div>
  );
}
