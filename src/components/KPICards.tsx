import { motion } from "framer-motion";
import { DollarSign, ShoppingBag, Users, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/format";
import { useT } from "../i18n";

interface CardConfig {
  titleKey: string;
  icon: React.ElementType;
  format: (v: number, currency: string) => string;
}

const cards: Array<CardConfig & { key: "revenue" | "orders" | "customers" | "conversion" }> = [
  { key: "revenue", titleKey: "kpi.revenue", icon: DollarSign, format: (v, c) => formatCurrency(v, c) },
  { key: "orders", titleKey: "kpi.orders", icon: ShoppingBag, format: (v) => v.toLocaleString() },
  { key: "customers", titleKey: "kpi.customers", icon: Users, format: (v) => v.toLocaleString() },
  { key: "conversion", titleKey: "kpi.conversion", icon: TrendingUp, format: (v) => `${v.toFixed(2)}%` },
];

export default function KPICards() {
  const { tenant } = useAuth();
  const { t } = useT();
  const { data, loading } = useAsync(() => dashboardApi.kpis(), []);
  const currency = tenant?.currency ?? "UZS";

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div
            key={c.key}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-[120px] flex items-center justify-center"
          >
            <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((cfg, index) => {
        const stat = data?.[cfg.key] ?? { value: 0, change: 0 };
        const isPositive = stat.change >= 0;
        const Icon = cfg.icon;
        return (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{t(cfg.titleKey)}</p>
                <p className="text-2xl font-bold text-white mt-1.5">{cfg.format(stat.value, currency)}</p>
                <div className="flex items-center gap-1 mt-2">
                  {stat.change !== 0 ? (
                    <>
                      {isPositive ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span className={`text-xs font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                        {isPositive ? "+" : ""}
                        {stat.change.toFixed(1)}%
                      </span>
                      <span className="text-xs text-slate-500">{t("kpi.vsLastMonth")}</span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-600">{t("kpi.noData")}</span>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5 text-slate-400" />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
