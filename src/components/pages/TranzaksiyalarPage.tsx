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
import { getLang, useT } from "../../i18n";

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

const TYPE_CONF: Record<string, { labelKey: string; icon: typeof TrendingUp; color: string }> = {
  EARN:   { labelKey: "loyaltyTx.type.EARN",   icon: TrendingUp,  color: "#5FA340" },
  SPEND:  { labelKey: "loyaltyTx.type.SPEND",  icon: TrendingDown, color: "#ef4444" },
  EXPIRE: { labelKey: "loyaltyTx.type.EXPIRE", icon: Clock,       color: "#94a3b8" },
  ADJUST: { labelKey: "loyaltyTx.type.ADJUST", icon: Award,       color: "#3b82f6" },
  BONUS:  { labelKey: "loyaltyTx.type.BONUS",  icon: Gift,        color: "#8b5cf6" },
};

export default function TranzaksiyalarPage() {
  const { t } = useT();
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
    ? items.filter((tx) =>
        tx.account.customer.name.toLowerCase().includes(search.toLowerCase()) ||
        (tx.account.customer.phone ?? "").includes(search)
      )
    : items;

  const exportCsv = () => {
    const rows = [
      [
        t("loyaltyTx.csv.date"),
        t("loyaltyTx.csv.customer"),
        t("loyaltyTx.csv.phone"),
        t("loyaltyTx.csv.type"),
        t("loyaltyTx.csv.points"),
        t("loyaltyTx.csv.balance"),
        t("loyaltyTx.csv.note"),
      ].join(","),
      ...items.map((tx) => [
        new Date(tx.createdAt).toLocaleDateString(getLang() === "ru" ? "ru-RU" : "uz-UZ"),
        `"${tx.account.customer.name}"`,
        tx.account.customer.phone ?? "",
        TYPE_CONF[tx.type] ? t(TYPE_CONF[tx.type].labelKey) : tx.type,
        tx.amount,
        tx.balance,
        `"${tx.description ?? ""}"`,
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
          <h1 className="text-2xl font-bold text-forest-900">{t("loyaltyTx.title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("loyaltyTx.subtitle", { count: total.toLocaleString() })}
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2.5 bg-cream-100 hover:bg-cream-200 border border-cream-300 text-forest-800 rounded-xl text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          {t("loyaltyTx.exportCsv")}
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
            placeholder={t("loyaltyTx.searchPlaceholder")}
            className="w-full bg-white border border-cream-300 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-leaf-500/60"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          className="bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none min-w-[160px]"
        >
          <option value="">{t("loyaltyTx.allTypes")}</option>
          {Object.entries(TYPE_CONF).map(([key, conf]) => (
            <option key={key} value={key}>{t(conf.labelKey)}</option>
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
          title={t("loyaltyTx.empty.title")}
          description={t("loyaltyTx.empty.description")}
          buttonText=""
          onButtonClick={() => {}}
        />
      ) : (
        <div className="bg-white border border-cream-300/80 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-cream-300">
                  {[
                    { key: "date", label: t("loyaltyTx.col.date") },
                    { key: "customer", label: t("loyaltyTx.col.customer") },
                    { key: "type", label: t("loyaltyTx.col.type") },
                    { key: "points", label: t("loyaltyTx.col.points") },
                    { key: "balance", label: t("loyaltyTx.col.balance") },
                    { key: "note", label: t("loyaltyTx.col.note") },
                  ].map((h) => (
                    <th
                      key={h.key}
                      className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3"
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const conf = TYPE_CONF[tx.type] ?? { labelKey: "", icon: Award, color: "#94a3b8" };
                  const ConfIcon = conf.icon;
                  const confLabel = conf.labelKey ? t(conf.labelKey) : tx.type;
                  const isEarn = tx.amount > 0;
                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-cream-300/50 hover:bg-cream-50/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString(getLang() === "ru" ? "ru-RU" : "uz-UZ", {
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
                          {confLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-sm font-bold"
                          style={{ color: isEarn ? "#5FA340" : "#ef4444" }}
                        >
                          {isEarn ? "+" : ""}{t("loyaltyTx.pointsN", { count: tx.amount.toLocaleString() })}
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
                  {t("loyaltyTx.prev")}
                </button>
                <span className="px-3 py-1.5 text-xs font-medium text-forest-800">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-cream-100 disabled:opacity-40 transition-colors"
                >
                  {t("loyaltyTx.next")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
