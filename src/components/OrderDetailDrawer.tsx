// Buyurtma to'liq ma'lumotlari — admin OrdersPage'dan ochiladi.
// Mijoz, mahsulotlar, status timeline, narx tafsiloti, status o'zgartirish.

import { useEffect, useState } from "react";
import {
  X, Phone, Mail, MapPin, Package as PackageIcon, ChevronDown, Loader2,
  AlertCircle, User as UserIcon, Calendar, MessageSquare, Check, Send,
  Clock, Trash2, Printer,
} from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";
import type { OrderStatus } from "../types/api";
import { useT } from "../i18n";
import { openOrderPrint } from "../utils/printOrder";
import { useAuth } from "../contexts/AuthContext";

interface TeamMember { id: string; name: string; role: string; active: boolean }
interface OrderNote { id: string; content: string; authorId: string | null; authorName: string | null; createdAt: string }
interface AuditEntry { id: string; action: string; summary: string | null; actorName: string | null; createdAt: string }

interface OrderDetailResponse {
  id: string;
  code: string;
  status: OrderStatus;
  total: string | number;
  currency: string;
  notes: string | null;
  assigneeId: string | null;
  shippingAddress: string | null;
  shippingLat: string | number | null;
  shippingLng: string | number | null;
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

// Faqat ranglar — labellar t() orqali
const STATUS_STYLE: Record<OrderStatus, { color: string; bg: string }> = {
  PENDING: { color: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/30" },
  PROCESSING: { color: "text-blue-300", bg: "bg-blue-500/15 border-blue-500/30" },
  COMPLETED: { color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30" },
  CANCELLED: { color: "text-rose-300", bg: "bg-rose-500/15 border-rose-500/30" },
  REFUNDED: { color: "text-slate-300", bg: "bg-slate-700 border-slate-600" },
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
  const { t } = useT();
  const { tenant } = useAuth();
  const [order, setOrder] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [updatingAssignee, setUpdatingAssignee] = useState(false);
  const [orderNotes, setOrderNotes] = useState<OrderNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const toast = useAppToast();

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    setOrder(null);
    setOrderNotes([]);
    setAuditLog([]);
    api<OrderDetailResponse>(`/orders/${orderId}`)
      .then((res) => {
        setOrder(res);
        setNotesDraft(res.notes ?? "");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
    // Tarix, notes va jamoa parallel yuklanadi
    api<{ items: AuditEntry[] }>(`/audit?resourceType=order&resourceId=${orderId}`)
      .then((r) => setAuditLog(r.items))
      .catch(() => null);
    api<{ notes: OrderNote[] }>(`/orders/${orderId}/notes`)
      .then((r) => setOrderNotes(r.notes))
      .catch(() => null);
    if (team.length === 0) {
      api<TeamMember[]>("/tenant/users")
        .then((users) => setTeam(users.filter((u) => u.active)))
        .catch(() => null);
    }
  }, [orderId, team.length]);

  const refreshTimeline = async () => {
    if (!orderId) return;
    try {
      const r = await api<{ items: AuditEntry[] }>(`/audit?resourceType=order&resourceId=${orderId}`);
      setAuditLog(r.items);
    } catch { /* ignore */ }
  };

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
      toast.success(`${t(`order.adminStatus.${status}`)} · 📨 ${t("orders.notified")}`);
      onChanged();
      await refreshTimeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status yangilanmadi");
    } finally {
      setUpdating(false);
    }
  };

  const handleAssign = async (assigneeId: string | null) => {
    if (!order) return;
    setShowAssigneeMenu(false);
    setUpdatingAssignee(true);
    try {
      const updated = await api<OrderDetailResponse>(`/orders/${order.id}`, {
        method: "PATCH",
        body: { assigneeId },
      });
      setOrder({ ...order, assigneeId: updated.assigneeId });
      const name = assigneeId ? team.find((t) => t.id === assigneeId)?.name : null;
      toast.success(assigneeId ? `Mas'ul: ${name}` : "Mas'ul olib tashlandi");
      onChanged();
      await refreshTimeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mas'ul tayinlanmadi");
    } finally {
      setUpdatingAssignee(false);
    }
  };

  const handleAddNote = async () => {
    if (!order || !newNote.trim()) return;
    setAddingNote(true);
    try {
      const { note } = await api<{ note: OrderNote }>(`/orders/${order.id}/notes`, {
        method: "POST",
        body: { content: newNote.trim() },
      });
      setOrderNotes((prev) => [note, ...prev]);
      setNewNote("");
      toast.success("Izoh qo'shildi");
      await refreshTimeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Izoh saqlanmadi");
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!order) return;
    if (!confirm("Izohni o'chirish?")) return;
    try {
      await api(`/orders/${order.id}/notes/${noteId}`, { method: "DELETE" });
      setOrderNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O'chirilmadi");
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

  const handlePrint = () => {
    if (!order) return;
    openOrderPrint({
      code: order.code,
      status: t(`order.adminStatus.${order.status}`),
      createdAt: order.createdAt,
      currency: order.currency,
      total: Number(order.total),
      notes: order.notes,
      customer: order.customer
        ? { name: order.customer.name, phone: order.customer.phone, email: order.customer.email }
        : null,
      shippingAddress: order.shippingAddress,
      items: order.items.map((it) => ({
        name: it.product.name,
        sku: it.product.sku,
        qty: it.qty,
        price: Number(it.price),
      })),
      tenant: tenant ? { name: tenant.name, phone: null, address: null } : null,
      labels: {
        title: t("invoice.title"),
        code: t("invoice.code"),
        date: t("invoice.date"),
        status: t("invoice.status"),
        customer: t("invoice.customer"),
        address: t("invoice.address"),
        sku: t("invoice.sku"),
        item: t("invoice.item"),
        qty: t("invoice.qty"),
        price: t("invoice.price"),
        sum: t("invoice.sum"),
        total: t("invoice.total"),
        notes: t("invoice.notes"),
        footer: t("invoice.footer"),
      },
    });
  };

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
                <div className="text-[11px] text-slate-500">{t("invoice.code")}</div>
                <h2 className="text-lg font-bold text-white">#{order.code}</h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrint}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title={t("orderDetail.print")}
                  aria-label={t("orderDetail.print")}
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-5 space-y-5">
              {/* Quick action panel — joriy status'ga ko'ra eng mantiqiy keyingi qadam */}
              {(order.status === "PENDING" || order.status === "PROCESSING") && (
                <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Send className="w-3.5 h-3.5" />
                    Keyingi qadam — bossangiz mijozga avtomatik Telegram xabar yuboriladi
                  </div>
                  <div className="flex gap-2">
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => handleStatusChange("PROCESSING")}
                        disabled={updating}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors"
                      >
                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Qabul qilish
                      </button>
                    )}
                    {order.status === "PROCESSING" && (
                      <button
                        onClick={() => handleStatusChange("COMPLETED")}
                        disabled={updating}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors"
                      >
                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Yetkazildi
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChange("CANCELLED")}
                      disabled={updating}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-700 hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-50 rounded-lg text-sm font-medium text-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Bekor
                    </button>
                  </div>
                </div>
              )}

              {/* Status dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  disabled={updating}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${STATUS_STYLE[order.status].bg} ${STATUS_STYLE[order.status].color} hover:brightness-110 transition-all`}
                >
                  <span className="text-sm font-semibold">
                    {updating && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                    {t("orders.col.status")}: {t(`order.adminStatus.${order.status}`)}
                  </span>
                  <ChevronDown className="w-4 h-4 opacity-70" />
                </button>
                {showStatusMenu && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setShowStatusMenu(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 overflow-hidden">
                      {(Object.keys(STATUS_STYLE) as OrderStatus[]).map((s) => {
                        const c = STATUS_STYLE[s];
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
                            <span className={c.color}>{t(`order.adminStatus.${s}`)}</span>
                            {isCurrent && <span className="text-emerald-400 text-xs">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Customer */}
              <Section title={t("orderDetail.customer")} icon={UserIcon}>
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
                  <p className="text-xs text-slate-500">{t("orderDetail.noCustomer")}</p>
                )}
              </Section>

              {/* Items */}
              <Section title={t("orderDetail.products", { n: itemCount })} icon={PackageIcon}>
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
              <Section title={t("orderDetail.summary")} icon={Calendar}>
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
              <Section title={t("orderDetail.source")} icon={Calendar}>
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

              {/* Yetkazib berish manzili (GPS koordinatalari mavjud bo'lsa) */}
              {(order.shippingAddress || order.shippingLat) && (
                <Section title={t("orderDetail.address")} icon={MapPin}>
                  {order.shippingAddress && (
                    <p className="text-sm text-white mb-1.5">{order.shippingAddress}</p>
                  )}
                  {order.shippingLat != null && order.shippingLng != null && (() => {
                    const lat = Number(order.shippingLat);
                    const lng = Number(order.shippingLng);
                    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                    const yandexUrl = `https://yandex.com/maps/?pt=${lng},${lat}&z=16&l=map`;
                    return (
                      <div className="space-y-2">
                        <p className="text-[11px] text-slate-500 font-mono">
                          📍 {lat.toFixed(6)}, {lng.toFixed(6)}
                        </p>
                        <div className="flex gap-2">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 px-2.5 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-md text-xs text-sky-300 text-center transition-colors"
                          >
                            Google Maps
                          </a>
                          <a
                            href={yandexUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md text-xs text-amber-300 text-center transition-colors"
                          >
                            Yandex Maps
                          </a>
                        </div>
                      </div>
                    );
                  })()}
                </Section>
              )}

              {/* Mas'ul (assignee) */}
              <Section title={t("orderDetail.assignee")} icon={UserIcon}>
                <div className="relative">
                  <button
                    onClick={() => setShowAssigneeMenu(!showAssigneeMenu)}
                    disabled={updatingAssignee}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2">
                      {updatingAssignee && <Loader2 className="w-4 h-4 animate-spin" />}
                      {order.assigneeId
                        ? team.find((t) => t.id === order.assigneeId)?.name ?? "?"
                        : <span className="text-slate-500">— tayinlanmagan —</span>}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </button>
                  {showAssigneeMenu && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setShowAssigneeMenu(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 max-h-60 overflow-y-auto">
                        <button
                          onClick={() => handleAssign(null)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-400 hover:bg-slate-700"
                        >
                          — tayinlamaslik —
                        </button>
                        {team.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleAssign(u.id)}
                            className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-700"
                          >
                            <span className="text-white">{u.name}</span>
                            <span className="text-[10px] text-slate-500">{u.role}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Section>

              {/* Ichki izohlar / kommentariya thread */}
              <Section title={t("orderDetail.notes", { n: orderNotes.length })} icon={MessageSquare}>
                <div className="space-y-2 mb-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                    placeholder="Jamoa uchun izoh yozing (mijoz ko'rmaydi)..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                  />
                  {newNote.trim() && (
                    <button
                      onClick={handleAddNote}
                      disabled={addingNote}
                      className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-1.5"
                    >
                      {addingNote && <Loader2 className="w-3 h-3 animate-spin" />}
                      Qo'shish
                    </button>
                  )}
                </div>
                {orderNotes.length > 0 && (
                  <div className="divide-y divide-slate-800/60">
                    {orderNotes.map((n) => (
                      <div key={n.id} className="py-2 group flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white whitespace-pre-wrap">{n.content}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {n.authorName ?? "—"} · {formatDateTime(n.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteNote(n.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Tarix / audit timeline */}
              <Section title={t("orderDetail.history")} icon={Clock}>
                {auditLog.length === 0 ? (
                  <p className="text-xs text-slate-500">Hozircha yozuv yo'q</p>
                ) : (
                  <div className="space-y-2">
                    {auditLog.map((a) => (
                      <div key={a.id} className="flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200">{a.summary ?? a.action}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {a.actorName ?? "Tizim"} · {formatDateTime(a.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Eski erkin notes maydoni (mijoz uchun chiqishi mumkin bo'lgan) */}
              <Section title={t("orderDetail.customerNote")} icon={MessageSquare}>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={2}
                  placeholder={t("orderDetail.customerNotePlaceholder")}
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
