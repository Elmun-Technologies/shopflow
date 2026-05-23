import { motion } from "framer-motion";
import { DollarSign, ShoppingBag, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useAsync } from "../hooks/useAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/format";
import { useT } from "../i18n";
import { KPICardsSkeleton } from "./ui/Skeleton";

interface CardConfig {
  titleKey: string;
  icon: React.ElementType;
  format: (v: number, currency: string) => string;
  // Soft pastel ranglar — har card uchun
  iconBg: string;
  iconColor: string;
  sparkColor: string; // sparkline rangi
}

const cards: Array<CardConfig & { key: "revenue" | "orders" | "customers" | "conversion" }> = [
  {
    key: "revenue",
    titleKey: "kpi.revenue",
    icon: DollarSign,
    format: (v, c) => formatCurrency(v, c),
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
    sparkColor: "#10b981",
  },
  {
    key: "orders",
    titleKey: "kpi.orders",
    icon: ShoppingBag,
    format: (v) => v.toLocaleString(),
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-400",
    sparkColor: "#0ea5e9",
  },
  {
    key: "customers",
    titleKey: "kpi.customers",
    icon: Users,
    format: (v) => v.toLocaleString(),
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-400",
    sparkColor: "#8b5cf6",
  },
  {
    key: "conversion",
    titleKey: "kpi.conversion",
    icon: TrendingUp,
    format: (v) => `${v.toFixed(2)}%`,
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-400",
    sparkColor: "#f59e0b",
  },
];

export default function KPICards() {
  const { tenant } = useAuth();
  const { t } = useT();
  const { data, loading } = useAsync(() => dashboardApi.kpis(), []);
  // Sparkline uchun oxirgi 14 kun ma'lumotlari (faqat revenue + orders haqiqiy data)
  const { data: dailySales } = useAsync(() => dashboardApi.dailySales(14), []);
  const currency = tenant?.currency ?? "UZS";

  if (loading) {
    return <KPICardsSkeleton />;
  }

  const sparkData = dailySales ?? [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((cfg, index) => {
        const stat = data?.[cfg.key] ?? { value: 0, change: 0 };
        const isPositive = stat.change >= 0;
        const Icon = cfg.icon;

        // Sparkline data — revenue va orders uchun haqiqiy, boshqalari uchun yo'q
        let spark: Array<{ v: number }> | null = null;
        if (cfg.key === "revenue" && sparkData.length > 0) {
          spark = sparkData.map((d) => ({ v: d.sales }));
        } else if (cfg.key === "orders" && sparkData.length > 0) {
          spark = sparkData.map((d) => ({ v: d.orders }));
        }

        return (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 hover:shadow-lg hover:shadow-emerald-500/5 transition-all group"
          >
            {/* Top row: icon + label + trend chip */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.iconBg}`}>
                  <Icon className={`w-4.5 h-4.5 ${cfg.iconColor}`} />
                </div>
                <p className="text-sm text-slate-400 font-medium">{t(cfg.titleKey)}</p>
              </div>
              {stat.change !== 0 && (
                <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  isPositive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400"
                }`}>
                  {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(stat.change).toFixed(1)}%
                </div>
              )}
            </div>

            {/* Big number */}
            <p className="text-3xl font-bold text-white tracking-tight leading-none mb-1">
              {cfg.format(stat.value, currency)}
            </p>

            {/* Bottom: sparkline yoki sub-label */}
            <div className="mt-3 h-10">
              {spark && spark.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id={`grad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={cfg.sparkColor} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={cfg.sparkColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={cfg.sparkColor}
                      strokeWidth={1.75}
                      fill={`url(#grad-${cfg.key})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <span className="text-xs text-slate-500 inline-flex items-center h-full">
                  {stat.change !== 0 ? t("kpi.vsLastMonth") : t("kpi.noData")}
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
