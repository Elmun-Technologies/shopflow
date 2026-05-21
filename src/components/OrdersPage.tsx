import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Loader2, Inbox, Eye, AlertCircle, ChevronDown } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { ordersApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency, formatDate } from "../utils/format";
import type { Order, OrderStatus } from "../types/api";
import { useAppToast } from "./ui/Toast";
import OrderDetailDrawer from "./OrderDetailDrawer";

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Kutilmoqda", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  PROCESSING: { label: "Jarayonda", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  COMPLETED: { label: "Bajarildi", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  CANCELLED: { label: "Bekor qilindi", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  REFUNDED: { label: "Qaytarildi", color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20" },
};

export default function OrdersPage() {
  const { tenant } = useAuth();
  const currency = tenant?.currency ?? "UZS";
  const [search, setSearch] = useState("");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: search || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { data, loading, error, refetch } = useAsync(() => ordersApi.list(params), [
    page,
    search,
    statusFilter,
  ]);

  const orders = data?.items ?? [];
  const total = data?.total ?? 0;

  const tabs: { key: OrderStatus | "all"; label: string }[] = [
    { key: "all", label: "Hammasi" },
    { key: "PENDING", label: "Kutilmoqda" },
    { key: "PROCESSING", label: "Jarayonda" },
    { key: "COMPLETED", label: "Bajarildi" },
    { key: "CANCELLED", label: "Bekor" },
    { key: "REFUNDED", label: "Qaytarildi" },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-white">Buyurtmalar</h1>
        <p className="text-sm text-slate-500 mt-1">Barcha kanallardan kelgan zakazlar</p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buyurtma kodi, mijoz..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </label>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white transition-all"
        >
          <Plus className="w-4 h-4" />
          Yangi buyurtma
        </button>
      </div>

      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setStatusFilter(t.key);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
              statusFilter === t.key
                ? "bg-emerald-500 text-white"
                : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-sm text-slate-300">{error.message}</p>
            <button onClick={refetch} className="mt-3 px-3 py-1.5 text-xs bg-slate-800 rounded-lg text-slate-300">
              Qaytadan urinish
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Inbox className="w-12 h-12 text-slate-700 mb-3" />
            <p className="text-base font-semibold text-white">
              {search ? "Buyurtma topilmadi" : "Hozircha buyurtmalar yo'q"}
            </p>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              Kanallardan kelgan zakazlar va qo'lda kiritilgan buyurtmalar shu yerda paydo bo'ladi.
            </p>
          </div>
        ) : (
          <OrderTable orders={orders} currency={currency} onChanged={refetch} onOpen={setOpenOrderId} />
        )}

        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
              >
                Oldingi
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= total}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
              >
                Keyingi
              </button>
            </div>
          </div>
        )}
      </div>

      <OrderDetailDrawer
        orderId={openOrderId}
        onClose={() => setOpenOrderId(null)}
        onChanged={refetch}
      />
    </>
  );
}

function OrderTable({
  orders, currency, onChanged, onOpen,
}: {
  orders: Order[]; currency: string; onChanged: () => void; onOpen: (id: string) => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const toast = useAppToast();

  const handleChangeStatus = async (orderId: string, status: OrderStatus, code: string) => {
    setOpenMenuId(null);
    setUpdatingId(orderId);
    try {
      await ordersApi.update(orderId, { status });
      toast.success(`#${code} → ${statusConfig[status].label}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status yangilanmadi");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Kod</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Mijoz</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Kanal</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Summa</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Status</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Sana</th>
            <th className="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const cfg = statusConfig[order.status];
            return (
              <tr key={order.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="py-3 px-4">
                  <span className="text-sm font-medium text-white">#{order.code}</span>
                </td>
                <td className="py-3 px-4">
                  <div>
                    <p className="text-sm text-white">{order.customer?.name ?? "—"}</p>
                    <p className="text-xs text-slate-500">{order.customer?.email ?? order.customer?.phone ?? ""}</p>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-slate-300">{order.channel?.name ?? "—"}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm font-medium text-white">
                    {formatCurrency(Number(order.total), order.currency || currency)}
                  </span>
                </td>
                <td className="py-3 px-4 relative">
                  <button
                    onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)}
                    disabled={updatingId === order.id}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color} hover:brightness-110 transition-all disabled:opacity-50`}
                  >
                    {updatingId === order.id && <Loader2 className="w-3 h-3 animate-spin" />}
                    {cfg.label}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>
                  {openMenuId === order.id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute top-full left-4 mt-1 z-30 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 min-w-[160px]">
                        {(Object.keys(statusConfig) as OrderStatus[]).map((s) => {
                          const sc = statusConfig[s];
                          const isCurrent = s === order.status;
                          return (
                            <button
                              key={s}
                              onClick={() => !isCurrent && handleChangeStatus(order.id, s, order.code)}
                              disabled={isCurrent}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 transition-colors ${
                                isCurrent ? "opacity-60 cursor-default" : ""
                              }`}
                            >
                              <span className={sc.color}>{sc.label}</span>
                              {isCurrent && <span className="text-emerald-400">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className="text-xs text-slate-500">{formatDate(order.createdAt)}</span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => onOpen(order.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                    aria-label="Batafsil ko'rish"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
