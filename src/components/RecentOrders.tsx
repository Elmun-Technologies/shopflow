import { motion } from "framer-motion";
import { Eye, Loader2, Inbox } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency, formatDate } from "../utils/format";
import type { OrderStatus } from "../types/api";

const statusStyles: Record<OrderStatus, string> = {
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PROCESSING: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PENDING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CANCELLED: "bg-red-500/10 text-red-400 border-red-500/20",
  REFUNDED: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Kutilmoqda",
  PROCESSING: "Jarayonda",
  COMPLETED: "Bajarildi",
  CANCELLED: "Bekor qilindi",
  REFUNDED: "Qaytarildi",
};

export default function RecentOrders() {
  const { tenant } = useAuth();
  const currency = tenant?.currency ?? "UZS";
  const { data, loading } = useAsync(() => dashboardApi.recentOrders(), []);
  const orders = data ?? [];

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
          <p className="text-sm text-slate-500 mt-0.5">Oxirgi 10 ta zakaz</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="w-10 h-10 text-slate-700 mb-2" />
          <p className="text-sm text-slate-500">Hozircha buyurtmalar yo'q</p>
          <p className="text-xs text-slate-600 mt-1">Kanallar orqali kelgan zakazlar shu yerda paydo bo'ladi</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">Kod</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">Mijoz</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">Kanal</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">Summa</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">Sana</th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                >
                  <td className="py-3.5 pr-4">
                    <span className="text-sm font-medium text-white">#{order.code}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <div>
                      <p className="text-sm text-white">{order.customer?.name ?? "—"}</p>
                      <p className="text-xs text-slate-500">{order.customer?.email ?? order.customer?.phone ?? ""}</p>
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-sm text-slate-300">{order.channel?.name ?? "—"}</span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-sm font-medium text-white">
                      {formatCurrency(Number(order.total), order.currency || currency)}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[order.status]}`}
                    >
                      {statusLabels[order.status]}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-sm text-slate-500">{formatDate(order.createdAt)}</span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
