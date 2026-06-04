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
interface AuditEntry {
  id: string;
  action: string;
  summary: string | null;
  actorName: string | null;
  createdAt: string;
  changes?: Record<string, unknown> | null;
}

// Timeline'da bosqichlar — CANCELLED/REFUNDED branch sifatida alohida render
const TIMELINE_FLOW: OrderStatus[] = ["PENDING", "PROCESSING", "COMPLETED"];

interface TimelineStep {
  status: OrderStatus;
  reachedAt: string | null;
  actorName: string | null;
}

// Audit log'dan har bir status uchun "qachon yetdi va kim tomonidan" ni topish
function buildTimeline(
  currentStatus: OrderStatus,
  createdAt: string,
  audit: AuditEntry[],
): { main: TimelineStep[]; terminal: TimelineStep | null } {
  // PENDING — har doim createdAt
  const reached: Partial<Record<OrderStatus, { at: string; actor: string | null }>> = {
    PENDING: { at: createdAt, actor: null },
  };

  // Audit changes.to dan status o'zgarishini olamiz, eng birinchi marta yetilgan vaqtni
  // saqlaymiz (audit DESC tartibda, shuning uchun teskari yuramiz)
  const ascending = [...audit].reverse();
  for (const a of ascending) {
    const to = (a.changes as { to?: string } | undefined)?.to;
    if (typeof to === "string" && (to in STATUS_STYLE) && !reached[to as OrderStatus]) {
      reached[to as OrderStatus] = { at: a.createdAt, actor: a.actorName };
    }
  }

  // Hozirgi status ham yetilgan deb belgilanadi (audit yo'q bo'lsa ham)
  if (!reached[currentStatus]) {
    reached[currentStatus] = { at: createdAt, actor: null };
  }

  const main: TimelineStep[] = TIMELINE_FLOW.map((s) => ({
    status: s,
    reachedAt: reached[s]?.at ?? null,
    actorName: reached[s]?.actor ?? null,
  }));

  const terminal: TimelineStep | null =
    currentStatus === "CANCELLED" || currentStatus === "REFUNDED"
      ? {
          status: currentStatus,
          reachedAt: reached[currentStatus]?.at ?? null,
          actorName: reached[currentStatus]?.actor ?? null,
        }
      : null;

  return { main, terminal };
}

