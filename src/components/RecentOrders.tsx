import { motion } from "framer-motion";
import { Inbox, ArrowRight, Loader2 } from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { dashboardApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../utils/format";
import type { OrderStatus } from "../types/api";
import { useT } from "../i18n";

const statusStyles: Record<OrderStatus, string> = {
  COMPLETED: "bg-leaf-100 text-forest-700",
  PROCESSING: "bg-sky-100 text-sky-600",
  PENDING: "bg-amber-100 text-amber-500",
  CANCELLED: "bg-rose-100 text-rose-600",
  REFUNDED: "bg-slate-100 text-slate-500",
};

// Avatar uchun harf rangini ism asosida deterministik tanlash
const AVATAR_COLORS = [
  "bg-leaf-100 text-forest-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-600",
  "bg-pink-100 text-pink-700",
  "bg-cyan-500/15 text-cyan-700",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0] ?? "").filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "hozir";
  if (m < 60) return `${m}d oldin`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}s oldin`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}k oldin`;
  return new Date(iso).toLocaleDateString("uz-UZ", { month: "short", day: "numeric" });
}

export default function RecentOrders() {
  const { tenant } = useAuth();
  const { t } = useT();
  const currency = tenant?.currency ?? "UZS";
  const { data, loading } = useAsync(() => dashboardApi.recentOrders(), []);
  const orders = data ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="bg-white border border-cream-300/80 rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-cream-300/60">
        <div>
          <h3 className="text-base font-semibold text-forest-800">{t("widget.recentOrders")}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{t("widget.recentOrders.subtitle")}</p>
        </div>
        <button className="text-xs font-medium text-forest-700 hover:text-forest-700 flex items-center gap-1">
          {t("orders.viewDetails")}
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-10 h-10 text-slate-700 mb-2" />
          <p className="text-sm text-slate-500">{t("orders.empty.none")}</p>
          <p className="text-xs text-slate-400 mt-1">{t("orders.empty.hint")}</p>
        </div>
      ) : (
        <div className="divide-y divide-cream-300/40">
          {orders.map((order, index) => {
            const name = order.customer?.name ?? "—";
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-cream-100/30 transition-colors group"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(name)}`}>
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-forest-800 truncate">{name}</p>
                    <span className="text-[11px] text-slate-500 flex-shrink-0">#{order.code}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {order.channel?.name ?? "—"} · {relTime(order.createdAt)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-forest-800 whitespace-nowrap">
                    {formatCurrency(Number(order.total), order.currency || currency)}
                  </p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[order.status]}`}>
                    {t(`order.adminStatus.${order.status}`)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
