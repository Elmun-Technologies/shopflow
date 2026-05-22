import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users,
  Target, RotateCcw, ArrowUpRight, ArrowDownRight, ChevronRight,
  Download, Receipt, Loader2,
} from "lucide-react";
import { timeRangeLabels } from "../data/analyticsData";
import type { AnalyticsTimeRange } from "../data/analyticsData";
import type { ChartTooltipProps } from "../utils/chart";
import { dashboardApi } from "../api/endpoints";
import { useT } from "../i18n";

interface KpiData {
  revenue: { value: number; change: number };
  orders: { value: number; change: number };
  customers: { value: number; change: number };
  conversion: { value: number; change: number };
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
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-xs text-slate-400 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={p.dataKey ?? p.name ?? i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-xs text-slate-300">{p.name}:</span>
          <span className="text-xs text-white font-semibold">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const { t } = useT();
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

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      dashboardApi.kpis(),
      dashboardApi.revenueTrend(),
      dashboardApi.dailySales(30),
      dashboardApi.topProducts(),
      dashboardApi.trafficSources(),
      dashboardApi.salesByCategory(),
      dashboardApi.geography(),
      dashboardApi.funnel(),
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
  }, [timeRange]);

  // Backend KPI'larni 6-kartochka shapega adapt qilamiz
  type AdaptedKpi = { id: string; label: string; value: string; change: number; trend: "up" | "down"; icon: string; color: string };
  const analyticsKPIs = useMemo<AdaptedKpi[]>(() => {
    if (!kpis) return [];
    const fmt = (n: number) => n >= 1e9 ? (n / 1e9).toFixed(1) + " mlrd" : n >= 1e6 ? (n / 1e6).toFixed(1) + " mln" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : n.toLocaleString();
    const avgOrder = kpis.orders.value > 0 ? kpis.revenue.value / kpis.orders.value : 0;
    return [
      { id: "revenue", label: "Daromad", value: fmt(kpis.revenue.value) + " so'm", change: Math.round(kpis.revenue.change), trend: kpis.revenue.change >= 0 ? "up" : "down", icon: "DollarSign", color: "#10b981" },
      { id: "orders", label: "Buyurtmalar", value: fmt(kpis.orders.value), change: Math.round(kpis.orders.change), trend: kpis.orders.change >= 0 ? "up" : "down", icon: "ShoppingCart", color: "#3b82f6" },
      { id: "customers", label: "Mijozlar", value: fmt(kpis.customers.value), change: Math.round(kpis.customers.change), trend: kpis.customers.change >= 0 ? "up" : "down", icon: "Users", color: "#8b5cf6" },
      { id: "conversion", label: "Konversiya", value: kpis.conversion.value.toFixed(1) + "%", change: Math.round(kpis.conversion.change), trend: kpis.conversion.change >= 0 ? "up" : "down", icon: "Target", color: "#f59e0b" },
      { id: "avg", label: "O'rtacha chek", value: fmt(avgOrder) + " so'm", change: 0, trend: "up", icon: "Receipt", color: "#06b6d4" },
      { id: "returns", label: "Qaytarish", value: "0%", change: 0, trend: "down", icon: "RotateCcw", color: "#94a3b8" },
    ];
  }, [kpis]);

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
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
        className="flex items-start justify-between mb-6"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">{t("analytics.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("analytics.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
            {(Object.keys(timeRangeLabels) as AnalyticsTimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  timeRange === range
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {timeRangeLabels[range]}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all">
            <Download className="w-4 h-4" />
            {t("analytics.export")}
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
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all group"
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
                      ? "text-emerald-400 bg-emerald-400/10"
                      : kpi.trend === "down" && kpi.id === "returns"
                      ? "text-emerald-400 bg-emerald-400/10"
                      : "text-red-400 bg-red-400/10"
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
              <p className="text-lg font-bold text-white">{kpi.value}</p>
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
          className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">{t("analytics.revenueTrend.title")}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{t("analytics.revenueTrend.subtitle")}</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-400">{t("analytics.legend.revenue")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-slate-400">{t("analytics.legend.orders")}</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyRevenue}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="revenue"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatNumber(v)}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                name="Daromad"
              />
              <Area
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#ordersGrad)"
                name="Buyurtmalar"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Daily Sales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Haftalik sotuv</h3>
          <p className="text-xs text-slate-500 mb-4">Haftaning kunlari bo'yicha</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="orders"
                name="Buyurtmalar"
                fill="#8b5cf6"
                radius={[6, 6, 0, 0]}
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
          className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Top mahsulotlar</h3>
              <p className="text-xs text-slate-500 mt-0.5">Eng ko'p sotilgan mahsulotlar</p>
            </div>
            <button className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
              Barchasi <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-[11px] text-slate-500 font-medium pb-3 pr-4">#</th>
                  <th className="text-left text-[11px] text-slate-500 font-medium pb-3 pr-4">Mahsulot</th>
                  <th className="text-left text-[11px] text-slate-500 font-medium pb-3 pr-4">Kategoriya</th>
                  <th className="text-right text-[11px] text-slate-500 font-medium pb-3 pr-4">Sotilgan</th>
                  <th className="text-right text-[11px] text-slate-500 font-medium pb-3 pr-4">Daromad</th>
                  <th className="text-right text-[11px] text-slate-500 font-medium pb-3">O'sish</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center ${
                          i < 3 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500"
                        }`}
                      >
                        {p.rank}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-sm text-white font-medium">{p.name}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md">{p.category}</span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className="text-sm text-white">{p.sold.toLocaleString()}</span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className="text-sm text-white font-medium">{formatNumber(p.revenue)}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                          p.growth >= 0 ? "text-emerald-400" : "text-red-400"
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
          className="bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Trafik manbalari</h3>
          <p className="text-xs text-slate-500 mb-4">Tashrifchilar qayerdan keladi</p>
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
                  const d = payload[0].payload;
                  return (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl">
                      <p className="text-xs font-medium text-white">{d.name}</p>
                      <p className="text-xs text-slate-400">{d.visitors.toLocaleString()} tashrif</p>
                      <p className="text-xs text-emerald-400">{d.conversions} konversiya</p>
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
                  <span className="text-xs text-slate-300">{s.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{s.visitors.toLocaleString()}</span>
                  <span className="text-xs text-white font-medium w-10 text-right">{s.percentage}%</span>
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
          className="bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Kategoriya bo'yicha sotuv</h3>
          <p className="text-xs text-slate-500 mb-4">Har bir kategoriyaning ulushi</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categorySales} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "#64748b", fontSize: 11 }}
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
              <Bar dataKey="revenue" name="Daromad" radius={[0, 6, 6, 0]} maxBarSize={24}>
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
          className="bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Konversiya funnel</h3>
          <p className="text-xs text-slate-500 mb-4">Tashrifdan buyurtmagacha</p>
          <div className="space-y-3">
            {conversionFunnel.map((step, i) => (
              <div key={step.stage}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-300 font-medium">{step.stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white font-semibold">
                      {step.count.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-500">{step.percentage}%</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="h-8 bg-slate-800 rounded-lg overflow-hidden">
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
                      <span className="text-[9px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">
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
          className="bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Geografiya</h3>
          <p className="text-xs text-slate-500 mb-4">Shaharlar bo'yicha buyurtmalar</p>
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
                    <span className="text-xs text-white font-medium">{g.city}</span>
                    <span className="text-[10px] text-slate-500">{g.orders} buyurtma</span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">{g.percentage}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
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
          className="bg-slate-900 border border-slate-800 rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-1">Mijoz segmentlari</h3>
          <p className="text-xs text-slate-500 mb-4">Mijozlar toifasi bo'yicha taqsimot</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {customerSegments.map((seg, i) => (
              <motion.div
                key={seg.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65 + i * 0.08 }}
                className="bg-slate-800/50 border border-slate-800 rounded-xl p-3.5 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-xs text-slate-300 font-medium">{seg.name}</span>
                </div>
                <p className="text-lg font-bold text-white">{seg.count.toLocaleString()}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-500">{seg.percentage}%</span>
                  <span className="text-[10px] text-slate-500">
                    ~{seg.avgOrders} buyurtma
                  </span>
                </div>
                {/* Mini progress */}
                <div className="h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
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
          <div className="bg-slate-800/30 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {customerSegments.map((seg) => (
                <div key={seg.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="text-[10px] text-slate-400">{seg.name.split(" ")[0]}</span>
                </div>
              ))}
            </div>
            <span className="text-xs text-white font-semibold">
              {customerSegments.reduce((a, s) => a + s.count, 0).toLocaleString()} jami
            </span>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.0 }}
        className="mt-8 pt-6 border-t border-slate-800"
      >
        <p className="text-xs text-slate-600 text-center">
          Barcha ma'lumotlar demo maqsadida ko'rsatilgan · ShopFlow Analytics
        </p>
      </motion.div>
    </>
  );
}
