import { motion } from "framer-motion";
import { DollarSign, ShoppingBag, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useQueryAsync } from "../hooks/useQueryAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/format";
import { useT } from "../i18n";
import { KPICardsSkeleton } from "./ui/Skeleton";

interface CardConfig {
  titleKey: string;
  icon: React.ElementType;
  format: (v: number, currency: string) => string;
  accent: string;       // top border color
  iconBg: string;       // icon wrapper bg
  iconColor: string;    // icon color
  sparkColor: string;
}

const cards: Array<CardConfig & { key: "revenue" | "orders" | "customers" | "conversion" }> = [
  {
    key: "revenue",
    titleKey: "kpi.revenue",
    icon: DollarSign,
    format: (v, c) => formatCurrency(v, c),
    accent: "#10b981",
    iconBg: "rgba(16,185,129,0.1)",
    iconColor: "#10b981",
    sparkColor: "#10b981",
  },
  {
    key: "orders",
    titleKey: "kpi.orders",
    icon: ShoppingBag,
    format: (v) => v.toLocaleString(),
    accent: "#3b82f6",
    iconBg: "rgba(59,130,246,0.1)",
    iconColor: "#3b82f6",
    sparkColor: "#3b82f6",
  },
  {
    key: "customers",
    titleKey: "kpi.customers",
    icon: Users,
    format: (v) => v.toLocaleString(),
    accent: "#8b5cf6",
    iconBg: "rgba(139,92,246,0.1)",
    iconColor: "#8b5cf6",
    sparkColor: "#8b5cf6",
  },
  {
    key: "conversion",
    titleKey: "kpi.conversion",
    icon: TrendingUp,
    format: (v) => `${v.toFixed(2)}%`,
    accent: "#f59e0b",
    iconBg: "rgba(245,158,11,0.1)",
    iconColor: "#f59e0b",
    sparkColor: "#f59e0b",
  },
];

export default function KPICards() {
  const { tenant } = useAuth();
  const { t } = useT();
  const { data, loading } = useQueryAsync(["dashboard", "kpis"], () => dashboardApi.kpis());
  const { data: dailySales } = useQueryAsync(["dashboard", "dailySales", 14], () => dashboardApi.dailySales(14));
  const currency = tenant?.currency ?? "UZS";

  if (loading) return <KPICardsSkeleton />;

  const sparkData = dailySales ?? [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((cfg, index) => {
        const stat = data?.[cfg.key] ?? { value: 0, change: 0 };
        const isPositive = stat.change >= 0;
        const Icon = cfg.icon;

        let spark: Array<{ v: number }> | null = null;
        if (cfg.key === "revenue" && sparkData.length > 0)
          spark = sparkData.map((d) => ({ v: d.sales }));
        else if (cfg.key === "orders" && sparkData.length > 0)
          spark = sparkData.map((d) => ({ v: d.orders }));

        return (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.07 }}
            className="relative bg-white rounded-2xl overflow-hidden"
            style={{
              border: "1px solid #eaeae0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            {/* Top accent stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
              style={{ backgroundColor: cfg.accent }}
            />

            <div className="p-5 pt-5">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{ width: 38, height: 38, backgroundColor: cfg.iconBg }}
                >
                  <Icon style={{ width: 18, height: 18, color: cfg.iconColor }} />
                </div>
                {stat.change !== 0 && (
                  <div
                    className="flex items-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-semibold"
                    style={{
                      backgroundColor: isPositive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                      color: isPositive ? "#059669" : "#dc2626",
                    }}
                  >
                    {isPositive
                      ? <ArrowUpRight style={{ width: 12, height: 12 }} />
                      : <ArrowDownRight style={{ width: 12, height: 12 }} />
                    }
                    {Math.abs(stat.change).toFixed(1)}%
                  </div>
                )}
              </div>

              {/* Value */}
              <p
                className="text-2xl font-bold tracking-tight leading-none mb-1"
                style={{ color: "#14201A" }}
              >
                {cfg.format(stat.value, currency)}
              </p>
              <p className="text-xs font-medium" style={{ color: "#94a3b8" }}>
                {t(cfg.titleKey)}
              </p>

              {/* Sparkline */}
              <div className="mt-4 h-10">
                {spark && spark.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spark} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`kpi-grad-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={cfg.sparkColor} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={cfg.sparkColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke={cfg.sparkColor}
                        strokeWidth={1.5}
                        fill={`url(#kpi-grad-${cfg.key})`}
                        isAnimationActive={false}
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs flex items-center h-full" style={{ color: "#cbd5e1" }}>
                    {stat.change !== 0 ? t("kpi.vsLastMonth") : t("kpi.noData")}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
