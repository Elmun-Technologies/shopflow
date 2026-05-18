import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Package,
  Truck,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Send,
} from "lucide-react";
import type { Order } from "../data/ordersData";

interface Props {
  order: Order | null;
  onClose: () => void;
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  completed: { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2, label: "Completed" },
  processing: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Clock, label: "Processing" },
  pending: { color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertCircle, label: "Pending" },
  cancelled: { color: "text-red-400", bg: "bg-red-500/10", icon: XCircle, label: "Cancelled" },
  shipped: { color: "text-violet-400", bg: "bg-violet-500/10", icon: Send, label: "Shipped" },
};

const paymentConfig: Record<string, { color: string; label: string }> = {
  paid: { color: "text-emerald-400", label: "Paid" },
  pending: { color: "text-amber-400", label: "Pending" },
  failed: { color: "text-red-400", label: "Failed" },
  refunded: { color: "text-slate-400", label: "Refunded" },
};

export default function OrderDetailModal({ order, onClose }: Props) {
  if (!order) return null;

  const status = statusConfig[order.status];
  const payment = paymentConfig[order.payment];
  const StatusIcon = status.icon;

  const timeline = [
    { title: "Order Placed", date: order.date, time: "09:23 AM", completed: true },
    { title: "Payment Confirmed", date: order.date, time: "09:25 AM", completed: order.payment === "paid" },
    { title: "Order Processing", date: order.date, time: "10:00 AM", completed: order.status !== "pending" },
    { title: "Shipped", date: order.status === "shipped" || order.status === "completed" ? order.date : "—", time: "02:30 PM", completed: order.status === "shipped" || order.status === "completed" },
    { title: "Delivered", date: order.status === "completed" ? order.date : "—", time: "04:15 PM", completed: order.status === "completed" },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white">{order.id}</h2>
              <p className="text-sm text-slate-500 mt-0.5">Order Details</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Status & Payment */}
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${status.bg} ${status.color} border-current/20`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {status.label}
              </span>
              <span className={`text-xs font-medium ${payment.color}`}>
                Payment: {payment.label}
              </span>
            </div>

            {/* Customer Info */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Customer Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-sm font-bold">
                    {order.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{order.customer}</p>
                    <p className="text-xs text-slate-500">{order.email}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{order.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{order.email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-400" />
                Shipping Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2 text-sm text-slate-400">
                  <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span>{order.address}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Package className="w-3.5 h-3.5" />
                    <span>Method: {order.shipping}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Date: {order.date}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-400" />
                Order Items
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                      <Package className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{order.product}</p>
                      <p className="text-xs text-slate-500">Qty: {order.items}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-white">
                    ${order.amount.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-slate-400">Shipping</span>
                  <span className="text-sm text-slate-400">
                    {order.shipping === "Express" ? "$12.99" : "$5.99"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-slate-400">Tax</span>
                  <span className="text-sm text-slate-400">
                    ${(order.amount * 0.08).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-base font-bold text-emerald-400">
                    ${(order.amount + (order.shipping === "Express" ? 12.99 : 5.99) + order.amount * 0.08).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Order Timeline
              </h3>
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-700" />
                <div className="space-y-4">
                  {timeline.map((step) => (
                    <div key={step.title} className="flex items-start gap-3 relative">
                      <div
                        className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 z-10 ${
                          step.completed
                            ? "bg-emerald-500 border-emerald-500"
                            : "bg-slate-800 border-slate-600"
                        }`}
                      />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${step.completed ? "text-white" : "text-slate-500"}`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {step.date !== "—" ? `${step.date} at ${step.time}` : "Pending"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" />
                Payment Information
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Payment Method</p>
                  <p className="text-sm text-white mt-0.5">Credit Card (****4242)</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Transaction ID</p>
                  <p className="text-sm text-white mt-0.5">TXN-{order.id.replace("#ORD-", "")}892</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              {order.status === "pending" && (
                <button className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors">
                  Confirm Order
                </button>
              )}
              {order.status === "processing" && (
                <button className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors">
                  Mark as Shipped
                </button>
              )}
              {order.status === "shipped" && (
                <button className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors">
                  Mark as Delivered
                </button>
              )}
              <button className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-medium rounded-lg transition-colors">
                Print Invoice
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
