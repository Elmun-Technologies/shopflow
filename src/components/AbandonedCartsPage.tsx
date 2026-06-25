// Admin: abandoned cart'larni ko'rish + qo'lda eslatma yuborish.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart, Bell, Trash2, Loader2, Package as PackageIcon, CheckCircle2,
} from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";
import { useConfirm } from "./ui/ConfirmDialog";
import { useT } from "../i18n";

interface CartItem {
  productId: string;
  qty: number;
  name: string;
  price: number;
  imageUrl?: string | null;
}

interface AbandonedCart {
  id: string;
  telegramUserId: string;
  customerName: string | null;
  items: CartItem[];
  itemCount: number;
  total: number;
  currency: string;
  lastActiveAt: string;
  reminderSentAt: string | null;
  remindersSent: number;
  createdAt: string;
}

interface CartsResponse {
  carts: AbandonedCart[];
  summary: {
    total: number;
    atRisk: number;
    currency: string;
    remindedCount: number;
  };
}

const abandonedApi = {
  list: () => api<CartsResponse>("/abandoned-carts"),
  remind: (id: string) => api<{ ok: boolean }>(`/abandoned-carts/${id}/remind`, { method: "POST" }),
  remove: (id: string) => api<void>(`/abandoned-carts/${id}`, { method: "DELETE" }),
};

function formatPrice(n: number, currency: string): string {
  if (currency === "UZS") return `${n.toLocaleString("uz-UZ")} so'm`;
  return `${n.toLocaleString()} ${currency}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "hozir";
  if (mins < 60) return `${mins} daqiqa oldin`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.floor(hours / 24);
  return `${days} kun oldin`;
}

export default function AbandonedCartsPage() {
  const { t } = useT();
  const [data, setData] = useState<CartsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState<string | null>(null);
  const toast = useAppToast();
  const confirmDialog = useConfirm();

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await abandonedApi.list();
      setData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("abandonedCarts.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemind = async (cart: AbandonedCart) => {
    setReminding(cart.id);
    try {
      await abandonedApi.remind(cart.id);
      toast.success(`${t("abandonedCarts.reminderToast")}: ${cart.customerName ?? cart.telegramUserId}`);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("abandonedCarts.reminderError"));
    } finally {
      setReminding(null);
    }
  };

  const handleDelete = async (cart: AbandonedCart) => {
    const ok = await confirmDialog({
      title: t("abandonedCarts.deleteTitle"),
      description: t("abandonedCarts.deleteDescription", { name: cart.customerName ?? cart.telegramUserId }),
      kind: "danger",
      confirmText: t("common.delete"),
    });
    if (!ok) return;
    try {
      await abandonedApi.remove(cart.id);
      toast.success(t("abandonedCarts.deleted"));
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("abandonedCarts.deleteError"));
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-forest-800 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-amber-600" />
          {t("abandonedCarts.title")}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("abandonedCarts.subtitle")}
        </p>
      </motion.div>

      {/* Summary cards */}
      {!loading && data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <SummaryCard label={t("abandonedCarts.summary.total")} value={data.summary.total.toString()} />
          <SummaryCard
            label={t("abandonedCarts.summary.atRisk")}
            value={formatPrice(data.summary.atRisk, data.summary.currency)}
            accent="amber"
          />
          <SummaryCard
            label={t("abandonedCarts.summary.reminded")}
            value={`${data.summary.remindedCount} / ${data.summary.total}`}
            accent="leaf"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : !data || data.carts.length === 0 ? (
        <div className="bg-white border border-cream-300 rounded-xl py-20 px-6 text-center">
          <ShoppingCart className="w-12 h-12 text-cream-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-forest-800 mb-1">{t("abandonedCarts.empty.title")}</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {t("abandonedCarts.empty.description")}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-cream-300 rounded-xl overflow-hidden">
          <div className="divide-y divide-cream-300">
            {data.carts.map((cart) => (
              <div key={cart.id} className="p-4 hover:bg-cream-100/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-forest-800">
                        {cart.customerName ?? `Telegram: ${cart.telegramUserId}`}
                      </span>
                      <span className="text-[10px] text-slate-500">·</span>
                      <span className="text-[11px] text-slate-500">
                        {t("products.count", { count: cart.itemCount })}
                      </span>
                      <span className="text-[10px] text-slate-500">·</span>
                      <span className="text-sm font-semibold text-amber-600">
                        {formatPrice(cart.total, cart.currency)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-2">
                      {t("abandonedCarts.lastActive")}: {timeAgo(cart.lastActiveAt)}
                      {cart.reminderSentAt && (
                        <span className="ml-2 text-forest-700">
                          ✓ {t("abandonedCarts.reminderSent")} ({timeAgo(cart.reminderSentAt)})
                        </span>
                      )}
                    </div>
                    {/* Items preview */}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {cart.items.slice(0, 4).map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 bg-cream-100 rounded-md pr-2 max-w-[180px]"
                        >
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.name ?? ""} className="w-6 h-6 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded bg-cream-200 flex items-center justify-center flex-shrink-0">
                              <PackageIcon className="w-3 h-3 text-slate-500" />
                            </div>
                          )}
                          <span className="text-[11px] text-slate-700 truncate">
                            {item.name} ×{item.qty}
                          </span>
                        </div>
                      ))}
                      {cart.items.length > 4 && (
                        <span className="text-[11px] text-slate-500 self-center">
                          +{cart.items.length - 4}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleRemind(cart)}
                      disabled={reminding === cart.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-leaf-100 hover:bg-leaf-200 text-forest-700 rounded-lg font-medium disabled:opacity-50"
                      title={cart.reminderSentAt ? t("abandonedCarts.resendReminder") : t("abandonedCarts.sendReminder")}
                    >
                      {reminding === cart.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : cart.reminderSentAt ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                      {cart.reminderSentAt ? t("abandonedCarts.resend") : t("abandonedCarts.reminder")}
                    </button>
                    <button
                      onClick={() => handleDelete(cart)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-lg"
                      title={t("common.delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SummaryCard({
  label, value, accent,
}: {
  label: string; value: string; accent?: "amber" | "leaf";
}) {
  const accentCls =
    accent === "amber" ? "text-amber-600" : accent === "leaf" ? "text-forest-700" : "text-forest-800";
  return (
    <div className="bg-white border border-cream-300 rounded-xl p-4">
      <div className="text-[11px] text-slate-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${accentCls}`}>{value}</div>
    </div>
  );
}
