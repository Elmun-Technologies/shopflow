import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ShoppingBag } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

const statusStyles: Record<string, { label: string; class: string }> = {
  pending: { label: "Kutilmoqda", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  confirmed: { label: "Tasdiqlandi", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  preparing: { label: "Tayyorlanmoqda", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  shipping: { label: "Yetkazilmoqda", class: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  delivered: { label: "Yetkazildi", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Bekor qilindi", class: "bg-red-500/10 text-red-400 border-red-500/20" },
};

interface RecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string | number;
  customerName: string;
  customerPhone: string | null;
}

export default function RecentOrders() {
  const { onShopEvent } = useNotifications();
  const [orders, setOrders] = useState<RecentOrder[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const d = await api.analytics.recentOrders(10);
      setOrders(d);
    } catch (err) {
      if (err instanceof ApiError) console.warn("Recent orders:", err.message);
      setOrders([]);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.7 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">So'nggi buyurtmalar</h3>
          <p className="text-sm text-slate-500 mt-0.5">Telegram bot orqali real-time</p>
        </div>
        <ShoppingBag className="w-5 h-5 text-emerald-400" />
      </div>

      {loading && !orders ? (
        <div className="h-32 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-600" /></div>
      ) : !orders || orders.length === 0 ? (
        <p className="text-center text-sm text-slate-500 py-8">Hali buyurtma yo'q</p>
      ) : (
        <div className="overflow-x-auto -mx-5">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-2">№</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-2">Mijoz</th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-2">Summa</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-2">Holat</th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-2">Sana</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const st = statusStyles[order.status] ?? { label: order.status, class: "bg-slate-700 text-slate-300 border-slate-600" };
                return (
                  <tr key={order.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-5 py-3 text-xs font-mono text-slate-300">{order.orderNumber}</td>
                    <td className="px-3 py-3">
                      <div>
                        <p className="text-sm text-white">{order.customerName}</p>
                        {order.customerPhone && <p className="text-xs text-slate-500">{order.customerPhone}</p>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-emerald-400 text-right">{order.total.toLocaleString()} so'm</td>
                    <td className="px-3 py-3">
                      <span className={`inline-block text-[10px] font-medium px-2 py-1 rounded-full border ${st.class}`}>{st.label}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 text-right whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
