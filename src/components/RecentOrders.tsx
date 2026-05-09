import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { recentOrders } from "../data/dashboardData";

const statusStyles: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  processing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function RecentOrders() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(recentOrders.length / itemsPerPage);
  const paginatedOrders = recentOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.7 }}
      className="bg-slate-900 border border-slate-800 rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-semibold text-white">Recent Orders</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Latest customer orders and their status
          </p>
        </div>
        <button className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
          View All
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">
                Order ID
              </th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">
                Customer
              </th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">
                Product
              </th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">
                Amount
              </th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">
                Status
              </th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 pr-4">
                Date
              </th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedOrders.map((order, index) => (
              <motion.tr
                key={order.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
              >
                <td className="py-3.5 pr-4">
                  <span className="text-sm font-medium text-white">
                    {order.id}
                  </span>
                </td>
                <td className="py-3.5 pr-4">
                  <div>
                    <p className="text-sm text-white">{order.customer}</p>
                    <p className="text-xs text-slate-500">{order.email}</p>
                  </div>
                </td>
                <td className="py-3.5 pr-4">
                  <span className="text-sm text-slate-300">{order.product}</span>
                </td>
                <td className="py-3.5 pr-4">
                  <span className="text-sm font-medium text-white">
                    ${order.amount.toFixed(2)}
                  </span>
                </td>
                <td className="py-3.5 pr-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      statusStyles[order.status]
                    }`}
                  >
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </td>
                <td className="py-3.5 pr-4">
                  <span className="text-sm text-slate-500">{order.date}</span>
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

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
        <p className="text-xs text-slate-500">
          Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, recentOrders.length)} of{" "}
          {recentOrders.length} orders
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                currentPage === page
                  ? "bg-emerald-500 text-white"
                  : "text-slate-500 hover:text-white hover:bg-slate-800"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
