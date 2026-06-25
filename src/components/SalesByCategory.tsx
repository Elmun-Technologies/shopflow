import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useQueryAsync } from "../hooks/useQueryAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCompactCurrency } from "../utils/format";
import type { ChartTooltipProps } from "../utils/chart";
import { useMemo } from "react";
import { useT } from "../i18n";

// Commerly palette — yashil gradatsiyalar + yumshoq aksent
const COLORS = ["#95D26F", "#5FA340", "#2D4938", "#A8E063", "#7BC056", "#C5E29F", "#4F6B53"];

function makeTipComponent(currency: string) {
  return function Tip({ active, payload }: ChartTooltipProps) {
    if (active && payload && payload.length) {
      const item = payload[0];
      const sales = (item.payload as { sales?: number } | undefined)?.sales ?? 0;
      return (
        <div className="bg-cream-100/95 backdrop-blur border border-cream-300 rounded-xl px-3 py-2 shadow-2xl">
          <p className="text-xs font-medium text-forest-800">{item.name}</p>
          <p className="text-[11px] text-slate-500">{item.value}%</p>
          <p className="text-xs font-semibold text-forest-700 mt-0.5">
            {formatCompactCurrency(sales, currency)}
          </p>
        </div>
      );
    }
    return null;
  };
}

export default function SalesByCategory() {
  const { tenant } = useAuth();
  const { t } = useT();
  const currency = tenant?.currency ?? "UZS";
  const { data, loading } = useQueryAsync(["dashboard", "salesByCategory"], () => dashboardApi.salesByCategory());
  const items = data ?? [];

  const Tip = useMemo(() => makeTipComponent(currency), [currency]);

  // Donut markazidagi summa
  const totalPct = items.reduce((s, x) => s + (x.value ?? 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="bg-white border border-cream-300/80 rounded-2xl p-5"
    >
      <h3 className="text-base font-semibold text-forest-800">{t("widget.salesByCategory")}</h3>
      <p className="text-xs text-slate-500 mb-3 mt-0.5">{t("salesByCategory.subtitle")}</p>

      <div className="relative h-44">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            {t("salesByCategory.empty")}
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
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{t("salesByCategory.total")}</p>
              <p className="text-lg font-bold text-forest-800">{items.length}</p>
            </div>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5 mt-3 pt-3 border-t border-cream-300/60">
          {items.slice(0, 4).map((cat, index) => (
            <div key={cat.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-slate-700 truncate">{cat.name}</span>
              </div>
              <span className="text-slate-500 font-medium flex-shrink-0">{cat.value}%</span>
            </div>
          ))}
          {items.length > 4 && (
            <p className="text-[10px] text-slate-400 pl-4">{t("salesByCategory.more", { count: items.length - 4 })}</p>
          )}
        </div>
      )}
      {totalPct === 0 && null}
    </motion.div>
  );
}
