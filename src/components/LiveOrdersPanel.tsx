import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw, Phone, MapPin, Package, Send, X, ClipboardList, Bell } from "lucide-react";
import { api, ApiError, type AdminOrder } from "../lib/api";
import { useNotifications } from "../lib/notifications";
import AssemblySheetDrawer from "./AssemblySheetDrawer";
import AutoresponderDrawer from "./AutoresponderDrawer";

const statusOptions: Array<{ value: AdminOrder["status"]; label: string; bg: string; text: string }> = [
  { value: "pending", label: "Kutilmoqda", bg: "bg-amber-500/15", text: "text-amber-400" },
  { value: "confirmed", label: "Tasdiqlandi", bg: "bg-blue-500/15", text: "text-blue-400" },
  { value: "preparing", label: "Tayyorlanmoqda", bg: "bg-blue-500/15", text: "text-blue-400" },
  { value: "shipping", label: "Yetkazilmoqda", bg: "bg-violet-500/15", text: "text-violet-400" },
  { value: "delivered", label: "Yetkazildi", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  { value: "cancelled", label: "Bekor qilindi", bg: "bg-red-500/15", text: "text-red-400" },
];

export default function LiveOrdersPanel() {
  const { onShopEvent, toast } = useNotifications();
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [assemblyOpen, setAssemblyOpen] = useState(false);
  const [autoresponderOpen, setAutoresponderOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.orders.list({ limit: 50 });
      setOrders(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xato");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const unsubscribe = onShopEvent((ev) => {
      if (ev.type === "order.created") {
        setOrders((prev) => prev ? [{
          id: ev.order.id,
          orderNumber: ev.order.orderNumber,
          status: "pending",
          paymentStatus: "unpaid",
          paymentMethod: null,
          source: "miniapp",
          subtotal: ev.order.total,
          deliveryFee: 0,
          total: ev.order.total,
          customerPhone: null,
          deliveryAddress: null,
          notes: null,
          tgUserId: null,
          createdAt: ev.order.createdAt,
          updatedAt: ev.order.createdAt,
        }, ...prev] : prev);
        // Detalili ma'lumotni keyinroq fetch qilamiz
        setTimeout(() => { void load(); }, 500);
      } else if (ev.type === "order.updated") {
        setOrders((prev) => prev ? prev.map((o) => o.id === ev.orderId ? { ...o, status: ev.status as AdminOrder["status"] } : o) : prev);
      }
    });
    return unsubscribe;
  }, [onShopEvent]);

  async function changeStatus(id: string, status: AdminOrder["status"]) {
    setUpdating(id);
    try {
      const updated = await api.orders.update(id, { status });
      setOrders((prev) => prev ? prev.map((o) => o.id === id ? updated : o) : prev);
      toast({ kind: "success", title: "Holat yangilandi", description: `Buyurtma — ${statusOptions.find((s) => s.value === status)?.label}` });
    } catch (err) {
      toast({ kind: "error", title: "Xato", description: err instanceof ApiError ? err.message : "Yangilab bo'lmadi" });
    } finally {
      setUpdating(null);
    }
  }

  const stats = useMemo(() => {
    if (!orders) return { total: 0, pending: 0, today: 0, revenue: 0 };
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      today: orders.filter((o) => new Date(o.createdAt).getTime() >= todayStart.getTime()).length,
      revenue: orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0),
    };
  }, [orders]);

  const activeOrder = orders?.find((o) => o.id === active) ?? null;

  if (loading && !orders) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex items-center justify-center text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yuklanmoqda…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-white font-semibold">🔴 Jonli buyurtmalar (Telegram bot)</h3>
            <p className="text-xs text-slate-500">Real-time backend bilan ulangan</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAutoresponderOpen(true)} className="hidden sm:inline-flex bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 text-xs font-medium px-3 py-2 rounded-lg items-center gap-1.5" title="Avtoresponder">
            <Bell className="w-4 h-4" /> Avtoresponder
          </button>
          <button onClick={() => setAssemblyOpen(true)} className="hidden sm:inline-flex bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 text-xs font-medium px-3 py-2 rounded-lg items-center gap-1.5" title="Yig'uv varaqasi">
            <ClipboardList className="w-4 h-4" /> Yig'uv varaqasi
          </button>
          <button onClick={load} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400" title="Yangilash">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-6">
        <Stat label="Jami" value={stats.total} />
        <Stat label="Kutilmoqda" value={stats.pending} accent="text-amber-400" />
        <Stat label="Bugun" value={stats.today} accent="text-blue-400" />
        <Stat label="Tushum" value={`${stats.revenue.toLocaleString()} so'm`} accent="text-emerald-400" />
      </div>

      <div className="border-t border-slate-800">
        {error && (
          <div className="p-6 text-sm text-amber-400 bg-amber-500/5">
            ⚠️ {error}. Backend ishga tushganligini tekshiring (server: <code>http://localhost:4000</code>).
          </div>
        )}
        {orders && orders.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">Hali Telegram orqali buyurtma yo'q</p>
            <p className="text-slate-600 text-xs mt-1">Mini App'dan birinchi buyurtma kelganda shu yerda paydo bo'ladi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="bg-slate-900/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">Raqam</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Vaqt</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Telefon</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Summa</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Holat</th>
                  <th className="py-3 px-6"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {orders?.slice(0, 10).map((o) => {
                    const st = statusOptions.find((s) => s.value === o.status);
                    return (
                      <motion.tr
                        key={o.id}
                        initial={{ opacity: 0, x: -10, backgroundColor: "rgba(16,185,129,0.15)" }}
                        animate={{ opacity: 1, x: 0, backgroundColor: "rgba(16,185,129,0)" }}
                        transition={{ duration: 1.2 }}
                        className="border-t border-slate-800 hover:bg-slate-800/40"
                      >
                        <td className="py-3 px-6 text-sm font-mono text-white">{o.orderNumber}</td>
                        <td className="py-3 px-3 text-xs text-slate-400">{new Date(o.createdAt).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" })}</td>
                        <td className="py-3 px-3 text-sm text-slate-300">{o.customerPhone ?? "—"}</td>
                        <td className="py-3 px-3 text-sm text-emerald-400 font-semibold text-right">{o.total.toLocaleString()} so'm</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${st?.bg ?? ""} ${st?.text ?? ""}`}>
                            {st?.label ?? o.status}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right">
                          <button onClick={() => setActive(o.id)} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
                            Ko'rish →
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeOrder && (
          <OrderDetailDrawer
            order={activeOrder}
            updating={updating === activeOrder.id}
            onClose={() => setActive(null)}
            onStatusChange={(s) => changeStatus(activeOrder.id, s)}
          />
        )}
      </AnimatePresence>

      <AssemblySheetDrawer open={assemblyOpen} onClose={() => setAssemblyOpen(false)} />
      <AutoresponderDrawer open={autoresponderOpen} onClose={() => setAutoresponderOpen(false)} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-800 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function OrderDetailDrawer({ order, updating, onClose, onStatusChange }: { order: AdminOrder; updating: boolean; onClose: () => void; onStatusChange: (s: AdminOrder["status"]) => void }) {
  const [items, setItems] = useState<Array<{ productName: string; quantity: number; price: number; total: number }> | null>(null);

  useEffect(() => {
    void api.orders.get(order.id).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [order.id]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-black/70 flex justify-end" onClick={onClose}>
      <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-900 border-l border-slate-800 overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase">Buyurtma</p>
            <p className="text-white font-mono font-semibold">{order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <p className="text-xs text-slate-500 uppercase mb-2">Holat</p>
            <div className="grid grid-cols-2 gap-2">
              {statusOptions.map((s) => (
                <button
                  key={s.value}
                  disabled={updating}
                  onClick={() => onStatusChange(s.value)}
                  className={`text-xs px-3 py-2 rounded-lg border ${order.status === s.value ? `${s.bg} ${s.text} border-current` : "border-slate-700 text-slate-400 hover:bg-slate-800"} disabled:opacity-50`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mijoz */}
          <div>
            <p className="text-xs text-slate-500 uppercase mb-2">Mijoz</p>
            <div className="space-y-2 text-sm">
              {order.customerPhone && (
                <div className="flex items-center gap-2 text-slate-300">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <a href={`tel:${order.customerPhone}`} className="hover:text-emerald-400">{order.customerPhone}</a>
                </div>
              )}
              {order.deliveryAddress && (
                <div className="flex items-start gap-2 text-slate-300">
                  <MapPin className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                  <span>{[order.deliveryAddress.city, order.deliveryAddress.street, order.deliveryAddress.house, order.deliveryAddress.apartment].filter(Boolean).join(", ")}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div>
            <p className="text-xs text-slate-500 uppercase mb-2">Mahsulotlar</p>
            {items === null ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500">Yuklab bo'lmadi</p>
            ) : (
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-300">{it.productName} × {it.quantity}</span>
                    <span className="text-slate-200">{it.total.toLocaleString()} so'm</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {order.notes && (
            <div>
              <p className="text-xs text-slate-500 uppercase mb-2">Izoh</p>
              <p className="text-sm text-slate-300">{order.notes}</p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-800">
            <div className="flex justify-between text-sm text-slate-400">
              <span>Mahsulotlar</span>
              <span>{order.subtotal.toLocaleString()} so'm</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-slate-400 mt-1">
                <span>Yetkazib berish</span>
                <span>{order.deliveryFee.toLocaleString()} so'm</span>
              </div>
            )}
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-800">
              <span className="font-semibold text-white">Jami</span>
              <span className="font-bold text-emerald-400">{order.total.toLocaleString()} so'm</span>
            </div>
          </div>

          <div className="flex gap-2">
            {order.customerPhone && (
              <a href={`tel:${order.customerPhone}`} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
                <Phone className="w-4 h-4" /> Qo'ng'iroq
              </a>
            )}
            {order.customerPhone && (
              <a href={`https://t.me/share/url?url=&text=Buyurtma ${order.orderNumber}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> Telegram
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
