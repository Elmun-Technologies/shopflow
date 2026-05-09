import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, ShoppingBag, Users, Package, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

interface DashboardData {
  revenue: { today: number; yesterday: number; week: number; month: number; deltaPct: number };
  orders: { today: number; week: number; month: number; total: number; pending: number };
  customers: { total: number; newToday: number; newWeek: number };
  products: { total: number; lowStock: number; outOfStock: number };
}

export default function KPICards() {
  const { onShopEvent } = useNotifications();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const d = await api.analytics.dashboard();
      setData(d);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return onShopEvent((ev) => {
      if (ev.type === "order.created" || ev.type === "order.updated") void load();
    });
  }, [onShopEvent]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-[120px] flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-slate-600" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-400">
        Backend bilan ulanib bo'lmadi: {error}. Demo rejim ishlatilmoqda.
      </div>
    );
  }

  const cards: Array<{ title: string; value: string; deltaPct: number | null; icon: React.ElementType; subtitle?: string }> = [
    {
      title: "Bugungi tushum",
      value: `${formatMoney(data.revenue.today)} so'm`,
      deltaPct: data.revenue.deltaPct,
      icon: DollarSign,
      subtitle: data.revenue.yesterday > 0 ? `Kecha: ${formatMoney(data.revenue.yesterday)}` : "Kecha: 0",
    },
    {
      title: "Buyurtmalar (bugun)",
      value: String(data.orders.today),
      deltaPct: null,
      icon: ShoppingBag,
      subtitle: `${data.orders.pending} kutilmoqda`,
    },
    {
      title: "Mijozlar (Telegram)",
      value: String(data.customers.total),
      deltaPct: null,
      icon: Users,
      subtitle: `+${data.customers.newToday} bugun`,
    },
    {
      title: "Mahsulotlar",
      value: String(data.products.total),
      deltaPct: null,
      icon: Package,
      subtitle: data.products.lowStock > 0 ? `${data.products.lowStock} stokda kam` : "Stok normal",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((kpi, index) => {
        const Icon = kpi.icon;
        const isPositive = kpi.deltaPct !== null ? kpi.deltaPct >= 0 : true;
        return (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">{kpi.title}</p>
                <p className="text-2xl font-bold text-white mt-1.5">{kpi.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {kpi.deltaPct !== null ? (
                    <>
                      {isPositive ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                      <span className={`text-xs font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                        {(kpi.deltaPct >= 0 ? "+" : "") + kpi.deltaPct.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-slate-500">{kpi.subtitle}</span>
                  )}
                  {kpi.deltaPct !== null && <span className="text-xs text-slate-500">{kpi.subtitle}</span>}
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

function formatMoney(v: number): string {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(v));
}
