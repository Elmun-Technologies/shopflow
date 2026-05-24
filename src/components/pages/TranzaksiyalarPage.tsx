// Sodiqlik tranzaksiyalari — real /api/loyalty/transactions
import { useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Award, Gift, Clock, Loader2,
  Download, Search,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../api/client";
import EmptyState from "../EmptyState";

interface LoyaltyTx {
  id: string;
  type: string;
  amount: number;
  balance: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
  account: {
    customer: { id: string; name: string; phone: string | null };
  };
}

const TYPE_CONF: Record<string, { label: string; icon: typeof TrendingUp; color: string }> = {
  EARN:   { label: "Ball to'plandi",  icon: TrendingUp,  color: "#10b981" },
  SPEND:  { label: "Ball sarflandi",  icon: TrendingDown, color: "#ef4444" },
  EXPIRE: { label: "Muddati tugadi",  icon: Clock,       color: "#94a3b8" },
  ADJUST: { label: "Sozlash",         icon: Award,       color: "#3b82f6" },
  BONUS:  { label: "Bonus",           icon: Gift,        color: "#8b5cf6" },
};

export default function TranzaksiyalarPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");

  const { data, loading, refetch } = useAsync<{
    items: LoyaltyTx[];
    total: number;
    page: number;
    pageSize: number;
  }>(
    () => api("/loyalty/transactions", {
      query: { page, pageSize: 25, ...(filterType ? { type: filterType } : {}) },
    }),
    [page, filterType],
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const totalPages = Math.ceil(total / pageSize);

  const filtered = search
    ? items.filter((t) =>
        t.account.customer.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.account.customer.phone ?? "").includes(search)
      )
    : items;

  const exportCsv = () => {
    const rows = [
      ["Sana", "Mijoz", "Telefon", "Tur", "Ball", "Balans", "Izoh"].join(","),
      ...items.map((t) => [
        new Date(t.createdAt).toLocaleDateString("uz-UZ"),
        `"${t.account.customer.name}"`,
        t.account.customer.phone ?? "",
        TYPE_CONF[t.type]?.label ?? t.type,
        t.amount,
        t.balance,
        `"${t.description ?? ""}"`,
      ].join(",")),
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + rows], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `loyalty-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  void refetch;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-forest-900">Ball tranzaksiyalari</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Jami: {total.toLocaleString()} ta tranzaksiya
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2.5 bg-cream-100 hover:bg-cream-200 border border-cream-300 text-forest-800 rounded-xl text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          CSV yuklab olish
        </button>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mijoz ismi yoki telefon bo'yicha..."
            className="w-full bg-white border border-cream-300 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-leaf-500/60"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          className="bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-w-[160px]"
        >
          <option value="">Barcha turlar</option>
          {Object.entries(TYPE_CONF).map(([key, conf]) => (
            <option key={key} value={key}>{conf.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Award}
          title="Tranzaksiyalar yo'q"
          description="Hali sodiqlik tranzaksiyalari mavjud emas"
          buttonText=""
          onButtonClick={() => {}}
        />
      ) : (
        <div className="bg-white border border-cream-300/80 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cream-300">
                  {["Sana", "Mijoz", "Tur", "Ball", "Balans", "Izoh"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const conf = TYPE_CONF[tx.type] ?? { label: tx.type, icon: Award, color: "#94a3b8" };
                  const ConfIcon = conf.icon;
                  const isEarn = tx.amount > 0;
                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-cream-300/50 hover:bg-cream-50/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString("uz-UZ", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-forest-800">{tx.account.customer.name}</p>
                        {tx.account.customer.phone && (
                          <p className="text-xs text-slate-400">{tx.account.customer.phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: conf.color + "15", color: conf.color }}
                        >
                          <ConfIcon className="w-3 h-3" />
                          {conf.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-bold"
                          style={{ color: isEarn ? "#10b981" : "#ef4444" }}
                        >
                          {isEarn ? "+" : ""}{tx.amount.toLocaleString()} ball
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-forest-800 font-medium">
                          {tx.balance.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                        {tx.description ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-cream-300">
              <p className="text-xs text-slate-500">
                {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} / {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-cream-100 disabled:opacity-40 transition-colors"
                >
                  Oldingi
                </button>
                <span className="px-3 py-1.5 text-xs font-medium text-forest-800">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-cream-100 disabled:opacity-40 transition-colors"
                >
                  Keyingi
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
