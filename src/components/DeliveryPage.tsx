import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Truck, MapPin, Package, Clock, CheckCircle2, XCircle,
  Edit3, Trash2, X, Loader2, AlertCircle, ChevronRight,
} from "lucide-react";
import { useAsync } from "../hooks/useAsync";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useAppToast } from "./ui/Toast";

// ─── Tiplar ──────────────────────────────────────────────────────────────────

interface DeliveryZone {
  id: string;
  name: string;
  regions: string[];
  active: boolean;
  position: number;
  methods: Array<{ id: string; name: string; price: number; type: string; minDays: number; maxDays: number }>;
}

interface DeliveryMethod {
  id: string;
  name: string;
  description: string | null;
  type: "FREE" | "FLAT_RATE" | "BY_WEIGHT" | "BY_DISTANCE";
  price: number;
  freeAbove: number | null;
  minDays: number;
  maxDays: number;
  active: boolean;
  zoneId: string | null;
  zone: { id: string; name: string } | null;
  usageCount: number;
}

interface DeliveryOrder {
  id: string;
  status: string;
  price: number;
  currency: string;
  courierName: string | null;
  courierPhone: string | null;
  trackingCode: string | null;
  scheduledAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  order: {
    code: string;
    total: number;
    currency: string;
    status: string;
    customer: { id: string; name: string; phone: string | null } | null;
    shippingAddress: string | null;
  };
  method: { id: string; name: string; type: string } | null;
}

type Tab = "methods" | "zones" | "orders";

// ─── Asosiy sahifa ────────────────────────────────────────────────────────────

