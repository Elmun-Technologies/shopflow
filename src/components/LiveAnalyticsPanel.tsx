import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { motion } from "framer-motion";
import { Loader2, TrendingUp, ShoppingBag, Users, Package, AlertTriangle } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

const SOURCE_COLORS: Record<string, string> = {
  miniapp: "#10b981",
  telegram: "#3b82f6",
  admin: "#a855f7",
};
const SOURCE_LABELS: Record<string, string> = {
  miniapp: "Mini App",
  telegram: "Bot menyu",
  admin: "Admin qo'lda",
};

export default function LiveAnalyticsPanel() {
  const { onShopEvent } = useNotifications();
  const [dashboard, setDashboard] = useState<{
    revenue: { today: number; yesterday: number; week: number; month: number; deltaPct: number };
    orders: { today: number; week: number; month: number; total: number; pending: number };
    customers: { total: number; newToday: number; newWeek: number };
    products: { total: number; lowStock: number; outOfStock: number };
  } | null>(null);
  const [revenueData, setRevenueData] = useState<Array<{ date: string; revenue: number; orders: number }>>([]);
  const [topProducts, setTopProducts] = useState<Array<{ productName: string; totalRevenue: number; orderCount: number }>>([]);
  const [sources, setSources] = useState<Array<{ source: string; count: number; revenue: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  async function load() {
    try {
      const [d, r, top, src] = await Promise.all([
        api.analytics.dashboard().catch(() => null),
        api.analytics.revenue(days).catch(() => []),
        api.analytics.topProducts(8).catch(() => []),
        api.analytics.sources().catch(() => []),
      ]);
      setDashboard(d);
      setRevenueData(r);
      setTopProducts(top);
      setSources(src);
    } catch (err) {
      if (err instanceof ApiError) console.warn("Analytics load:", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return onShopEvent((ev) => {
      if (ev.type === "order.created" || ev.type === "order.updated") void load();
    });
  }, [days, onShopEvent]);

  const formattedRevenue = useMemo(() => revenueData.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" }),
  })), [revenueData]);

  const sourceData = useMemo(() => sources.map((s) => ({
    name: SOURCE_LABELS[s.source] ?? s.source,
    value: s.revenue,
    count: s.count,
    color: SOURCE_COLORS[s.source] ?? "#94a3b8",
  })), [sources]);

  if (loading && !dashboard) {
    return <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>;
  }

  if (!dashboard) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-amber-400 text-sm">
        Backend bilan aloqa yo'q. Real-time analytics ko'rsatib bo'lmaydi.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <h3 className="text-white font-semibold">📊 Real-time analytics (Telegram bot)</h3>
              <p className="text-xs text-slate-500">Backend'dan jonli ma'lumot</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${days === d ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"}`}
              >
                {d} kun
              </button>
            ))}
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-6">
          <KpiCard
            icon={TrendingUp}
            label="Tushum (oy)"
            value={`${dashboard.revenue.month.toLocaleString()} so'm`}
            sub={`Bugun: ${dashboard.revenue.today.toLocaleString()}`}
            accent="text-emerald-400"
            delta={dashboard.revenue.deltaPct}
          />
          <KpiCard
            icon={ShoppingBag}
            label="Buyurtmalar"
            value={String(dashboard.orders.month)}
            sub={`Bugun: ${dashboard.orders.today} · Kutilmoqda: ${dashboard.orders.pending}`}
            accent="text-blue-400"
          />
          <KpiCard
            icon={Users}
            label="Mijozlar"
            value={String(dashboard.customers.total)}
            sub={`+${dashboard.customers.newWeek} hafta · +${dashboard.customers.newToday} bugun`}
            accent="text-violet-400"
          />
          <KpiCard
            icon={Package}
            label="Katalog"
            value={String(dashboard.products.total)}
            sub={dashboard.products.lowStock > 0 ? `${dashboard.products.lowStock} stokda kam` : "Stok normal"}
            accent={dashboard.products.lowStock > 0 ? "text-amber-400" : "text-slate-300"}
            warning={dashboard.products.lowStock > 0}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart - 2/3 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Daromad ({days} kun)</h3>
          <p className="text-xs text-slate-500 mb-4">Kun bo'yicha</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedRevenue}>
                <defs>
                  <linearGradient id="liveRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { revenue: number; orders: number };
                    return (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
                        <p className="text-slate-300">{label}</p>
                        <p className="text-emerald-400 font-semibold">{p.revenue.toLocaleString()} so'm</p>
                        <p className="text-slate-500">{p.orders} buyurtma</p>
                      </div>
                    );
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#liveRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Source pie - 1/3 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Manbalar</h3>
          <p className="text-xs text-slate-500 mb-4">Buyurtma manbai bo'yicha</p>
          {sourceData.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-12">Ma'lumot yo'q</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {sourceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as { name: string; value: number; count: number };
                      return (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
                          <p className="text-slate-300">{p.name}</p>
                          <p className="text-emerald-400 font-semibold">{p.value.toLocaleString()} so'm</p>
                          <p className="text-slate-500">{p.count} buyurtma</p>
                        </div>
                      );
                    }}
                  />
                  <Legend formatter={(value) => <span className="text-slate-300 text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </div>

      {/* Top products bar chart */}
      {topProducts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Eng ko'p sotilayotgan mahsulotlar</h3>
          <p className="text-xs text-slate-500 mb-4">Daromad bo'yicha</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts.slice(0, 8)} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="productName" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as { totalRevenue: number; orderCount: number };
                    return (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
                        <p className="text-slate-300">{label}</p>
                        <p className="text-emerald-400 font-semibold">{p.totalRevenue.toLocaleString()} so'm</p>
                        <p className="text-slate-500">{p.orderCount} buyurtma</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="totalRevenue" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent, delta, warning }: {
  icon: React.ElementType; label: string; value: string; sub: string; accent: string; delta?: number; warning?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-800 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        {warning && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
        {delta !== undefined && (
          <span className={`text-[10px] font-medium ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${accent}`}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{sub}</p>
    </div>
  );
}
