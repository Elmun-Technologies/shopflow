import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCompactCurrency } from "../utils/format";
import type { ChartTooltipProps } from "../utils/chart";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export default function SalesByCategory() {
  const { tenant } = useAuth();
  const currency = tenant?.currency ?? "UZS";
  const { data, loading } = useAsync(() => dashboardApi.salesByCategory(), []);
  const items = data ?? [];

  const Tip = ({ active, payload }: ChartTooltipProps) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const sales = (item.payload as { sales?: number } | undefined)?.sales ?? 0;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
          <p className="text-sm font-medium text-white">{item.name}</p>
          <p className="text-xs text-slate-400">{item.value}% ulush</p>
          <p className="text-sm font-semibold text-emerald-400 mt-0.5">
            {formatCompactCurrency(sales, currency)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <h3 className="text-base font-semibold text-white mb-1">Kategoriya bo'yicha</h3>
      <p className="text-sm text-slate-500 mb-4">Mahsulot kategoriyalari taqsimoti</p>

      <div className="h-52">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            Kategoriyalar bo'yicha ma'lumot yo'q
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={items}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
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
        )}
      </div>

      {items.length > 0 && (
        <div className="space-y-2 mt-2">
          {items.map((cat, index) => (
            <div key={cat.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-sm text-slate-300">{cat.name}</span>
              </div>
              <span className="text-sm font-medium text-white">{cat.value}%</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
