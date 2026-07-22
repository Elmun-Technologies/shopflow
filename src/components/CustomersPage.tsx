import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Loader2, Users, Mail, Phone, MapPin, AlertCircle, Download, Crown, Heart, Sparkles, AlertTriangle, Moon, Snowflake, X } from "lucide-react";
import { exportToCsv } from "../utils/exportCsv";
import { TableRowsSkeleton } from "./ui/Skeleton";
import { useQueryAsync } from "../hooks/useQueryAsync";
import { customersApi, type RfmSegment } from "../api/endpoints";
import { useAppToast } from "./ui/Toast";
import { formatDate } from "../utils/format";
import { useT } from "../i18n";
import CustomerDetailDrawer from "./CustomerDetailDrawer";

const RFM_META: Record<Exclude<RfmSegment, "nobody">, {
  labelKey: string;
  descKey: string;
  icon: typeof Crown;
  color: string;
}> = {
  champion: {
    labelKey: "customers.rfm.champion.label",
    descKey: "customers.rfm.champion.desc",
    icon: Crown,
    color: "bg-purple-100 text-purple-700 border-purple-300",
  },
  loyal: {
    labelKey: "customers.rfm.loyal.label",
    descKey: "customers.rfm.loyal.desc",
    icon: Heart,
    color: "bg-leaf-100 text-forest-700 border-leaf-300/60",
  },
  new: {
    labelKey: "customers.rfm.new.label",
    descKey: "customers.rfm.new.desc",
    icon: Sparkles,
    color: "bg-blue-100 text-blue-600 border-blue-300",
  },
  atRisk: {
    labelKey: "customers.rfm.atRisk.label",
    descKey: "customers.rfm.atRisk.desc",
    icon: AlertTriangle,
    color: "bg-amber-100 text-amber-700 border-amber-300",
  },
  hibernating: {
    labelKey: "customers.rfm.hibernating.label",
    descKey: "customers.rfm.hibernating.desc",
    icon: Moon,
    color: "bg-cream-200 text-slate-600 border-cream-300",
  },
  lost: {
    labelKey: "customers.rfm.lost.label",
    descKey: "customers.rfm.lost.desc",
    icon: Snowflake,
    color: "bg-red-100 text-red-600 border-red-300",
  },
};

const RFM_ORDER: Exclude<RfmSegment, "nobody">[] = ["champion", "loyal", "new", "atRisk", "hibernating", "lost"];