interface OrderDetailResponse {
  id: string;
  code: string;
  status: OrderStatus;
  total: string | number;
  currency: string;
  notes: string | null;
  paid?: boolean;
  paidAt?: string | null;
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
  PENDING: { color: "text-amber-600", bg: "bg-amber-100 border-amber-300" },
  PROCESSING: { color: "text-sky-700", bg: "bg-sky-100 border-sky-300" },
  COMPLETED: { color: "text-forest-700", bg: "bg-leaf-100 border-leaf-400/50" },
  CANCELLED: { color: "text-rose-600", bg: "bg-rose-100 border-rose-300" },
  REFUNDED: { color: "text-slate-700", bg: "bg-cream-200 border-slate-600" },
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
      <div className="relative w-full sm:max-w-md bg-white border-l border-cream-300 h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
            <AlertCircle className="w-10 h-10 text-rose-600" />
            <p className="text-sm text-rose-600">{error}</p>
            <button onClick={onClose} className="px-3 py-1.5 text-xs bg-cream-100 rounded-lg text-slate-700">
              Yopish
            </button>
          </div>
        ) : order ? (
          <>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-cream-300 px-5 py-3 flex items-center justify-between z-10">
              <div>
                <div className="text-[11px] text-slate-500">{t("invoice.code")}</div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-forest-800">#{order.code}</h2>
                  {order.paid && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-leaf-100 text-forest-700">
                      <Check className="w-3 h-3" /> To'langan
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrint}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100 transition-colors"
                  title={t("orderDetail.print")}
                  aria-label={t("orderDetail.print")}
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-5 space-y-5">
              {/* Quick action panel — joriy status'ga ko'ra eng mantiqiy keyingi qadam */}
              {(order.status === "PENDING" || order.status === "PROCESSING") && (
                <div className="bg-cream-100/40 border border-cream-300 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Send className="w-3.5 h-3.5" />
                    Keyingi qadam — bossangiz mijozga avtomatik Telegram xabar yuboriladi
                  </div>
                  <div className="flex gap-2">
                    {order.status === "PENDING" && (
                      <button
                        onClick={() => handleStatusChange("PROCESSING")}
                        disabled={updating}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-sm font-semibold text-forest-800 transition-colors"
                      >
                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Qabul qilish
                      </button>
                    )}
                    {order.status === "PROCESSING" && (
                      <button
                        onClick={() => handleStatusChange("COMPLETED")}
                        disabled={updating}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-sm font-semibold text-forest-800 transition-colors"
                      >
                        {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Yetkazildi
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChange("CANCELLED")}
                      disabled={updating}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-cream-200 hover:bg-rose-200 hover:text-rose-600 disabled:opacity-50 rounded-lg text-sm font-medium text-slate-700 transition-colors"
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
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-cream-100 border border-cream-300 rounded-xl shadow-xl py-1 overflow-hidden">
                      {(Object.keys(STATUS_STYLE) as OrderStatus[]).map((s) => {
                        const c = STATUS_STYLE[s];
                        const isCurrent = s === order.status;
                        return (
                          <button
                            key={s}
                            onClick={() => !isCurrent && handleStatusChange(s)}
                            disabled={isCurrent}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-cream-200 transition-colors ${
                              isCurrent ? "opacity-60 cursor-default" : ""
                            }`}
                          >
                            <span className={c.color}>{t(`order.adminStatus.${s}`)}</span>
                            {isCurrent && <span className="text-forest-700 text-xs">✓</span>}
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
                    <div className="text-forest-800 font-medium">{order.customer.name}</div>
                    {order.customer.phone && (
                      <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-slate-700 hover:text-forest-700">
                        <Phone className="w-3.5 h-3.5" />
                        {order.customer.phone}
                      </a>
                    )}
                    {order.customer.email && (
                      <a href={`mailto:${order.customer.email}`} className="flex items-center gap-2 text-slate-700 hover:text-forest-700">
                        <Mail className="w-3.5 h-3.5" />
                        {order.customer.email}
                      </a>
                    )}
                    {order.customer.location && (
                      <div className="flex items-center gap-2 text-slate-500">
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
                <div className="divide-y divide-cream-300">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      {item.product.imageUrl ? (
                        <img src={item.product.imageUrl} alt={item.product.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-cream-100 flex items-center justify-center flex-shrink-0">
                          <PackageIcon className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-forest-800 truncate">{item.product.name}</div>
                        <div className="text-[11px] text-slate-500">{item.product.sku}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold text-forest-800">
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
                  <div className="flex justify-between text-slate-500">
                    <span>Mahsulotlar yig'indisi</span>
                    <span>{formatMoney(subtotal, order.currency)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-forest-800 pt-2 border-t border-cream-300 mt-2">
                    <span>Jami</span>
                    <span>{formatMoney(order.total, order.currency)}</span>
                  </div>
                </div>
              </Section>

              {/* Channel & dates */}
              <Section title={t("orderDetail.source")} icon={Calendar}>
                <div className="space-y-1 text-sm">
                  {order.channel && (
                    <div className="flex justify-between text-slate-500">
                      <span>Kanal</span>
                      <span className="text-forest-700">{order.channel.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500">
                    <span>Yaratilgan</span>
                    <span className="text-forest-700">{formatDateTime(order.createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Yangilangan</span>
                    <span className="text-forest-700">{formatDateTime(order.updatedAt)}</span>
                  </div>
                </div>
              </Section>

              {/* Yetkazib berish manzili (GPS koordinatalari mavjud bo'lsa) */}
              {(order.shippingAddress || order.shippingLat) && (
                <Section title={t("orderDetail.address")} icon={MapPin}>
                  {order.shippingAddress && (
                    <p className="text-sm text-forest-800 mb-1.5">{order.shippingAddress}</p>
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
                            className="flex-1 px-2.5 py-1.5 bg-sky-100 hover:bg-sky-200 border border-sky-500/30 rounded-md text-xs text-sky-700 text-center transition-colors"
                          >
                            Google Maps
                          </a>
                          <a
                            href={yandexUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md text-xs text-amber-600 text-center transition-colors"
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
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-cream-100 hover:bg-cream-200 rounded-lg text-sm text-forest-800 transition-colors disabled:opacity-50"
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
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-cream-100 border border-cream-300 rounded-xl shadow-xl py-1 max-h-60 overflow-y-auto">
                        <button
                          onClick={() => handleAssign(null)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-cream-200"
                        >
                          — tayinlamaslik —
                        </button>
                        {team.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleAssign(u.id)}
                            className="w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-cream-200"
                          >
                            <span className="text-forest-800">{u.name}</span>
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
                    className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 resize-none"
                  />
                  {newNote.trim() && (
                    <button
                      onClick={handleAddNote}
                      disabled={addingNote}
                      className="px-3 py-1.5 text-xs bg-leaf-400 hover:bg-leaf-500 text-forest-800 rounded-lg font-medium flex items-center gap-1.5"
                    >
                      {addingNote && <Loader2 className="w-3 h-3 animate-spin" />}
                      Qo'shish
                    </button>
                  )}
                </div>
                {orderNotes.length > 0 && (
                  <div className="divide-y divide-cream-300/60">
                    {orderNotes.map((n) => (
                      <div key={n.id} className="py-2 group flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-forest-800 whitespace-pre-wrap">{n.content}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {n.authorName ?? "—"} · {formatDateTime(n.createdAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteNote(n.id)}
                          className="p-1 text-slate-500 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
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
              <Section title={t("orderDetail.timeline")} icon={Clock}>
                <OrderStatusTimeline
                  currentStatus={order.status}
                  createdAt={order.createdAt}
                  audit={auditLog}
                  t={t}
                />
              </Section>

              <Section title={t("orderDetail.history")} icon={Clock}>
                {auditLog.length === 0 ? (
                  <p className="text-xs text-slate-500">Hozircha yozuv yo'q</p>
                ) : (
                  <div className="space-y-2">
                    {auditLog.map((a) => (
                      <div key={a.id} className="flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-forest-700">{a.summary ?? a.action}</p>
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
                  className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 resize-none"
                />
                {notesDraft !== (order.notes ?? "") && (
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="mt-2 px-3 py-1.5 text-xs bg-leaf-400 hover:bg-leaf-500 text-forest-800 rounded-lg font-medium flex items-center gap-1.5"
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
      <div className="bg-cream-100/40 border border-cream-300 rounded-xl p-3">
        {children}
      </div>
    </div>
  );
}

// Buyurtmaning bosqichlarini vizual stepper sifatida ko'rsatadi.
// PENDING → PROCESSING → COMPLETED — asosiy yo'l (har biri yashil yoki kulrang).
// CANCELLED / REFUNDED — alohida qizil/kulrang branch.
function OrderStatusTimeline({
  currentStatus,
  createdAt,
  audit,
  t,
}: {
  currentStatus: OrderStatus;
  createdAt: string;
  audit: AuditEntry[];
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const { main, terminal } = buildTimeline(currentStatus, createdAt, audit);
  const currentIndex = TIMELINE_FLOW.indexOf(currentStatus);
  const isTerminal = terminal !== null;

  const stepLabel = (s: OrderStatus): string => {
    if (s === "PENDING") return t("orderDetail.timeline.pending");
    if (s === "PROCESSING") return t("orderDetail.timeline.processing");
    if (s === "COMPLETED") return t("orderDetail.timeline.completed");
    if (s === "CANCELLED") return t("orderDetail.timeline.cancelled");
    return t("orderDetail.timeline.refunded");
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-1">
        {main.map((step, i) => {
          const reached = step.reachedAt !== null;
          const isCurrent = !isTerminal && currentIndex === i;
          const isPast = !isTerminal && i < currentIndex;
          const dotColor = isTerminal
            ? (reached ? "bg-slate-400" : "bg-cream-300")
            : isCurrent
            ? "bg-leaf-500 ring-4 ring-leaf-100 animate-pulse"
            : isPast
            ? "bg-leaf-500"
            : "bg-cream-300";
          const labelColor = isTerminal
            ? "text-slate-500"
            : isCurrent || isPast
            ? "text-forest-800"
            : "text-slate-400";
          return (
            <div key={step.status} className="flex-1 flex flex-col items-center text-center relative">
              {i > 0 && (
                <div
                  className={`absolute top-2 right-1/2 w-full h-0.5 ${
                    isTerminal
                      ? "bg-cream-300"
                      : i <= currentIndex
                      ? "bg-leaf-500"
                      : "bg-cream-300"
                  }`}
                  aria-hidden
                />
              )}
              <div className={`relative z-10 w-4 h-4 rounded-full flex items-center justify-center ${dotColor}`}>
                {isPast && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
              </div>
              <p className={`text-[11px] font-medium mt-1.5 leading-tight ${labelColor}`}>
                {stepLabel(step.status)}
              </p>
              <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">
                {reached
                  ? formatDateTime(step.reachedAt!)
                  : isCurrent
                  ? t("orderDetail.timeline.pendingNow")
                  : t("orderDetail.timeline.notReached")}
              </p>
              {reached && step.actorName && (
                <p className="text-[9px] text-slate-400 mt-0.5 leading-tight truncate max-w-[80px]">
                  {t("orderDetail.timeline.byActor", { name: step.actorName })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {isTerminal && terminal && (
        <div className="mt-3 pt-3 border-t border-cream-300">
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
              terminal.status === "CANCELLED" ? "bg-rose-500" : "bg-slate-500"
            }`}>
              <X className="w-2.5 h-2.5 text-white" strokeWidth={3} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${
                terminal.status === "CANCELLED" ? "text-rose-600" : "text-slate-700"
              }`}>
                {stepLabel(terminal.status)}
              </p>
              <p className="text-[10px] text-slate-500">
                {terminal.reachedAt ? formatDateTime(terminal.reachedAt) : ""}
                {terminal.actorName ? ` · ${t("orderDetail.timeline.byActor", { name: terminal.actorName })}` : ""}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
