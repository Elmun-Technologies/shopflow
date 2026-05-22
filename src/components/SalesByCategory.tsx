import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCompactCurrency } from "../utils/format";
import type { ChartTooltipProps } from "../utils/chart";
import { useT } from "../i18n";

// Modern pastel-aksent ranglar — Commerly stilida
const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444"];

export default function SalesByCategory() {
  const { tenant } = useAuth();
  const { t } = useT();
  const currency = tenant?.currency ?? "UZS";
  const { data, loading } = useAsync(() => dashboardApi.salesByCategory(), []);
  const items = data ?? [];

  const Tip = ({ active, payload }: ChartTooltipProps) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const sales = (item.payload as { sales?: number } | undefined)?.sales ?? 0;
      return (
        <div className="bg-slate-800/95 backdrop-blur border border-slate-700 rounded-xl px-3 py-2 shadow-2xl">
          <p className="text-xs font-medium text-white">{item.name}</p>
          <p className="text-[11px] text-slate-400">{item.value}%</p>
          <p className="text-xs font-semibold text-emerald-400 mt-0.5">
            {formatCompactCurrency(sales, currency)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Donut markazidagi summa
  const totalPct = items.reduce((s, x) => s + (x.value ?? 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5"
    >
      <h3 className="text-base font-semibold text-white">{t("widget.salesByCategory")}</h3>
      <p className="text-xs text-slate-500 mb-3 mt-0.5">Mahsulot kategoriyalari taqsimoti</p>

      <div className="relative h-44">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            Kategoriyalar bo'yicha ma'lumot yo'q
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={items}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {items.map((cat, index) => (
                    <Cell key={cat.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<Tip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Markazdagi raqam */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Jami</p>
              <p className="text-lg font-bold text-white">{items.length}</p>
            </div>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-800/60">
          {items.slice(0, 4).map((cat, index) => (
            <div key={cat.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-slate-300 truncate">{cat.name}</span>
              </div>
              <span className="text-slate-400 font-medium flex-shrink-0">{cat.value}%</span>
            </div>
          ))}
          {items.length > 4 && (
            <p className="text-[10px] text-slate-600 pl-4">+{items.length - 4} ko'proq</p>
          )}
        </div>
      )}
      {totalPct === 0 && null}
    </motion.div>
  );
}
