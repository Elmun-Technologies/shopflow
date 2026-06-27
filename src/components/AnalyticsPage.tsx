import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users,
  Target, RotateCcw, ArrowUpRight, ArrowDownRight,
  Download, Receipt, Loader2, FileText,
} from "lucide-react";
import { timeRangeLabels } from "../data/analyticsData";
import type { AnalyticsTimeRange } from "../data/analyticsData";
import type { ChartTooltipProps } from "../utils/chart";
import { dashboardApi } from "../api/endpoints";
import type { DashboardPeriod } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { openReportPrint } from "../utils/printReport";
import { priceBreakdown } from "../utils/pricing";
import { formatCurrency } from "../utils/format";
import { useAppToast } from "./ui/Toast";
import { useT } from "../i18n";

// AnalyticsTimeRange → DashboardPeriod konvertatsiya
const toPeriod = (r: AnalyticsTimeRange): DashboardPeriod => {
  const map: Record<AnalyticsTimeRange, DashboardPeriod> = {
    today: "today", week: "week", month: "month", year: "year", all: "all",
  };
  return map[r] ?? "month";
};

interface KpiData {
  revenue: { value: number; change: number };
  orders: { value: number; change: number };
  customers: { value: number; change: number };
  conversion: { value: number; change: number };
  returnRate?: { value: number; change: number };
  avgOrder?: { value: number; change: number };
}

const iconMap: Record<string, React.ElementType> = {
  DollarSign, ShoppingCart, Users, Target, RotateCcw, Receipt,
};

