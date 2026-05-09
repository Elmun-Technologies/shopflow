import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Truck, MapPin, Phone, CheckCircle2 } from "lucide-react";
import { api, ApiError, type AdminOrder } from "../lib/api";
import { useNotifications } from "../lib/notifications";

const shippingStatuses: Array<AdminOrder["status"]> = ["confirmed", "preparing", "shipping", "delivered"];

export default function LiveDeliveryPanel() {
  const { onShopEvent, toast } = useNotifications();
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const all = await api.orders.list({ limit: 100 });
      setOrders(all.filter((o) => shippingStatuses.includes(o.status)));
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return onShopEvent((ev) => {
      if (ev.type === "order.created" || ev.type === "order.updated") void load();
    });
  }, [onShopEvent]);

  async function nextStep(o: AdminOrder) {
    setUpdating(o.id);
    try {
      const idx = shippingStatuses.indexOf(o.status);
      const next = shippingStatuses[idx + 1] ?? "delivered";
      const updated = await api.orders.update(o.id, { status: next });
      setOrders((prev) => prev ? prev.map((x) => x.id === o.id ? updated : x).filter((x) => shippingStatuses.includes(x.status)) : prev);
      toast({ kind: "success", title: "Holat yangilandi", description: `${o.orderNumber} → ${next}` });
    } catch (err) {
      toast({ kind: "error", title: "Xato", description: err instanceof ApiError ? err.message : "" });
    } finally {
      setUpdating(null);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, AdminOrder[]>();
    for (const s of shippingStatuses) map.set(s, []);
    for (const o of orders ?? []) {
      map.get(o.status)?.push(o);
    }
    return map;
  }, [orders]);

  const totalShipping = (orders ?? []).length;
  const inDelivery = grouped.get("shipping")?.length ?? 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-white font-semibold">🚚 Yetkazib berish (Telegram bot orderlari)</h3>
            <p className="text-xs text-slate-500">{totalShipping} buyurtma jarayonda · {inDelivery} yo'lda</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !orders ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
      ) : totalShipping === 0 ? (
        <div className="p-12 text-center">
          <Truck className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">Hozircha yetkazib berishda buyurtma yo'q</p>
          <p className="text-slate-600 text-xs mt-1">Tasdiqlangan buyurtmalar shu yerda paydo bo'ladi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-6">
          {shippingStatuses.map((status) => {
            const list = grouped.get(status) ?? [];
            return (
              <div key={status} className="bg-slate-800/30 rounded-xl p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{statusLabel(status)}</p>
                  <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map((o) => (
                    <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs space-y-1.5">
                      <p className="font-mono font-medium text-white">{o.orderNumber}</p>
                      <p className="text-emerald-400 font-semibold">{o.total.toLocaleString()} so'm</p>
                      {o.customerPhone && (
                        <a href={`tel:${o.customerPhone}`} className="flex items-center gap-1 text-slate-400 hover:text-emerald-400">
                          <Phone className="w-3 h-3" /> {o.customerPhone}
                        </a>
                      )}
                      {o.deliveryAddress && (
                        <p className="flex items-start gap-1 text-slate-500 line-clamp-2">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{[o.deliveryAddress.street, o.deliveryAddress.house].filter(Boolean).join(", ")}</span>
                        </p>
                      )}
                      {status !== "delivered" && (
                        <button
                          onClick={() => nextStep(o)}
                          disabled={updating === o.id}
                          className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs py-1.5 rounded-lg flex items-center justify-center gap-1"
                        >
                          {updating === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Keyingi bosqichga
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function statusLabel(s: AdminOrder["status"]): string {
  return ({
    pending: "Kutilmoqda",
    confirmed: "Tasdiqlandi",
    preparing: "Tayyorlanmoqda",
    shipping: "Yetkazilmoqda",
    delivered: "Yetkazildi",
    cancelled: "Bekor qilindi",
  } as const)[s];
}
