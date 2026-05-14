import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Send,
  ArrowUpDown,
  Download,
  Trash2,
  CheckSquare,
  Square,
  TrendingUp,
  TrendingDown,
  CalendarDays,
} from "lucide-react";
import { allOrders, orderStats } from "../data/ordersData";
import type { Order } from "../data/ordersData";
import OrderDetailModal from "./OrderDetailModal";

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  completed: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  processing: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: Clock },
  pending: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: AlertCircle },
  cancelled: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: XCircle },
  shipped: { color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", icon: Send },
};

const paymentConfig: Record<string, { color: string }> = {
  paid: { color: "text-emerald-400" },
  pending: { color: "text-amber-400" },
  failed: { color: "text-red-400" },
  refunded: { color: "text-slate-400" },
};

type SortKey = "id" | "customer" | "amount" | "date" | "status";
type SortDir = "asc" | "desc";

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const filteredOrders = useMemo(() => {
    let result = [...allOrders];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q) ||
          o.product.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }

    if (paymentFilter !== "all") {
      result = result.filter((o) => o.payment === paymentFilter);
    }

    result.sort((a, b) => {
      let aVal: string | number = a[sortKey];
      let bVal: string | number = b[sortKey];
      if (sortKey === "amount") {
        aVal = a.amount;
        bVal = b.amount;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [searchQuery, statusFilter, paymentFilter, sortKey, sortDir]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  const toggleSelectAll = () => {
    if (selectedOrders.size === paginatedOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(paginatedOrders.map((o) => o.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedOrders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedOrders(next);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allOrders.length };
    allOrders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div>
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage and track all customer orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {orderStats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5"
          >
            <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
            <div className="flex items-end justify-between mt-2">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <div className={`flex items-center gap-1 text-xs font-semibold ${stat.positive ? "text-emerald-400" : "text-red-400"}`}>
                {stat.positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {stat.change}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4"
      >
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by order ID, customer, product..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {[
              { key: "all", label: "All", count: statusCounts.all },
              { key: "completed", label: "Completed", count: statusCounts.completed || 0 },
              { key: "processing", label: "Processing", count: statusCounts.processing || 0 },
              { key: "shipped", label: "Shipped", count: statusCounts.shipped || 0 },
              { key: "pending", label: "Pending", count: statusCounts.pending || 0 },
              { key: "cancelled", label: "Cancelled", count: statusCounts.cancelled || 0 },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => { setStatusFilter(s.key); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  statusFilter === s.key
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-800 text-slate-400 border border-slate-700 hover:text-white hover:border-slate-600"
                }`}
              >
                {s.label}
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  statusFilter === s.key ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-500"
                }`}>
                  {s.count}
                </span>
              </button>
            ))}
          </div>

          {/* More Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 mt-3 border-t border-slate-800">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Payment Status</label>
                  <select
                    value={paymentFilter}
                    onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="all">All Payments</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Items Per Page</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setPaymentFilter("all");
                      setSortKey("date");
                      setSortDir("desc");
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-all"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedOrders.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 mb-4"
          >
            <p className="text-sm text-emerald-400 font-medium">
              {selectedOrders.size} order{selectedOrders.size > 1 ? "s" : ""} selected
            </p>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Complete
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-medium rounded-lg transition-colors">
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              <button
                onClick={() => setSelectedOrders(new Set())}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-medium rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orders Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/30">
                <th className="py-3 px-4 w-10">
                  <button
                    onClick={toggleSelectAll}
                    className="text-slate-500 hover:text-white transition-colors"
                  >
                    {selectedOrders.size === paginatedOrders.length && paginatedOrders.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4 text-left">
                  <button
                    onClick={() => handleSort("id")}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors"
                  >
                    Order ID
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-left">
                  <button
                    onClick={() => handleSort("customer")}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors"
                  >
                    Customer
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="py-3 px-4 text-left">
                  <button
                    onClick={() => handleSort("amount")}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors"
                  >
                    Amount
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="py-3 px-4 text-left">
                  <button
                    onClick={() => handleSort("date")}
                    className="flex items-center gap-1 text-xs font-medium text-slate-500 uppercase tracking-wider hover:text-white transition-colors"
                  >
                    Date
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <Package className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No orders found matching your filters</p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                        setPaymentFilter("all");
                      }}
                      className="text-sm text-emerald-400 hover:text-emerald-300 mt-2 font-medium"
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, index) => {
                  const sCfg = statusConfig[order.status];
                  const pCfg = paymentConfig[order.payment];
                  const StatusIcon = sCfg.icon;
                  const isSelected = selectedOrders.has(order.id);

                  return (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${isSelected ? "bg-emerald-500/5" : ""}`}
                    >
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleSelect(order.id)}
                          className="text-slate-500 hover:text-white transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-medium text-white">{order.id}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-xs font-bold flex-shrink-0">
                            {order.avatar}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{order.customer}</p>
                            <p className="text-xs text-slate-500 truncate">{order.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-300 truncate">{order.product}</p>
                          <p className="text-xs text-slate-500">{order.items} item{order.items > 1 ? "s" : ""}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-sm font-semibold text-white">${order.amount.toFixed(2)}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${sCfg.bg} ${sCfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-xs font-medium ${pCfg.color}`}>
                          {order.payment.charAt(0).toUpperCase() + order.payment.slice(1)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-sm text-slate-400">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {order.date}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setDetailOrder(order)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredOrders.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of{" "}
              {filteredOrders.length} orders
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                      currentPage === pageNum
                        ? "bg-emerald-500 text-white"
                        : "text-slate-500 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {detailOrder && (
          <OrderDetailModal
            order={detailOrder}
            onClose={() => setDetailOrder(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
