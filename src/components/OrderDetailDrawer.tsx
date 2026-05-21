// Buyurtma to'liq ma'lumotlari — admin OrdersPage'dan ochiladi.
// Mijoz, mahsulotlar, status timeline, narx tafsiloti, status o'zgartirish.

import { useEffect, useState } from "react";
import {
  X, Phone, Mail, MapPin, Package as PackageIcon, ChevronDown, Loader2,
  AlertCircle, User as UserIcon, Calendar, MessageSquare,
} from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";
import type { OrderStatus } from "../types/api";

interface OrderDetailResponse {
  id: string;
  code: string;
  status: OrderStatus;
  total: string | number;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    location: string | null;
  } | null;
  channel: {
    id: string;
    type: string;
    name: string;
  } | null;
  items: Array<{
    id: string;
    qty: number;
    price: string | number;
    product: {
      id: string;
      name: string;
      sku: string;
      imageUrl: string | null;
    };
  }>;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Yangi", color: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/30" },
  PROCESSING: { label: "Tayyorlanmoqda", color: "text-blue-300", bg: "bg-blue-500/15 border-blue-500/30" },
  COMPLETED: { label: "Yetkazildi", color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30" },
  CANCELLED: { label: "Bekor qilindi", color: "text-rose-300", bg: "bg-rose-500/15 border-rose-500/30" },
  REFUNDED: { label: "Qaytarildi", color: "text-slate-300", bg: "bg-slate-700 border-slate-600" },
};

function formatMoney(n: string | number, currency: string): string {
  const v = Number(n);
  if (currency === "UZS") return `${v.toLocaleString("uz-UZ")} so'm`;
  return `${v.toLocaleString()} ${currency}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" });
}

export interface OrderDetailDrawerProps {
  orderId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

export default function OrderDetailDrawer({ orderId, onClose, onChanged }: OrderDetailDrawerProps) {
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const toast = useAppToast();

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    setOrder(null);
    api<OrderDetailResponse>(`/orders/${orderId}`)
      .then((res) => {
        setOrder(res);
        setNotesDraft(res.notes ?? "");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId]);

  // Escape closes the drawer
  useEffect(() => {
    if (!orderId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orderId, onClose]);

  if (!orderId) return null;

  const handleStatusChange = async (status: OrderStatus) => {
    if (!order) return;
    setShowStatusMenu(false);
    setUpdating(true);
    try {
      const updated = await api<OrderDetailResponse>(`/orders/${order.id}`, {
        method: "PATCH",
        body: { status },
      });
      setOrder({ ...order, status: updated.status });
      toast.success(`Status: ${STATUS_CONFIG[status].label}`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status yangilanmadi");
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!order) return;
    setSavingNotes(true);
    try {
      await api(`/orders/${order.id}`, { method: "PATCH", body: { notes: notesDraft } });
      toast.success("Izoh saqlandi");
      setOrder({ ...order, notes: notesDraft });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlanmadi");
    } finally {
      setSavingNotes(false);
    }
  };

  const subtotal = order?.items.reduce((s, i) => s + Number(i.price) * i.qty, 0) ?? 0;
  const itemCount = order?.items.reduce((s, i) => s + i.qty, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" role="dialog" aria-modal="true">
      <button
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Yopish"
      />
      <div className="relative w-full sm:max-w-md bg-slate-900 border-l border-slate-800 h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
            <AlertCircle className="w-10 h-10 text-rose-400" />
            <p className="text-sm text-rose-300">{error}</p>
            <button onClick={onClose} className="px-3 py-1.5 text-xs bg-slate-800 rounded-lg text-slate-300">
              Yopish
            </button>
          </div>
        ) : order ? (
          <>
            {/* Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-3 flex items-center justify-between z-10">
              <div>
                <div className="text-[11px] text-slate-500">Buyurtma</div>
                <h2 className="text-lg font-bold text-white">#{order.code}</h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-5">
              {/* Status dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  disabled={updating}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${STATUS_CONFIG[order.status].bg} ${STATUS_CONFIG[order.status].color} hover:brightness-110 transition-all`}
                >
                  <span className="text-sm font-semibold">
                    {updating && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                    Holat: {STATUS_CONFIG[order.status].label}
                  </span>
                  <ChevronDown className="w-4 h-4 opacity-70" />
                </button>
                {showStatusMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowStatusMenu(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 overflow-hidden">
                      {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map((s) => {
                        const c = STATUS_CONFIG[s];
                        const isCurrent = s === order.status;
                        return (
                          <button
                            key={s}
                            onClick={() => !isCurrent && handleStatusChange(s)}
                            disabled={isCurrent}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-700 transition-colors ${
                              isCurrent ? "opacity-60 cursor-default" : ""
                            }`}
                          >
                            <span className={c.color}>{c.label}</span>
                            {isCurrent && <span className="text-emerald-400 text-xs">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Customer */}
              <Section title="Mijoz" icon={UserIcon}>
                {order.customer ? (
                  <div className="space-y-1.5 text-sm">
                    <div className="text-white font-medium">{order.customer.name}</div>
                    {order.customer.phone && (
                      <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-slate-300 hover:text-emerald-300">
                        <Phone className="w-3.5 h-3.5" />
                        {order.customer.phone}
                      </a>
                    )}
                    {order.customer.email && (
                      <a href={`mailto:${order.customer.email}`} className="flex items-center gap-2 text-slate-300 hover:text-emerald-300">
                        <Mail className="w-3.5 h-3.5" />
                        {order.customer.email}
                      </a>
                    )}
                    {order.customer.location && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <MapPin className="w-3.5 h-3.5" />
                        {order.customer.location}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Mijoz ma'lumoti yo'q</p>
                )}
              </Section>

              {/* Items */}
              <Section title={`Mahsulotlar (${itemCount})`} icon={PackageIcon}>
                <div className="divide-y divide-slate-800">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      {item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <PackageIcon className="w-5 h-5 text-slate-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{item.product.name}</div>
                        <div className="text-[11px] text-slate-500">{item.product.sku}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-white">
                          {formatMoney(Number(item.price) * item.qty, order.currency)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.qty} × {formatMoney(item.price, order.currency)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Totals */}
              <Section title="Hisob" icon={Calendar}>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>Mahsulotlar yig'indisi</span>
                    <span>{formatMoney(subtotal, order.currency)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-slate-800 mt-2">
                    <span>Jami</span>
                    <span>{formatMoney(order.total, order.currency)}</span>
                  </div>
                </div>
              </Section>

              {/* Channel & dates */}
              <Section title="Manba" icon={Calendar}>
                <div className="space-y-1 text-sm">
                  {order.channel && (
                    <div className="flex justify-between text-slate-400">
                      <span>Kanal</span>
                      <span className="text-slate-200">{order.channel.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400">
                    <span>Yaratilgan</span>
                    <span className="text-slate-200">{formatDateTime(order.createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Yangilangan</span>
                    <span className="text-slate-200">{formatDateTime(order.updatedAt)}</span>
                  </div>
                </div>
              </Section>

              {/* Notes editor */}
              <Section title="Izoh" icon={MessageSquare}>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={3}
                  placeholder="Buyurtma haqida ichki izoh..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                />
                {notesDraft !== (order.notes ?? "") && (
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="mt-2 px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-1.5"
                  >
                    {savingNotes && <Loader2 className="w-3 h-3 animate-spin" />}
                    Saqlash
                  </button>
                )}
              </Section>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title, icon: Icon, children,
}: {
  title: string; icon: typeof PackageIcon; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3">
        {children}
      </div>
    </div>
  );
}