export default function DeliveryPage() {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<Tab>("methods");
  const [showMethodForm, setShowMethodForm] = useState(false);
  const [editMethod, setEditMethod] = useState<DeliveryMethod | null>(null);
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editZone, setEditZone] = useState<DeliveryZone | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);

  const { data: methods, loading: methodsLoading, refetch: reloadMethods } = useAsync(
    () => api<DeliveryMethod[]>("/delivery/methods"), [],
  );
  const { data: zones, loading: zonesLoading, refetch: reloadZones } = useAsync(
    () => api<DeliveryZone[]>("/delivery/zones"), [],
  );
  const { data: ordersData, loading: ordersLoading, refetch: reloadOrders } = useAsync(
    () => api<{ items: DeliveryOrder[]; total: number }>("/delivery/orders"), [],
  );
  const { data: stats } = useAsync(
    () => api<{ total: number; byStatus: Array<{ status: string; count: number }> }>("/delivery/stats"), [],
  );

  const STATUS_CONF: Record<string, { color: string; bg: string; label: string; Icon: typeof Truck }> = {
    PENDING:    { color: "#f59e0b", bg: "bg-amber-50 border-amber-200",   label: t("delivery.dStatus.PENDING"),   Icon: Clock },
    ASSIGNED:   { color: "#3b82f6", bg: "bg-sky-50 border-sky-200",       label: t("delivery.dStatus.ASSIGNED"),   Icon: Truck },
    PICKED_UP:  { color: "#8b5cf6", bg: "bg-violet-50 border-violet-200", label: t("delivery.dStatus.PICKED_UP"),  Icon: Package },
    IN_TRANSIT: { color: "#06b6d4", bg: "bg-cyan-50 border-cyan-200",     label: t("delivery.dStatus.IN_TRANSIT"), Icon: Truck },
    DELIVERED:  { color: "#84cc16", bg: "bg-leaf-50 border-leaf-200",     label: t("delivery.dStatus.DELIVERED"), Icon: CheckCircle2 },
    FAILED:     { color: "#ef4444", bg: "bg-red-50 border-red-200",       label: t("delivery.dStatus.FAILED"),     Icon: XCircle },
    RETURNED:   { color: "#64748b", bg: "bg-slate-100 border-slate-300",  label: t("delivery.dStatus.RETURNED"),   Icon: XCircle },
  };

  const TYPE_LABELS: Record<string, string> = {
    FREE:        t("delivery.type.FREE"),
    FLAT_RATE:   t("delivery.type.FLAT_RATE"),
    BY_WEIGHT:   t("delivery.type.BY_WEIGHT"),
    BY_DISTANCE: t("delivery.type.BY_DISTANCE"),
  };

  function formatPrice(v: number, currency = "UZS") {
    if (currency === "UZS") return v.toLocaleString("uz-UZ") + " " + t("common.sum");
    return v.toLocaleString() + " " + currency;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold text-forest-900">{t("delivery.title")}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t("delivery.pageSubtitle")}
          </p>
        </div>
        {activeTab === "methods" && (
          <button
            onClick={() => { setEditMethod(null); setShowMethodForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-forest-700 hover:bg-forest-800 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("delivery.newMethod")}
          </button>
        )}
        {activeTab === "zones" && (
          <button
            onClick={() => { setEditZone(null); setShowZoneForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-forest-700 hover:bg-forest-800 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("delivery.newZone")}
          </button>
        )}
      </motion.div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: t("delivery.stat.total"),     value: stats.total, color: "#475569" },
            { label: t("delivery.stat.inTransit"), value: stats.byStatus.find(s => s.status === "IN_TRANSIT")?.count ?? 0, color: "#06b6d4" },
            { label: t("delivery.stat.delivered"), value: stats.byStatus.find(s => s.status === "DELIVERED")?.count ?? 0, color: "#84cc16" },
            { label: t("delivery.stat.failed"),    value: stats.byStatus.find(s => s.status === "FAILED")?.count ?? 0, color: "#ef4444" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white border border-cream-300/80 rounded-2xl p-4"
              style={{ borderTop: `2px solid ${s.color}` }}
            >
              <p className="text-2xl font-bold text-forest-800">{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-cream-100 p-1 rounded-xl w-fit border border-cream-300">
        {(["methods", "zones", "orders"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab
              ? { backgroundColor: "#fff", color: "#1F3327", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
              : { color: "#64748b" }
            }
          >
            {tab === "methods" ? t("delivery.tab.methodsLabel") : tab === "zones" ? t("delivery.tab.zonesLabel") : t("delivery.tab.ordersLabel")}
          </button>
        ))}
      </div>

      {/* Methods tab */}
      {activeTab === "methods" && (
        <div className="space-y-3">
          {methodsLoading && <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
          {!methodsLoading && (!methods || methods.length === 0) && (
            <div className="bg-white border border-cream-300 rounded-2xl p-8 text-center">
              <Truck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-forest-800 mb-1">{t("delivery.methods.empty")}</p>
              <p className="text-sm text-slate-500">{t("delivery.methods.emptyHint")}</p>
            </div>
          )}
          {methods?.map((method) => (
            <motion.div
              key={method.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-cream-300/80 rounded-2xl p-4 flex items-center gap-4 hover:border-cream-300 transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                method.active ? "bg-leaf-100" : "bg-slate-100"
              }`}>
                <Truck className={`w-5 h-5 ${method.active ? "text-forest-700" : "text-slate-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-forest-800 text-sm">{method.name}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    method.active ? "bg-leaf-100 text-forest-700 border-leaf-300/60" : "bg-slate-100 text-slate-500 border-slate-300"
                  }`}>
                    {method.active ? t("delivery.active") : t("delivery.inactive")}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {TYPE_LABELS[method.type]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-sm font-semibold text-forest-700">
                    {method.type === "FREE" ? t("delivery.type.FREE") : formatPrice(method.price)}
                  </span>
                  {method.freeAbove && (
                    <span className="text-xs text-slate-500">
                      {t("delivery.freeAboveLabel", { price: formatPrice(method.freeAbove) })}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {method.minDays}–{method.maxDays} {t("delivery.days")}
                  </span>
                  {method.zone && (
                    <span className="text-xs text-forest-700 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{method.zone.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-slate-400">{t("delivery.usageCount", { count: String(method.usageCount) })}</span>
                <button
                  onClick={() => { setEditMethod(method); setShowMethodForm(true); }}
                  className="p-2 rounded-lg text-slate-400 hover:text-forest-800 hover:bg-cream-100 transition-colors"
                  title={t("common.edit")}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(t("delivery.confirmDelete", { name: method.name }))) return;
                    await api(`/delivery/methods/${method.id}`, { method: "DELETE" });
                    reloadMethods();
                  }}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title={t("common.delete")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Zones tab */}
      {activeTab === "zones" && (
        <div className="space-y-3">
          {zonesLoading && <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
          {!zonesLoading && (!zones || zones.length === 0) && (
            <div className="bg-white border border-cream-300 rounded-2xl p-8 text-center">
              <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-forest-800 mb-1">{t("delivery.zones.empty")}</p>
              <p className="text-sm text-slate-500">{t("delivery.zones.emptyHint")}</p>
            </div>
          )}
          {zones?.map((zone) => (
            <div
              key={zone.id}
              className="bg-white border border-cream-300/80 rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-leaf-100 flex items-center justify-center">
                    <MapPin className="w-4.5 h-4.5 text-forest-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-forest-800 text-sm">{zone.name}</p>
                    <p className="text-xs text-slate-400">{t("delivery.zones.methodCount", { count: String(zone.methods.length) })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditZone(zone); setShowZoneForm(true); }}
                    className="p-2 rounded-lg text-slate-400 hover:text-forest-800 hover:bg-cream-100 transition-colors"
                    title={t("common.edit")}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(t("delivery.confirmDelete", { name: zone.name }))) return;
                      await api(`/delivery/zones/${zone.id}`, { method: "DELETE" });
                      reloadZones();
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title={t("common.delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {zone.regions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {zone.regions.map((r) => (
                    <span key={r} className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Orders tab */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          {ordersLoading && <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
          {!ordersLoading && (!ordersData?.items || ordersData.items.length === 0) && (
            <div className="bg-white border border-cream-300 rounded-2xl p-8 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-forest-800">{t("delivery.orders.empty")}</p>
            </div>
          )}
          {ordersData?.items.map((dOrder) => {
            const conf = STATUS_CONF[dOrder.status] ?? STATUS_CONF.PENDING;
            const StatusIcon = conf.Icon;
            return (
              <motion.div
                key={dOrder.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-cream-300/80 rounded-2xl p-4 cursor-pointer hover:border-cream-300 transition-colors"
                onClick={() => setSelectedOrder(dOrder)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${conf.bg}`}>
                      <StatusIcon className="w-5 h-5" style={{ color: conf.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-forest-800 text-sm">#{dOrder.order.code}</p>
                      <p className="text-xs text-slate-500">{dOrder.order.customer?.name ?? "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                      style={{ backgroundColor: conf.color + "15", color: conf.color, borderColor: conf.color + "30" }}
                    >
                      {conf.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                {dOrder.order.shippingAddress && (
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {dOrder.order.shippingAddress}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Method form modal */}
      <AnimatePresence>
        {showMethodForm && (
          <MethodFormModal
            method={editMethod}
            zones={zones ?? []}
            onClose={() => setShowMethodForm(false)}
            onSaved={() => { setShowMethodForm(false); reloadMethods(); }}
          />
        )}
      </AnimatePresence>

      {/* Zone form modal */}
      <AnimatePresence>
        {showZoneForm && (
          <ZoneFormModal
            zone={editZone}
            onClose={() => setShowZoneForm(false)}
            onSaved={() => { setShowZoneForm(false); reloadZones(); }}
          />
        )}
      </AnimatePresence>

      {/* Order detail modal */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onStatusUpdate={() => { setSelectedOrder(null); reloadOrders(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Yetkazib berish usul formasi ─────────────────────────────────────────────

function MethodFormModal({
  method, zones, onClose, onSaved,
}: {
  method: DeliveryMethod | null;
  zones: DeliveryZone[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useT();
  const isEdit = !!method;
  const [form, setForm] = useState({
    name: method?.name ?? "",
    description: method?.description ?? "",
    type: method?.type ?? "FLAT_RATE" as DeliveryMethod["type"],
    price: method?.price ?? 0,
    freeAbove: method?.freeAbove ?? "",
    minDays: method?.minDays ?? 1,
    maxDays: method?.maxDays ?? 3,
    zoneId: method?.zoneId ?? "",
    active: method?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.name.trim()) { setError(t("delivery.form.nameRequired")); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        freeAbove: form.freeAbove !== "" ? Number(form.freeAbove) : null,
        zoneId: form.zoneId || null,
      };
      if (isEdit) {
        await api(`/delivery/methods/${method!.id}`, { method: "PATCH", body });
      } else {
        await api("/delivery/methods", { method: "POST", body });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="bg-cream-50 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-forest-800">{isEdit ? t("delivery.method.editTitle") : t("delivery.method.newTitle")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-forest-800 hover:bg-cream-100" title={t("common.close")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">{t("delivery.form.name")} *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("delivery.form.namePlaceholder")}
              className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-leaf-500/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("delivery.form.type")}</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DeliveryMethod["type"] }))}
                className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              >
                <option value="FLAT_RATE">{t("delivery.type.FLAT_RATE")}</option>
                <option value="FREE">{t("delivery.type.FREE")}</option>
                <option value="BY_WEIGHT">{t("delivery.type.BY_WEIGHT")}</option>
                <option value="BY_DISTANCE">{t("delivery.type.BY_DISTANCE")}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("delivery.form.price")}</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                disabled={form.type === "FREE"}
                className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              {t("delivery.form.freeAbove")}
            </label>
            <input
              type="number"
              value={form.freeAbove}
              onChange={(e) => setForm((f) => ({ ...f, freeAbove: e.target.value }))}
              placeholder="500000"
              className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("delivery.form.minDays")}</label>
              <input
                type="number"
                min={1}
                value={form.minDays}
                onChange={(e) => setForm((f) => ({ ...f, minDays: Number(e.target.value) }))}
                className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("delivery.form.maxDays")}</label>
              <input
                type="number"
                min={1}
                value={form.maxDays}
                onChange={(e) => setForm((f) => ({ ...f, maxDays: Number(e.target.value) }))}
                className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
          </div>

          {zones.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t("delivery.form.zone")}</label>
              <select
                value={form.zoneId}
                onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value }))}
                className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              >
                <option value="">{t("delivery.form.allZones")}</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm text-slate-700">{t("delivery.active")}</span>
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-cream-100 hover:bg-cream-200 transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-forest-700 hover:bg-forest-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? t("common.save") : t("delivery.create")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Zona formasi ─────────────────────────────────────────────────────────────

function ZoneFormModal({
  zone, onClose, onSaved,
}: { zone: DeliveryZone | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useT();
  const isEdit = !!zone;
  const [form, setForm] = useState({
    name: zone?.name ?? "",
    regions: zone?.regions.join(", ") ?? "",
    active: zone?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.name.trim()) { setError(t("delivery.form.nameRequired")); return; }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        regions: form.regions.split(",").map((r) => r.trim()).filter(Boolean),
        active: form.active,
      };
      if (isEdit) await api(`/delivery/zones/${zone!.id}`, { method: "PATCH", body });
      else await api("/delivery/zones", { method: "POST", body });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
        className="bg-cream-50 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-forest-800">{isEdit ? t("delivery.zone.editTitle") : t("delivery.zone.newTitle")}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-forest-800 hover:bg-cream-100" title={t("common.close")}>
            <X className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">{t("delivery.form.name")} *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t("delivery.zone.namePlaceholder")}
              className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-leaf-500/60"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              {t("delivery.zone.regionsLabel")}
            </label>
            <textarea
              value={form.regions}
              onChange={(e) => setForm((f) => ({ ...f, regions: e.target.value }))}
              placeholder={t("delivery.zone.regionsPlaceholder")}
              rows={3}
              className="w-full bg-white border border-cream-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-leaf-500/60 resize-none"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded" />
            <span className="text-sm text-slate-700">{t("delivery.active")}</span>
          </label>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-cream-100 hover:bg-cream-200 transition-colors">
            {t("common.cancel")}
          </button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-forest-700 hover:bg-forest-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? t("common.save") : t("delivery.create")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Order detail modal ────────────────────────────────────────────────────────

function OrderDetailModal({
  order, onClose, onStatusUpdate,
}: { order: DeliveryOrder; onClose: () => void; onStatusUpdate: () => void }) {
  const { t } = useT();
  const [updating, setUpdating] = useState(false);
  const toast = useAppToast();

  const STATUS_CONF: Record<string, { color: string; bg: string; label: string; Icon: typeof Truck }> = {
    PENDING:    { color: "#f59e0b", bg: "bg-amber-50 border-amber-200",   label: t("delivery.dStatus.PENDING"),   Icon: Clock },
    ASSIGNED:   { color: "#3b82f6", bg: "bg-sky-50 border-sky-200",       label: t("delivery.dStatus.ASSIGNED"),   Icon: Truck },
    PICKED_UP:  { color: "#8b5cf6", bg: "bg-violet-50 border-violet-200", label: t("delivery.dStatus.PICKED_UP"),  Icon: Package },
    IN_TRANSIT: { color: "#06b6d4", bg: "bg-cyan-50 border-cyan-200",     label: t("delivery.dStatus.IN_TRANSIT"), Icon: Truck },
    DELIVERED:  { color: "#84cc16", bg: "bg-leaf-50 border-leaf-200",     label: t("delivery.dStatus.DELIVERED"), Icon: CheckCircle2 },
    FAILED:     { color: "#ef4444", bg: "bg-red-50 border-red-200",       label: t("delivery.dStatus.FAILED"),     Icon: XCircle },
    RETURNED:   { color: "#64748b", bg: "bg-slate-100 border-slate-300",  label: t("delivery.dStatus.RETURNED"),   Icon: XCircle },
  };

  const NEXT_STATUS: Record<string, string> = {
    PENDING: "ASSIGNED",
    ASSIGNED: "PICKED_UP",
    PICKED_UP: "IN_TRANSIT",
    IN_TRANSIT: "DELIVERED",
  };

  const conf = STATUS_CONF[order.status] ?? STATUS_CONF.PENDING;
  const nextStatus = NEXT_STATUS[order.status];

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await api(`/delivery/orders/${order.id}/status`, { method: "PATCH", body: { status } });
      onStatusUpdate();
    } catch {
      toast.error(t("delivery.orders.updateError"));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
        className="bg-cream-50 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-forest-800">{t("delivery.orders.detailTitle", { code: order.order.code })}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-forest-800 hover:bg-cream-100" title={t("common.close")}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-xl border" style={{ backgroundColor: conf.color + "10", borderColor: conf.color + "30" }}>
            <conf.Icon className="w-4 h-4" style={{ color: conf.color }} />
            <span className="text-sm font-semibold" style={{ color: conf.color }}>{conf.label}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400 text-xs">{t("delivery.orders.customer")}</p>
              <p className="font-medium text-forest-800">{order.order.customer?.name ?? "—"}</p>
              {order.order.customer?.phone && <p className="text-slate-500 text-xs">{order.order.customer.phone}</p>}
            </div>
            <div>
              <p className="text-slate-400 text-xs">{t("delivery.orders.price")}</p>
              <p className="font-semibold text-forest-700">
                {order.price > 0
                  ? `${order.price.toLocaleString("uz-UZ")} ${t("common.sum")}`
                  : t("delivery.type.FREE")}
              </p>
            </div>
            {order.order.shippingAddress && (
              <div className="col-span-2">
                <p className="text-slate-400 text-xs">{t("delivery.orders.address")}</p>
                <p className="font-medium text-forest-800">{order.order.shippingAddress}</p>
              </div>
            )}
            {order.courierName && (
              <div>
                <p className="text-slate-400 text-xs">{t("delivery.orders.courier")}</p>
                <p className="font-medium text-forest-800">{order.courierName}</p>
                {order.courierPhone && <p className="text-slate-500 text-xs">{order.courierPhone}</p>}
              </div>
            )}
            {order.trackingCode && (
              <div>
                <p className="text-slate-400 text-xs">{t("delivery.orders.tracking")}</p>
                <p className="font-mono text-sm text-forest-800">{order.trackingCode}</p>
              </div>
            )}
          </div>
        </div>

        {nextStatus && (
          <button
            onClick={() => updateStatus(nextStatus)}
            disabled={updating}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-forest-700 hover:bg-forest-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {updating && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("delivery.orders.advanceStatus", { label: STATUS_CONF[nextStatus]?.label ?? nextStatus })}
          </button>
        )}

        {order.status !== "FAILED" && order.status !== "RETURNED" && order.status !== "DELIVERED" && (
          <button
            onClick={() => updateStatus("FAILED")}
            disabled={updating}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
          >
            {t("delivery.orders.markFailed")}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