export default function CustomersPage() {
  const { t } = useT();
  const toast = useAppToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 30;
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState<RfmSegment | "all">("all");

  // Segment filtri faol bo'lsa — server tomonda filtr yo'q (segmentlar RFM
  // endpoint'da hisoblanadi), shuning uchun to'liq ro'yxatni (limit 500) yuklab
  // client tomonda filtrlab, client tomonda sahifalaymiz. Aks holda faqat joriy
  // 30-qatorli sahifa filtrlanardi va total/pagination desync bo'lardi.
  const segmentActive = segmentFilter !== "all";
  const params = useMemo(
    () => ({
      page: segmentActive ? 1 : page,
      pageSize: segmentActive ? 500 : pageSize,
      search: search || undefined,
    }),
    [page, search, segmentActive],
  );
  const { data, loading, error, refetch } = useQueryAsync(["customers", "list", params], () => customersApi.list(params));
  const { data: rfm } = useQueryAsync(["customers", "rfm"], () => customersApi.rfm());

  // RFM segmentlarini mijoz ID bo'yicha mapping — jadval'da badge ko'rsatish uchun
  const segmentById = useMemo(() => {
    const map = new Map<string, RfmSegment>();
    if (rfm) rfm.customers.forEach((c) => map.set(c.id, c.segment));
    return map;
  }, [rfm]);

  // Filtrlangan to'liq ro'yxat (segment faol bo'lganda)
  const filteredAll = useMemo(() => {
    const all = data?.items ?? [];
    if (!segmentActive) return all;
    return all.filter((c) => segmentById.get(c.id) === segmentFilter);
  }, [data, segmentFilter, segmentById, segmentActive]);

  // Segment faol bo'lsa client tomonda sahifalash; aks holda server sahifasi.
  const customers = segmentActive
    ? filteredAll.slice((page - 1) * pageSize, page * pageSize)
    : filteredAll;
  const total = segmentActive ? filteredAll.length : (data?.total ?? 0);

  // Segment tanlansa/almashsa sahifani 1 ga qaytaramiz (stale page oldini olish)
  const selectSegment = (seg: RfmSegment | "all") => {
    setSegmentFilter(seg);
    setPage(1);
  };
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await customersApi.list({ search: search || undefined, page: 1, pageSize: 500 });
      exportToCsv({
        filename: `customers-${new Date().toISOString().slice(0, 10)}`,
        columns: [
          { key: "name", label: t("customers.col.customer") },
          { key: "phone", label: t("customers.field.phone") },
          { key: "email", label: t("customers.field.email") },
          { key: "location", label: t("customers.col.location") },
          { key: "tags", label: t("customers.field.tags") },
          { key: "createdAt", label: t("customers.col.date") },
        ],
        rows: res.items.map((c) => ({
          name: c.name,
          phone: c.phone ?? "",
          email: c.email ?? "",
          location: c.location ?? "",
          tags: c.tags.join("; "),
          createdAt: c.createdAt,
        })),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-forest-800">{t("customers.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">{t("customers.subtitle")}</p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("customers.searchPlaceholder")}
            className="w-full bg-white border border-cream-300 rounded-lg pl-10 pr-4 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60"
          />
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center justify-center gap-2 px-3 py-2.5 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-lg text-sm text-forest-800 transition-all flex-shrink-0 disabled:opacity-50"
          title={t("orders.export")}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">{t("orders.export")}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-leaf-400 hover:bg-leaf-500 rounded-lg text-sm font-medium text-forest-800 transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t("customers.newCustomer")}</span>
        </button>
      </div>

      {rfm && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-forest-800">{t("customers.rfm.title")}</h3>
            {segmentFilter !== "all" && (
              <button
                type="button"
                onClick={() => selectSegment("all")}
                className="text-xs text-slate-500 hover:text-forest-800"
              >
                {t("customers.rfm.clearFilter")}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {RFM_ORDER.map((seg) => {
              const meta = RFM_META[seg];
              const Icon = meta.icon;
              const count = rfm.counts[seg] ?? 0;
              const isActive = segmentFilter === seg;
              return (
                <button
                  key={seg}
                  type="button"
                  onClick={() => selectSegment(segmentFilter === seg ? "all" : seg)}
                  disabled={count === 0}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    isActive
                      ? "border-leaf-500 ring-2 ring-leaf-500/30 bg-white"
                      : "bg-white border-cream-300 hover:border-cream-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                  title={t(meta.descKey)}
                >
                  <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border ${meta.color} mb-2`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-lg font-bold text-forest-800 leading-tight">{count}</p>
                  <p className="text-[11px] text-slate-600 font-medium leading-tight mt-0.5">{t(meta.labelKey)}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-cream-300 rounded-xl overflow-hidden">
        {loading ? (
          <TableRowsSkeleton rows={8} cols={4} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
            <p className="text-sm text-slate-700">{error.message}</p>
            <button onClick={refetch} className="mt-3 px-3 py-1.5 text-xs bg-cream-100 rounded-lg text-slate-700">
              {t("orders.retry")}
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <Users className="w-12 h-12 text-cream-300 mb-3" />
            <p className="text-base font-semibold text-forest-800">
              {search ? t("customers.empty.search") : t("customers.empty.none")}
            </p>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              {t("customers.empty.hint")}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop — jadval */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-cream-300">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("customers.col.customer")}</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("customers.col.contact")}</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("customers.col.location")}</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{t("customers.col.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-cream-300/50 hover:bg-cream-100/30 transition-colors cursor-pointer"
                      onClick={() => setOpenCustomerId(c.id)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-forest-800">{c.name}</p>
                          {(() => {
                            const seg = segmentById.get(c.id);
                            if (!seg || seg === "nobody") return null;
                            const meta = RFM_META[seg];
                            const Icon = meta.icon;
                            return (
                              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${meta.color}`}>
                                <Icon className="w-3 h-3" />
                                {t(meta.labelKey)}
                              </span>
                            );
                          })()}
                        </div>
                        {c.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-cream-100 text-slate-500">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          {c.email && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Mail className="w-3 h-3" /> {c.email}
                            </span>
                          )}
                          {c.phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Phone className="w-3 h-3" /> {c.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {c.location && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="w-3 h-3" /> {c.location}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-slate-500">{formatDate(c.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — card */}
            <div className="md:hidden divide-y divide-cream-300/50">
              {customers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOpenCustomerId(c.id)}
                  className="w-full text-left p-4 hover:bg-cream-100/30 active:bg-cream-100/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-forest-800 truncate">{c.name}</p>
                        {(() => {
                          const seg = segmentById.get(c.id);
                          if (!seg || seg === "nobody") return null;
                          const meta = RFM_META[seg];
                          const Icon = meta.icon;
                          return (
                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${meta.color}`}>
                              <Icon className="w-2.5 h-2.5" />
                              {t(meta.labelKey)}
                            </span>
                          );
                        })()}
                      </div>
                      {c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-cream-100 text-slate-500">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {(c.phone || c.email) && (
                        <p className="text-xs text-slate-500 mt-1 truncate">{c.phone ?? c.email}</p>
                      )}
                      {c.location && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{c.location}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 flex-shrink-0">{formatDate(c.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-cream-300 text-xs text-slate-500">
            <span>
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 disabled:opacity-30"
              >
                {t("orders.prev")}
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= total}
                className="px-3 py-1 rounded-lg bg-cream-100 hover:bg-cream-200 disabled:opacity-30"
              >
                {t("orders.next")}
              </button>
            </div>
          </div>
        )}
      </div>

      <CustomerDetailDrawer
        customerId={openCustomerId}
        onClose={() => setOpenCustomerId(null)}
        onChanged={refetch}
      />

      {showCreate && (
        <CustomerCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            toast.success(t("customers.created"));
            refetch();
          }}
        />
      )}
    </>
  );
}

function CustomerCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useT();
  const toast = useAppToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", location: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await customersApi.create({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("customers.createFailed"));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <motion.form
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white border border-cream-300 rounded-2xl p-5 max-w-md w-full"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-forest-800">{t("customers.newCustomer")}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-cream-100" aria-label={t("common.close")}>
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">{t("customers.col.customer")} *</span>
            <input type="text" required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("customers.placeholder.name")} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-500 mb-1 block">{t("customers.field.phone")}</span>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998…" className={field} />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500 mb-1 block">{t("customers.field.email")}</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@…" className={field} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">{t("customers.col.location")}</span>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t("customers.placeholder.location")} className={field} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1 block">{t("customers.field.notes")}</span>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${field} resize-none`} />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-sm bg-cream-100 hover:bg-cream-200 text-slate-700">{t("common.cancel")}</button>
          <button type="submit" disabled={busy || !form.name.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 font-medium">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("common.add")}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
