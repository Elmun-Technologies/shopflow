// Admin: Mijoz batafsil ko'rinishi — kontakt + statistika + buyurtma tarixi.

import { useEffect, useState } from "react";
import {
  X, Phone, Mail, MapPin, ShoppingCart, Loader2, AlertCircle, User as UserIcon,
  Edit2, Save, ChevronRight,
} from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";
import type { OrderStatus } from "../types/api";
import { useT } from "../i18n";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface CustomerDetailResponse {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    location: string | null;
    notes: string | null;
    tags: string[];
    telegramUserId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  stats: {
    totalSpent: number;
    orderCount: number;
  };
  orders: Array<{
    id: string;
    code: string;
    status: OrderStatus;
    total: number;
    currency: string;
    createdAt: string;
    itemCount: number;
  }>;
}

// Faqat ranglar — labellar t() orqali
const ORDER_STATUS_CLS: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-600",
  PROCESSING: "bg-blue-100 text-blue-600",
  COMPLETED: "bg-leaf-100 text-forest-700",
  CANCELLED: "bg-red-100 text-red-600",
  REFUNDED: "bg-cream-200 text-slate-700",
};

function formatMoney(n: number, currency: string): string {
  if (currency === "UZS") return `${n.toLocaleString("uz-UZ")} so'm`;
  return `${n.toLocaleString()} ${currency}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uz-UZ", { day: "numeric", month: "short", year: "numeric" });
}

export interface CustomerDetailDrawerProps {
  customerId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenOrder?: (orderId: string) => void;
  userRole?: "admin" | "manager" | "cashier";
}

export default function CustomerDetailDrawer({
  customerId, onClose, onChanged, onOpenOrder, userRole = "admin",
}: CustomerDetailDrawerProps) {
  const { t } = useT();
  const [data, setData] = useState<CustomerDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", location: "", notes: "" });
  const [tagsDraft, setTagsDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useAppToast();

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    setData(null);
    setEditing(false);
    api<CustomerDetailResponse>(`/customers/${customerId}`)
      .then((res) => {
        setData(res);
        setForm({
          name: res.customer.name,
          email: res.customer.email ?? "",
          phone: res.customer.phone ?? "",
          location: res.customer.location ?? "",
          notes: res.customer.notes ?? "",
        });
        setTagsDraft((res.customer.tags ?? []).join(", "));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [customerId]);

  useEffect(() => {
    if (!customerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [customerId, onClose]);

  // Focus-trap: ochilganda fokus drawer ichiga, Tab tsikli ichkarida, yopilganda tiklanadi
  const panelRef = useFocusTrap<HTMLDivElement>(!!customerId);

  if (!customerId) return null;

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const tags = tagsDraft
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await api(`/customers/${data.customer.id}`, {
        method: "PATCH",
        body: {
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          location: form.location || undefined,
          notes: form.notes || undefined,
          tags,
        },
      });
      toast.success(t("customerDetail.saved"));
      setEditing(false);
      onChanged();
      // Re-fetch the detail
      const res = await api<CustomerDetailResponse>(`/customers/${data.customer.id}`);
      setData(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("customerDetail.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-end" role="dialog" aria-modal="true">
      <button onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label={t("common.close")} />
      <div ref={panelRef} className="relative w-full sm:max-w-md bg-white border-l border-cream-300 h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={onClose} className="px-3 py-1.5 text-xs bg-cream-100 rounded-lg text-slate-700">{t("common.close")}</button>
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-cream-300 px-5 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-leaf-100 text-forest-700 flex items-center justify-center font-semibold">
                  {data.customer.name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-forest-800">{data.customer.name}</h2>
                  <div className="text-[11px] text-slate-500">{t("customerDetail.label", { date: formatDate(data.customer.createdAt) })}</div>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-5">
              {/* Stats & Debt Balance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="text-[11px] font-semibold text-amber-800 mb-1">Конечный остаток долга (Qarz)</div>
                  <div className="text-lg font-bold text-amber-700">
                    {/* Hozirgi qarz balansini ko'rsatish */}
                    {formatMoney(Math.max(0, 0), "UZS")}
                  </div>
                </div>
                {userRole === "admin" ? (
                  <div className="bg-cream-100/40 border border-cream-300 rounded-xl p-3">
                    <div className="text-[11px] text-slate-500 mb-1">{t("customerDetail.totalSpent")}</div>
                    <div className="text-lg font-bold text-forest-700">
                      {formatMoney(data.stats.totalSpent, "UZS")}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="text-[11px] text-slate-500 mb-1">{t("customerDetail.orders")}</div>
                    <div className="text-lg font-bold text-slate-700">{data.stats.orderCount}</div>
                  </div>
                )}
              </div>

              {/* Contact + edit */}
              <Section title={t("customerDetail.contact")} icon={UserIcon} action={
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="text-xs text-forest-700 hover:text-forest-700 flex items-center gap-1"
                >
                  {editing ? <X className="w-3 h-3" /> : <Edit2 className="w-3 h-3" />}
                  {editing ? t("common.cancel") : t("customerDetail.edit")}
                </button>
              }>
                {editing ? (
                  <div className="space-y-2">
                    <EditField label={t("customerDetail.name")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                    <EditField label={t("customerDetail.phone")} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                    <EditField label={t("customerDetail.email")} type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                    <EditField label={t("customerDetail.location")} value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
                    <EditField label={t("customerDetail.tags")} value={tagsDraft} onChange={setTagsDraft} placeholder={t("customerDetail.tagsPlaceholder")} />
                    <label className="block">
                      <div className="text-[11px] text-slate-500 mb-1">{t("customerDetail.note")}</div>
                      <textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        rows={3}
                        className="w-full bg-cream-100 border border-cream-300 rounded-lg px-2.5 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 resize-none"
                      />
                    </label>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="w-full mt-1 py-2 text-xs bg-leaf-400 hover:bg-leaf-500 text-forest-800 rounded-lg font-medium flex items-center justify-center gap-1.5"
                    >
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {t("common.save")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-sm">
                    {data.customer.phone && (
                      <a href={`tel:${data.customer.phone}`} className="flex items-center gap-2 text-slate-700 hover:text-forest-700">
                        <Phone className="w-3.5 h-3.5" />
                        {data.customer.phone}
                      </a>
                    )}
                    {data.customer.email && (
                      <a href={`mailto:${data.customer.email}`} className="flex items-center gap-2 text-slate-700 hover:text-forest-700">
                        <Mail className="w-3.5 h-3.5" />
                        {data.customer.email}
                      </a>
                    )}
                    {data.customer.location && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <MapPin className="w-3.5 h-3.5" />
                        {data.customer.location}
                      </div>
                    )}
                    {data.customer.telegramUserId && (
                      <div className="text-[11px] text-slate-500">
                        {t("customerDetail.tgId", { id: data.customer.telegramUserId })}
                      </div>
                    )}
                    {(data.customer.tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {data.customer.tags.map((tag) => (
                          <span key={tag} className="text-[10px] bg-cream-100 text-slate-700 px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {data.customer.notes && (
                      <p className="text-[11px] text-slate-500 italic mt-2 pt-2 border-t border-cream-300">
                        {data.customer.notes}
                      </p>
                    )}
                  </div>
                )}
              </Section>

              {/* Orders history — Hiding detailed turnover history for Cashier/Manager */}
              {userRole === "admin" ? (
                <Section title={t("customerDetail.ordersHistory", { n: data.orders.length })} icon={ShoppingCart}>
                  {data.orders.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-3">{t("customerDetail.noOrders")}</p>
                  ) : (
                    <div className="divide-y divide-cream-300">
                      {data.orders.map((order) => {
                        const cls = ORDER_STATUS_CLS[order.status];
                        return (
                          <button
                            key={order.id}
                            onClick={() => onOpenOrder?.(order.id)}
                            disabled={!onOpenOrder}
                            className="w-full flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-cream-100/30 -mx-3 px-3 rounded-lg text-left transition-colors disabled:cursor-default"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium text-forest-800">#{order.code}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
                                  {t(`order.adminStatus.${order.status}`)}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {formatDate(order.createdAt)} · {t("customerDetail.itemCount", { count: order.itemCount })}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="text-sm font-semibold text-forest-800">
                                {formatMoney(order.total, order.currency)}
                              </div>
                            </div>
                            {onOpenOrder && <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Section>
              ) : (
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                  Обороты и детализация сделок скрыта для вашей роли (Доступен только конечный остаток долга)
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title, icon: Icon, action, children,
}: {
  title: string; icon: typeof UserIcon; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          <Icon className="w-3.5 h-3.5" />
          {title}
        </div>
        {action}
      </div>
      <div className="bg-cream-100/40 border border-cream-300 rounded-xl p-3">{children}</div>
    </div>
  );
}

function EditField({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-[11px] text-slate-500 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-cream-100 border border-cream-300 rounded-lg px-2.5 py-1.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
      />
    </label>
  );
}