const formatNumber = (n: number): string => {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + " mlrd";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " mln";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + " ming";
  return n.toLocaleString();
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-cream-100 border border-cream-300 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-slate-500 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={p.dataKey ?? p.name ?? i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-xs text-slate-700">{p.name}:</span>
          <span className="text-xs text-forest-800 font-semibold">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const { t } = useT();
  const { tenant } = useAuth();
  const toast = useAppToast();
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>("month");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<Array<{ month: string; revenue: number; orders: number }>>([]);
  const [dailySales, setDailySales] = useState<Array<{ day: string; date: string; sales: number; orders: number }>>([]);
  const [topProducts, setTopProducts] = useState<Array<{ id: string | undefined; name: string; category: string | null; price: number; sold: number; stock: number; growth: number; rank: number; revenue: number }>>([]);
  const [trafficSources, setTrafficSources] = useState<Array<{ source: string; name: string; visitors: number; percentage: number; color: string }>>([]);
  const [categorySales, setCategorySales] = useState<Array<{ name: string; category: string; sales: number; value: number; color: string }>>([]);
  const [geographyData, setGeographyData] = useState<Array<{ name: string; city: string; orders: number; revenue: number; percentage: number }>>([]);
  const [conversionFunnel, setConversionFunnel] = useState<Array<{ stage: string; count: number; dropOff: number; percentage: number; color: string }>>([]);
  const [customerSegments, setCustomerSegments] = useState<Array<{ name: string; count: number; color: string; percentage: number; avgOrders: number }>>([]);

  const loadData = useCallback((range: AnalyticsTimeRange) => {
    const period = toPeriod(range);
    // Kunlar soni period ga mos
    const daysMap: Record<AnalyticsTimeRange, number> = { today: 1, week: 7, month: 30, year: 365, all: 90 };
    const days = daysMap[range];

    let cancelled = false;
    setLoading(true);

    Promise.all([
      dashboardApi.kpis(period),
      dashboardApi.revenueTrend(),
      dashboardApi.dailySales(days),
      dashboardApi.topProducts(period),
      dashboardApi.trafficSources(period),
      dashboardApi.salesByCategory(period),
      dashboardApi.geography(period),
      dashboardApi.funnel(period),
      dashboardApi.customerSegments(),
    ])
      .then(([k, mr, ds, tp, ts, cs, gd, fn, cseg]) => {
        if (cancelled) return;
        setKpis(k as unknown as KpiData);
        setMonthlyRevenue(mr);
        setDailySales(ds);
        setTopProducts(tp.map((p, i) => ({ ...p, growth: 0, rank: i + 1, revenue: p.price * p.sold })));
        const sourceColors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];
        setTrafficSources(ts.map((s, i) => ({
          source: s.source,
          name: s.source,
          visitors: s.visitors,
          percentage: s.percentage,
          color: sourceColors[i % sourceColors.length],
        })));
        const catColors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];
        setCategorySales(cs.map((c, i) => ({
          ...c,
          category: c.name,
          color: catColors[i % catColors.length],
        })));
        const geoTotal = gd.reduce((a, g) => a + g.revenue, 0);
        setGeographyData(gd.map((g) => ({
          name: g.name,
          city: g.name,
          orders: g.orders,
          revenue: g.revenue,
          percentage: geoTotal > 0 ? Math.round((g.revenue / geoTotal) * 100) : 0,
        })));
        const funnelMax = fn[0]?.count ?? 1;
        const funnelColors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6"];
        setConversionFunnel(fn.map((s, i) => ({
          ...s,
          percentage: funnelMax > 0 ? Math.round((s.count / funnelMax) * 100) : 0,
          color: funnelColors[i] ?? "#64748b",
        })));
        const segTotal = cseg.reduce((a, s) => a + s.count, 0);
        setCustomerSegments(cseg.map((s) => ({
          ...s,
          percentage: segTotal > 0 ? Math.round((s.count / segTotal) * 100) : 0,
          avgOrders: 0,
        })));
      })
      .catch(() => null)
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return loadData(timeRange);
  }, [timeRange, loadData]);

  // Backend KPI'larni 6-kartochka shapega adapt qilamiz
  type AdaptedKpi = { id: string; label: string; value: string; change: number; trend: "up" | "down"; icon: string; color: string };
  const analyticsKPIs = useMemo<AdaptedKpi[]>(() => {
    if (!kpis) return [];
    const fmt = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(1) + " mlrd" : n >= 1e6 ? (n / 1e6).toFixed(1) + " mln" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : n.toLocaleString();
    // API dan avgOrder va returnRate kelsa ularni ishlatamiz, aks holda hisoblaymiz
    const avgOrderVal = kpis.avgOrder?.value ?? (kpis.orders.value > 0 ? kpis.revenue.value / kpis.orders.value : 0);
    const returnRateVal = kpis.returnRate?.value ?? 0;
    return [
      { id: "revenue", label: t("analytics.kpi.revenue"), value: fmt(kpis.revenue.value) + " so'm", change: Math.round(kpis.revenue.change), trend: kpis.revenue.change >= 0 ? "up" : "down", icon: "DollarSign", color: "#10b981" },
      { id: "orders", label: t("analytics.kpi.orders"), value: fmt(kpis.orders.value), change: Math.round(kpis.orders.change), trend: kpis.orders.change >= 0 ? "up" : "down", icon: "ShoppingCart", color: "#3b82f6" },
      { id: "customers", label: t("analytics.kpi.customers"), value: fmt(kpis.customers.value), change: Math.round(kpis.customers.change), trend: kpis.customers.change >= 0 ? "up" : "down", icon: "Users", color: "#8b5cf6" },
      { id: "conversion", label: t("analytics.kpi.conversion"), value: kpis.conversion.value.toFixed(1) + "%", change: Math.round(kpis.conversion.change), trend: kpis.conversion.change >= 0 ? "up" : "down", icon: "Target", color: "#f59e0b" },
      { id: "avg", label: t("analytics.kpi.avgOrder"), value: fmt(avgOrderVal) + " so'm", change: Math.round(kpis.avgOrder?.change ?? 0), trend: (kpis.avgOrder?.change ?? 0) >= 0 ? "up" : "down", icon: "Receipt", color: "#06b6d4" },
      { id: "returns", label: t("analytics.kpi.returns"), value: returnRateVal.toFixed(1) + "%", change: Math.round(kpis.returnRate?.change ?? 0), trend: returnRateVal <= 5 ? "up" : "down", icon: "RotateCcw", color: "#94a3b8" },
    ];
  }, [kpis, t]);

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-leaf-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-6"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-forest-800">{t("analytics.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("analytics.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Range Selector */}
          <div className="flex items-center bg-cream-100 border border-cream-300 rounded-lg p-0.5">
            {(Object.keys(timeRangeLabels) as AnalyticsTimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  timeRange === range
                    ? "bg-leaf-400 text-forest-800 shadow-lg shadow-leaf-500/20"
                    : "text-slate-500 hover:text-forest-900"
                }`}
              >
                {timeRangeLabels[range]}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (!kpis) return;
              const rows = [
                [t("analytics.csv.metric"), t("analytics.csv.value"), t("analytics.csv.change")],
                ...analyticsKPIs.map(k => [k.label, k.value, `${k.change > 0 ? "+" : ""}${k.change}%`]),
              ];
              const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
              const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `shopflow-analytics-${timeRange}-${new Date().toISOString().slice(0,10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-lg text-sm text-forest-800 transition-all"
          >
            <Download className="w-4 h-4" />
            {t("analytics.export")}
          </button>
          <button
            onClick={() => {
              if (!kpis) return;
              const ok = openReportPrint({
                storeName: tenant?.name ?? "ShopFlow",
                periodLabel: timeRangeLabels[timeRange],
                generatedAt: new Date(),
                currency: tenant?.currency ?? "UZS",
                kpis: {
                  revenue: kpis.revenue,
                  orders: kpis.orders,
                  customers: kpis.customers,
                  conversion: kpis.conversion,
                  avgOrder: kpis.avgOrder,
                },
                topProducts: topProducts.map((p) => ({ name: p.name, sold: p.sold, revenue: p.revenue })),
                categorySales: categorySales.map((c) => ({ name: c.name, value: c.value })),
                trafficSources: trafficSources.map((s) => ({ name: s.name, percentage: s.percentage })),
              });
              if (!ok) toast.error(t("analytics.popupBlocked"));
            }}
            className="flex items-center gap-2 px-4 py-2 bg-forest-700 hover:bg-forest-800 rounded-lg text-sm font-medium text-white transition-all"
          >
            <FileText className="w-4 h-4" />
            {t("analytics.report")}
          </button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {analyticsKPIs.map((kpi, i) => {
          const Icon = iconMap[kpi.icon] || DollarSign;
          return (
            <motion.div
              key={kpi.id}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="bg-white border border-cream-300 rounded-xl p-4 hover:border-cream-300 transition-all group"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: kpi.color + "15" }}
                >
                  <Icon className="w-4.5 h-4.5" style={{ color: kpi.color }} />
                </div>
                <div
                  className={`flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                    kpi.trend === "up"
                      ? "text-forest-700 bg-leaf-100"
                      : kpi.trend === "down" && kpi.id === "returns"
                      ? "text-forest-700 bg-leaf-100"
                      : "text-red-600 bg-red-100"
                  }`}
                >
                  {kpi.trend === "up" ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(kpi.change)}%
                </div>
              </div>
              <p className="text-lg font-bold text-forest-800">{kpi.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{kpi.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Revenue Trend + Daily Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Revenue Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2 bg-white border border-cream-300 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-forest-800">{t("analytics.revenueTrend.title")}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{t("analytics.revenueTrend.subtitle")}</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-leaf-400" />
                <span className="text-slate-500">{t("analytics.legend.revenue")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-slate-500">{t("analytics.legend.orders")}</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5FA340" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#5FA340" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5DA" />
              <XAxis dataKey="month" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="revenue"
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatNumber(v)}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="#5FA340"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                name={t("analytics.legend.revenue")}
              />
              <Area
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                stroke="#0EA5E9"
                strokeWidth={2}
                fill="url(#ordersGrad)"
                name={t("analytics.legend.orders")}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Daily Sales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-white border border-cream-300 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-forest-800 mb-1">{t("analytics.dailySales.title")}</h3>
          <p className="text-xs text-slate-500 mb-4">{t("analytics.dailySales.subtitle")}</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5DA" />
              <XAxis dataKey="day" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="orders"
                name={t("analytics.legend.orders")}
                fill="#8b5cf6"
                radius={[12, 12, 12, 12]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Top Products + Traffic Sources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="lg:col-span-2 bg-white border border-cream-300 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-forest-800">{t("analytics.topProducts.title")}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{t("analytics.topProducts.subtitle")}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cream-300">
                  <th className="text-left text-[11px] text-slate-500 font-medium pb-3 pr-4">#</th>
                  <th className="text-left text-[11px] text-slate-500 font-medium pb-3 pr-4">{t("analytics.topProducts.col.product")}</th>
                  <th className="text-left text-[11px] text-slate-500 font-medium pb-3 pr-4">{t("analytics.topProducts.col.category")}</th>
                  <th className="text-right text-[11px] text-slate-500 font-medium pb-3 pr-4">{t("analytics.topProducts.col.sold")}</th>
                  <th className="text-right text-[11px] text-slate-500 font-medium pb-3 pr-4">{t("analytics.topProducts.col.revenue")}</th>
                  <th className="text-right text-[11px] text-slate-500 font-medium pb-3">{t("analytics.topProducts.col.growth")}</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-b border-cream-300/50 hover:bg-cream-100/30 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center ${
                          i < 3 ? "bg-leaf-100 text-forest-700" : "bg-cream-100 text-slate-500"
                        }`}
                      >
                        {p.rank}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-sm text-forest-800 font-medium">{p.name}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-slate-500 bg-cream-100 px-2 py-1 rounded-md">{p.category}</span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className="text-sm text-forest-800">{p.sold.toLocaleString()}</span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className="text-sm text-forest-800 font-medium">{formatNumber(p.revenue)}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                          p.growth >= 0 ? "text-forest-700" : "text-red-600"
                        }`}
                      >
                        {p.growth >= 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {Math.abs(p.growth)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Traffic Sources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="bg-white border border-cream-300 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-forest-800 mb-1">{t("analytics.traffic.title")}</h3>
          <p className="text-xs text-slate-500 mb-4">{t("analytics.traffic.subtitle")}</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={trafficSources}
                dataKey="visitors"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                strokeWidth={0}
              >
                {trafficSources.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { name: string; visitors: number; percentage: number };
                  return (
                    <div className="bg-cream-100 border border-cream-300 rounded-xl px-4 py-3 shadow-2xl">
                      <p className="text-xs font-medium text-forest-800">{d.name}</p>
                      <p className="text-xs text-slate-500">{d.visitors.toLocaleString()} {t("analytics.orderUnit")}</p>
                      <p className="text-xs text-forest-700">{d.percentage}% {t("analytics.share")}</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {trafficSources.map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-slate-700">{s.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{s.visitors.toLocaleString()}</span>
                  <span className="text-xs text-forest-800 font-medium w-10 text-right">{s.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Category Sales + Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Category Sales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="bg-white border border-cream-300 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-forest-800 mb-1">{t("analytics.categorySales.title")}</h3>
          <p className="text-xs text-slate-500 mb-4">{t("analytics.categorySales.subtitle")}</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categorySales} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5DA" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#94A3B8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatNumber(v)}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name={t("analytics.legend.revenue")} radius={[0, 6, 6, 0]} maxBarSize={24}>
                {categorySales.map((c) => (
                  <Cell key={c.category} fill={c.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Conversion Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="bg-white border border-cream-300 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-forest-800 mb-1">{t("analytics.funnel.title")}</h3>
          <p className="text-xs text-slate-500 mb-4">{t("analytics.funnel.subtitle")}</p>
          <div className="space-y-3">
            {conversionFunnel.map((step, i) => (
              <div key={step.stage}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-700 font-medium">{step.stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-forest-800 font-semibold">
                      {step.count.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500">{step.percentage}%</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="h-8 bg-cream-100 rounded-lg overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${step.percentage}%` }}
                      transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: "easeOut" }}
                      className="h-full rounded-lg flex items-center justify-end pr-2"
                      style={{
                        backgroundColor: step.color + "30",
                        borderLeft: `3px solid ${step.color}`,
                      }}
                    >
                      {step.percentage > 10 && (
                        <span className="text-[10px] font-medium" style={{ color: step.color }}>
                          {step.percentage}%
                        </span>
                      )}
                    </motion.div>
                  </div>
                  {i < conversionFunnel.length - 1 && step.dropOff > 0 && (
                    <div className="absolute -right-1 top-1/2 -translate-y-1/2">
                      <span className="text-[9px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                        -{step.dropOff}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Geography + Customer Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Geography */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="bg-white border border-cream-300 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-forest-800 mb-1">{t("analytics.geography.title")}</h3>
          <p className="text-xs text-slate-500 mb-4">{t("analytics.geography.subtitle")}</p>
          <div className="space-y-3">
            {geographyData.map((g, i) => (
              <motion.div
                key={g.city}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.05 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-forest-800 font-medium">{g.city}</span>
                    <span className="text-[10px] text-slate-500">{g.orders} {t("analytics.orderUnit")}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">{g.percentage}%</span>
                </div>
                <div className="h-2 bg-cream-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${g.percentage}%` }}
                    transition={{ duration: 0.6, delay: 0.7 + i * 0.05 }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, #10b981, ${i < 3 ? "#34d399" : "#6ee7b7"})`,
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Customer Segments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="bg-white border border-cream-300 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-forest-800 mb-1">{t("analytics.segments.title")}</h3>
          <p className="text-xs text-slate-500 mb-4">{t("analytics.segments.subtitle")}</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {customerSegments.map((seg, i) => (
              <motion.div
                key={seg.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65 + i * 0.08 }}
                className="bg-cream-100/50 border border-cream-300 rounded-xl p-3.5 hover:border-cream-300 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-xs text-slate-700 font-medium">{seg.name}</span>
                </div>
                <p className="text-lg font-bold text-forest-800">{seg.count.toLocaleString()}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-500">{seg.percentage}%</span>
                  <span className="text-[10px] text-slate-500">
                    ~{seg.avgOrders} {t("analytics.orderUnit")}
                  </span>
                </div>
                {/* Mini progress */}
                <div className="h-1 bg-cream-200 rounded-full mt-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${seg.percentage}%` }}
                    transition={{ duration: 0.6, delay: 0.8 + i * 0.08 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Segment summary pie */}
          <div className="bg-cream-100/30 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {customerSegments.map((seg) => (
                <div key={seg.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="text-[10px] text-slate-500">{seg.name.split(" ")[0]}</span>
                </div>
              ))}
            </div>
            <span className="text-xs text-forest-800 font-semibold">
              {customerSegments.reduce((a, s) => a + s.count, 0).toLocaleString()} {t("analytics.totalLabel")}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Xarajatlar tarkibi — daromaddan yetkazib berish + xizmat (boshqaruv ko'rinishi) */}
      {kpis && (() => {
        const cur = tenant?.currency ?? "UZS";
        const bd = priceBreakdown(kpis.revenue.value, tenant?.deliveryPct, tenant?.servicePct);
        const rows = [
          { key: "product", label: t("pricing.product"), value: bd.product, color: "#10b981" },
          { key: "delivery", label: `${t("pricing.delivery")} (${tenant?.deliveryPct ?? 3}%)`, value: bd.delivery, color: "#3b82f6" },
          { key: "service", label: `${t("pricing.service")} (${tenant?.servicePct ?? 15}%)`, value: bd.service, color: "#8b5cf6" },
        ];
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.65 }}
            className="bg-white border border-cream-300 rounded-2xl p-5 mb-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-forest-700" />
              <h3 className="text-sm font-semibold text-forest-800">{t("pricing.costs")}</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">{t("pricing.desc")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {rows.map((r) => (
                <div key={r.key} className="bg-cream-50 border border-cream-300 rounded-xl p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="text-[11px] text-slate-500">{r.label}</span>
                  </div>
                  <p className="text-lg font-bold text-forest-800">{formatCurrency(r.value, cur)}</p>
                </div>
              ))}
              {/* Jami — yorqin (leaf) aksent */}
              <div className="bg-leaf-100 border border-leaf-400/50 rounded-xl p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-leaf-400" />
                  <span className="text-[11px] text-forest-700">{t("pricing.total")}</span>
                </div>
                <p className="text-lg font-bold text-forest-800">{formatCurrency(bd.total, cur)}</p>
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.0 }}
        className="mt-8 pt-6 border-t border-cream-300"
      >
        <p className="text-xs text-slate-400 text-center">
          {t("analytics.footer")} · ShopFlow Analytics · {new Date().toLocaleDateString("uz-UZ")}
        </p>
      </motion.div>
    </>
  );
}
