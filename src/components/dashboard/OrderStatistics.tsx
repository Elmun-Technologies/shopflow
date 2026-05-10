import { useEffect, useState } from "react";
import { Send, Globe, ShoppingBag } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useNotifications } from "../../lib/notifications";

interface TrafficRow { source: string; label: string; orders: number; revenue: number; customers: number }

const sourceMeta: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  telegram: { icon: Send, color: "text-blue-400", bg: "bg-blue-500/15" },
  miniapp: { icon: ShoppingBag, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  admin: { icon: Globe, color: "text-violet-400", bg: "bg-violet-500/15" },
};

export default function OrderStatistics() {
  const { onShopEvent } = useNotifications();
  const [traffic, setTraffic] = useState<TrafficRow[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);

  async function load() {
    try {
      const t = await api.analytics.traffic();
      setTraffic(t);
      setTotalOrders(t.reduce((s, r) => s + r.orders, 0));
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    }
  }

  useEffect(() => {
    void load();
    return onShopEvent((ev) => {
      if (ev.type === "order.created" || ev.type === "order.updated") void load();
    });
  }, [onShopEvent]);

  const max = Math.max(1, ...traffic.map((t) => t.orders));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-full">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">Buyurtmalar statistikasi</h3>
        <p className="text-xs text-slate-500 mt-0.5">Manba bo'yicha taqsimlanish</p>
      </div>

      <div className="text-center mb-4">
        <p className="text-3xl font-bold text-white">{totalOrders}</p>
        <p className="text-xs text-slate-500 mt-1">Jami buyurtmalar</p>
      </div>

      <div className="space-y-3">
        {traffic.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-6">Hali buyurtma yo'q</p>
        ) : (
          traffic.map((t) => {
            const meta = sourceMeta[t.source] ?? { icon: Globe, color: "text-slate-400", bg: "bg-slate-700" };
            const Icon = meta.icon;
            const percent = (t.orders / max) * 100;
            return (
              <div key={t.source}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{t.label}</p>
                  </div>
                  <span className="text-sm font-semibold text-white">{t.orders}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${t.source === "telegram" ? "bg-blue-500" : t.source === "miniapp" ? "bg-emerald-500" : "bg-violet-500"}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
