import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Loader2, Inbox, Eye, AlertCircle, ChevronDown, Check, Download, X } from "lucide-react";
import { exportToCsv } from "../utils/exportCsv";
import { useQueryAsync } from "../hooks/useQueryAsync";
import { ordersApi, productsApi, customersApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency, formatDate } from "../utils/format";
import type { Order, OrderStatus } from "../types/api";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";
import { TableRowsSkeleton } from "./ui/Skeleton";
import { useT } from "../i18n";
import OrderDetailDrawer from "./OrderDetailDrawer";

// Faqat rangli stillar — labellar t() orqali olinadi
const statusStyle: Record<OrderStatus, { color: string; bg: string }> = {
  PENDING: { color: "text-amber-600", bg: "bg-amber-100 border-amber-300" },
  PROCESSING: { color: "text-blue-600", bg: "bg-blue-100 border-blue-300" },
  COMPLETED: { color: "text-forest-700", bg: "bg-leaf-100 border-leaf-300/60" },
  CANCELLED: { color: "text-red-600", bg: "bg-red-100 border-red-300" },
  REFUNDED: { color: "text-slate-500", bg: "bg-slate-100 border-slate-300" },
};

export default function OrdersPage() {
  const { tenant } = useAuth();
  const { t } = useT();
  const toast = useAppToast();
  const confirm = useConfirm();
  const currency = tenant?.currency ?? "UZS";
  const [search, setSearch] = useState("");
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // To'liq joriy filter natijasini yuklash (limit 500 — Excel uchun yetarli)
      const res = await ordersApi.list({
        page: 1,
        pageSize: 500,
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      exportToCsv({
        filename: `orders-${new Date().toISOString().slice(0, 10)}`,
        columns: [
          { key: "code", label: t("orders.col.code") },
          { key: "customerName", label: t("orders.col.customer") },
          { key: "phone", label: t("orders.col.phone") },
          { key: "channel", label: t("orders.col.channel") },
          { key: "total", label: t("orders.col.amount") },
          { key: "currency", label: t("orders.col.currency") },
          { key: "status", label: t("orders.col.status") },
          { key: "createdAt", label: t("orders.col.date") },
        ],
        rows: res.items.map((o) => ({
          code: `#${o.code}`,
          customerName: o.customer?.name ?? "",
          phone: o.customer?.phone ?? o.customer?.email ?? "",
          channel: o.channel?.name ?? "",
          total: Number(o.total),
          currency: o.currency || currency,
          status: t(`order.adminStatus.${o.status}`),
          createdAt: o.createdAt,
        })),
      });
    } finally {
      setExporting(false);
    }
  };

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: search || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
    }),
    [page, search, statusFilter],
  );

  const { data, loading, error, refetch } = useQueryAsync(["orders", "list", params], () => ordersApi.list(params));

  const orders = data?.items ?? [];
  const total = data?.total ?? 0;

  const resetSelection = () => {
    setSelected(new Set());
    setBulkMenuOpen(false);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    setSelected((prev) => {
      const allOnPage = orders.every((o) => prev.has(o.id));
      if (allOnPage) {
        const next = new Set(prev);
        orders.forEach((o) => next.delete(o.id));
        return next;
      }
      const next = new Set(prev);
      orders.forEach((o) => next.add(o.id));
      return next;
    });
  };

  const runBulkStatus = async (status: OrderStatus) => {
    if (selected.size === 0) return;
    setBulkMenuOpen(false);
    const ok = await confirm({
      title: t("orders.bulk.confirmTitle"),
      description: t("orders.bulk.confirmDesc", {
        n: selected.size,
        status: t(`order.adminStatus.${status}`),
      }),
      confirmText: t("orders.bulk.setStatus"),
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      const res = await ordersApi.bulk({
        ids: Array.from(selected),
        action: "setStatus",
        status,
      });
      toast.success(t("orders.bulk.success", { summary: res.summary }));
      resetSelection();
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orders.bulk.failed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const tabs: { key: OrderStatus | "all"; label: string }[] = [
    { key: "all", label: t("orders.tab.all") },
    { key: "PENDING", label: t("order.adminStatus.PENDING") },
    { key: "PROCESSING", label: t("order.adminStatus.PROCESSING") },
    { key: "COMPLETED", label: t("order.adminStatus.COMPLETED") },
    { key: "CANCELLED", label: t("orders.tab.cancelled") },
    { key: "REFUNDED", label: t("order.adminStatus.REFUNDED") },
  ];

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-forest-800">{t("orders.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("orders.subtitle")}</p>
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
              resetSelection();
            }}
            placeholder={t("orders.searchPlaceholder")}
            className="w-full bg-white border border-cream-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
          />
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-lg text-sm text-forest-800 transition-all flex-shrink-0 disabled:opacity-50"
          title={t("orders.export")}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">{t("orders.export")}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-medium text-forest-800 transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t("orders.newOrder")}</span>
        </button>
      </div>

      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setStatusFilter(tab.key);
              setPage(1);
              resetSelection();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
              statusFilter === tab.key
                ? "bg-leaf-400 text-forest-800"
                : "bg-white border border-cream-300 text-slate-500 hover:text-forest-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2 bg-leaf-100 border border-leaf-300/60 rounded-xl"
        >
          <span className="text-sm font-medium text-forest-800 mr-1">
            {t("orders.bulk.selected", { n: selected.size })}
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setBulkMenuOpen((v) => !v)}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-xs font-medium text-forest-800 transition-colors"
            >
              {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {t("orders.bulk.setStatus")}
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {bulkMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setBulkMenuOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-cream-300 rounded-xl shadow-xl py-1 min-w-[180px]">
                  {(Object.keys(statusStyle) as OrderStatus[]).map((s) => {
                    const sc = statusStyle[s];
                    return (
                      <button
                        key={s}
                        onClick={() => runBulkStatus(s)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-cream-100 transition-colors flex items-center gap-2"
                      >
                        <span className={`w-2 h-2 rounded-full ${sc.bg.split(" ")[0]}`} />
                        <span className={sc.color}>{t(`order.adminStatus.${s}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={resetSelection}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-forest-900 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {t("orders.bulk.clear")}
          </button>
        </motion.div>
      )}

      <div className="bg-white border border-cream-300 rounded-xl overflow-hidden">
        {loading ? (
          <TableRowsSkeleton rows={8} cols={7} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-600 mb-2" />
            <p className="text-sm text-slate-700">{error.message}</p>
            <button onClick={refetch} className="mt-3 px-3 py-1.5 text-xs bg-cream-100 rounded-lg text-slate-700">
              {t("orders.retry")}
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Inbox className="w-12 h-12 text-cream-300 mb-3" />
            <p className="text-base font-semibold text-forest-800">
              {search ? t("orders.empty.search") : t("orders.empty.none")}
            </p>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              {t("orders.empty.hint")}
            </p>
          </div>
        ) : (
          <OrderTable
            orders={orders}
            currency={currency}
            onChanged={refetch}
            onOpen={setOpenOrderId}
            selected={selected}
            onToggle={toggleSelect}
            onToggleAll={toggleSelectAllOnPage}
          />
        )}

        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-cream-300 text-xs text-slate-500">
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setPage((p) => Math.max(1, p - 1)); resetSelection(); }}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 disabled:opacity-30"
              >
                {t("orders.prev")}
              </button>
              <button
                onClick={() => { setPage((p) => p + 1); resetSelection(); }}
                disabled={page * pageSize >= total}
                className="px-3 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 disabled:opacity-30"
              >
                {t("orders.next")}
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

      {showCreate && (
        <OrderCreateModal
          currency={currency}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            toast.success(t("orders.create.success"));
            refetch();
          }}
        />
      )}
    </>
  );
}

function OrderCreateModal({ currency, onClose, onCreated }: { currency: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useT();
  const toast = useAppToast();
  const { data: customersData } = useQueryAsync(["customers", "list", { pageSize: 200 }], () => customersApi.list({ pageSize: 200 }));
  const { data: productsData } = useQueryAsync(["products", "list", { pageSize: 200 }], () => productsApi.list({ pageSize: 200 }));
  const customers = customersData?.items ?? [];
  const products = productsData?.items ?? [];

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<{ productId: string; qty: number; price: number }[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const addLine = () => setLines((ls) => [...ls, { productId: "", qty: 1, price: 0 }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<{ productId: string; qty: number; price: number }>) => {
    setLines((ls) => ls.map((l, idx) => {
      if (idx !== i) return l;
      const next = { ...l, ...patch };
      // Mahsulot tanlanganda narxni avtomatik to'ldiramiz
      if (patch.productId) {
        const p = products.find((pr) => pr.id === patch.productId);
        if (p) next.price = Number(p.price);
      }
      return next;
    }));
  };

  const validLines = lines.filter((l) => l.productId && l.qty > 0);
  const total = validLines.reduce((s, l) => s + l.qty * l.price, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validLines.length === 0) {
      toast.error(t("orders.create.addItemError"));
      return;
    }
    setBusy(true);
    try {
      await ordersApi.create({
        customerId: customerId || undefined,
        notes: notes.trim() || undefined,
        currency,
        items: validLines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price })),
      });
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orders.create.failed"));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <motion.form
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-cream-300 rounded-2xl p-5 max-w-lg w-full max-h-[88vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-forest-800">{t("orders.newOrder")}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-cream-100" aria-label={t("common.close")}>
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-slate-500 mb-1 block">{t("orders.col.customer")}</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={field}>
            <option value="">{t("orders.create.noCustomer")}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
            ))}
          </select>
        </label>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">{t("orders.create.productsLabel")}</span>
            <button type="button" onClick={addLine} className="inline-flex items-center gap-1 text-xs text-forest-700 hover:text-forest-900 font-medium">
              <Plus className="w-3.5 h-3.5" /> {t("common.add")}
            </button>
          </div>
          {lines.length === 0 ? (
            <div className="text-center py-4 text-xs text-slate-400 bg-cream-50 rounded-lg border border-dashed border-cream-300">
              {t("orders.create.emptyLines")}
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={line.productId}
                    onChange={(e) => updateLine(i, { productId: e.target.value })}
                    className={`${field} flex-1`}
                  >
                    <option value="">{t("orders.create.selectProduct")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={line.qty}
                    onChange={(e) => updateLine(i, { qty: Math.max(1, Number(e.target.value)) })}
                    className="w-16 bg-cream-100 border border-cream-300 rounded-lg px-2 py-2.5 text-sm text-center text-forest-800 focus:outline-none focus:border-leaf-500/60"
                  />
                  <button type="button" onClick={() => removeLine(i)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0" aria-label={t("common.delete")}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="block mb-4">
          <span className="text-xs text-slate-500 mb-1 block">{t("orders.create.notesLabel")}</span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("orders.create.notesPlaceholder")} className={field} />
        </label>

        <div className="flex items-center justify-between mb-4 px-3 py-2.5 rounded-xl bg-cream-100">
          <span className="text-sm text-slate-600">{t("orders.create.total")}</span>
          <span className="text-lg font-bold text-forest-800">{formatCurrency(total, currency)}</span>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-sm bg-cream-100 hover:bg-cream-200 text-slate-700">{t("orders.create.cancel")}</button>
          <button type="submit" disabled={busy || validLines.length === 0} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 font-medium">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("orders.create.submit")}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function OrderTable({
  orders, currency, onChanged, onOpen, selected, onToggle, onToggleAll,
}: {
  orders: Order[];
  currency: string;
  onChanged: () => void;
  onOpen: (id: string) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const toast = useAppToast();
  const { t } = useT();
  const allOnPageSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));
  const someOnPageSelected = orders.some((o) => selected.has(o.id));

  const handleChangeStatus = async (orderId: string, status: OrderStatus, code: string) => {
    setOpenMenuId(null);
    setUpdatingId(orderId);
    try {
      await ordersApi.update(orderId, { status });
      toast.success(`#${code} — ${t(`order.adminStatus.${status}`)} · 📨 ${t("orders.notified")}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orders.updateFailed"));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      {/* Desktop — jadval ko'rinishi */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-cream-300">
              <th className="py-3 pl-4 pr-2 w-10">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                  }}
                  onChange={onToggleAll}
                  aria-label={t("orders.bulk.selectAll")}
                  className="w-4 h-4 rounded border-cream-300 text-leaf-500 focus:ring-leaf-400 cursor-pointer"
                />
              </th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("orders.col.code")}</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("orders.col.customer")}</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("orders.col.channel")}</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("orders.col.amount")}</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("orders.col.status")}</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("orders.col.date")}</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const style = statusStyle[order.status];
              // PENDING — "Qabul qilish" (PROCESSING); PROCESSING — "Yetkazildi" (COMPLETED)
              const quickAction: { next: OrderStatus; label: string } | null =
                order.status === "PENDING" ? { next: "PROCESSING", label: t("orders.action.accept") }
                : order.status === "PROCESSING" ? { next: "COMPLETED", label: t("orders.action.delivered") }
                : null;
              const isSelected = selected.has(order.id);
              return (
                <tr
                  key={order.id}
                  onClick={() => onOpen(order.id)}
                  className={`border-b border-cream-300/50 transition-colors cursor-pointer ${
                    isSelected ? "bg-leaf-100/40" : "hover:bg-cream-100/30"
                  }`}
                >
                  <td className="py-3 pl-4 pr-2 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(order.id)}
                      aria-label={`#${order.code}`}
                      className="w-4 h-4 rounded border-cream-300 text-leaf-500 focus:ring-leaf-400 cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-forest-800">#{order.code}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-sm text-forest-800">{order.customer?.name ?? "—"}</p>
                      <p className="text-xs text-slate-500">{order.customer?.email ?? order.customer?.phone ?? ""}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-slate-700">{order.channel?.name ?? "—"}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-forest-800">
                      {formatCurrency(Number(order.total), order.currency || currency)}
                    </span>
                    {order.paid && (
                      <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-leaf-100 text-forest-700 align-middle">
                        <Check className="w-2.5 h-2.5" /> {t("orders.paid")}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)}
                      disabled={updatingId === order.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.color} hover:brightness-110 transition-all disabled:opacity-50`}
                    >
                      {updatingId === order.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      {t(`order.adminStatus.${order.status}`)}
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </button>
                    {openMenuId === order.id && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute top-full left-4 mt-1 z-30 bg-cream-100 border border-cream-300 rounded-xl shadow-xl py-1 min-w-[160px]">
                          {(Object.keys(statusStyle) as OrderStatus[]).map((s) => {
                            const sc = statusStyle[s];
                            const isCurrent = s === order.status;
                            return (
                              <button
                                key={s}
                                onClick={() => !isCurrent && handleChangeStatus(order.id, s, order.code)}
                                disabled={isCurrent}
                                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-cream-200 transition-colors ${
                                  isCurrent ? "opacity-60 cursor-default" : ""
                                }`}
                              >
                                <span className={sc.color}>{t(`order.adminStatus.${s}`)}</span>
                                {isCurrent && <span className="text-forest-700">✓</span>}
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
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      {quickAction && (
                        <button
                          onClick={() => handleChangeStatus(order.id, quickAction.next, order.code)}
                          disabled={updatingId === order.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-md text-xs font-medium text-forest-800 transition-colors"
                          title={t("orders.action.hint", { action: quickAction.label })}
                        >
                          {updatingId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          {quickAction.label}
                        </button>
                      )}
                      <button
                        onClick={() => onOpen(order.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100 transition-all"
                        aria-label={t("orders.viewDetails")}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile — card ko'rinishi */}
      <div className="md:hidden divide-y divide-cream-300/50">
        {orders.map((order) => {
          const style = statusStyle[order.status];
          const isSelected = selected.has(order.id);
          const quickAction: { next: OrderStatus; label: string } | null =
            order.status === "PENDING" ? { next: "PROCESSING", label: t("orders.action.accept") }
            : order.status === "PROCESSING" ? { next: "COMPLETED", label: t("orders.action.delivered") }
            : null;
          return (
            <div
              key={order.id}
              className={`flex w-full text-left transition-colors ${isSelected ? "bg-leaf-100/40" : "hover:bg-cream-100/30 active:bg-cream-100/50"}`}
            >
              <div className="flex items-start pt-4 pl-4" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(order.id)}
                  aria-label={`#${order.code}`}
                  className="w-4 h-4 rounded border-cream-300 text-leaf-500 focus:ring-leaf-400 cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => onOpen(order.id)}
                className="flex-1 text-left p-4"
              >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-forest-800">#{order.code}</p>
                  <p className="text-sm text-slate-700 truncate mt-0.5">{order.customer?.name ?? "—"}</p>
                  <p className="text-xs text-slate-500 truncate">{order.customer?.phone ?? order.customer?.email ?? ""}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-forest-800 whitespace-nowrap">
                    {formatCurrency(Number(order.total), order.currency || currency)}
                  </p>
                  {order.paid && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mt-0.5 rounded-full text-[10px] font-medium bg-leaf-100 text-forest-700">
                      <Check className="w-2.5 h-2.5" /> {t("orders.paid")}
                    </span>
                  )}
                  <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(order.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${style.bg} ${style.color}`}>
                  {updatingId === order.id && <Loader2 className="w-3 h-3 animate-spin" />}
                  {t(`order.adminStatus.${order.status}`)}
                </span>
                {quickAction && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleChangeStatus(order.id, quickAction.next, order.code); }}
                    disabled={updatingId === order.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-md text-xs font-medium text-forest-800 transition-colors"
                  >
                    {updatingId === order.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    {quickAction.label}
                  </button>
                )}
              </div>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
