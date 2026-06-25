import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Eye, Edit2, Trash2, ChevronLeft, Users, Filter, AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import type { CustomerSegment, SegmentType, SegmentCondition } from "../../data/customersData";
import { segmentTypeLabels, segmentConditionFields, customers } from "../../data/customersData";
import { api } from "../../api/client";
import { useAppToast } from "../ui/Toast";
import { useT } from "../../i18n";

// Backend'dan keladigan format (uppercase enum)
interface ApiSegment {
  id: string;
  name: string;
  description: string;
  type: "AUTOMATIC" | "MANUAL" | "SMART";
  active: boolean;
  conditions: unknown;
  tags: string[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

function adaptSegment(s: ApiSegment): CustomerSegment {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    type: s.type.toLowerCase() as SegmentType,
    active: s.active,
    conditions: (Array.isArray(s.conditions) ? s.conditions : []) as SegmentCondition[],
    tags: s.tags ?? [],
    memberCount: s.memberCount,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    createdBy: "—",
  };
}

const inputClass = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 focus:ring-1 focus:ring-leaf-500/20";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";

function SegmentTypeBadge({ type }: { type: SegmentType }) {
  const colors: Record<SegmentType, string> = {
    automatic: "bg-sky-100 text-sky-600 border border-sky-300",
    manual: "bg-slate-600 text-forest-700",
    smart: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border ${colors[type]}`}>
      {segmentTypeLabels[type]}
    </span>
  );
}

function ConditionsList({ conditions }: { conditions: SegmentCondition[] }) {
  const { t } = useT();
  if (conditions.length === 0) return <span className="text-xs text-slate-500">{t("segments.noConditions")}</span>;
  return (
    <div className="flex items-center gap-1 text-xs text-slate-500">
      <Filter className="w-3 h-3" />
      <span>{t("segments.conditionsCount", { count: conditions.length })}</span>
    </div>
  );
}

export default function SegmentsPage() {
  const { t } = useT();
  const toast = useAppToast();
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit" | "view">("list");
  const [editItem, setEditItem] = useState<CustomerSegment | null>(null);
  const [viewItem, setViewItem] = useState<CustomerSegment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [broadcastFor, setBroadcastFor] = useState<CustomerSegment | null>(null);

  // Backend'dan yuklash
  const reload = async () => {
    try {
      const res = await api<{ items: ApiSegment[] }>("/segments");
      setSegments(res.items.map(adaptSegment));
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return segments.filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }, [segments, search]);

  const stats = useMemo(() => {
    const activeCount = segments.filter((s) => s.active).length;
    const totalMembers = segments.reduce((sum, s) => sum + s.memberCount, 0);
    return { totalSegments: segments.length, activeCount, totalMembers };
  }, [segments]);

  if (pageMode === "view" && viewItem) {
    return <SegmentDetailView segment={viewItem} onBack={() => { setPageMode("list"); setViewItem(null); }} />;
  }

  const handleSave = async (data: Pick<CustomerSegment, "name" | "description" | "type" | "active">) => {
    if (!data.name.trim() || busy) return;
    setBusy(true);
    try {
      const body = {
        name: data.name.trim(),
        description: data.description ?? "",
        type: data.type.toUpperCase(),
        active: data.active,
      };
      if (editItem) {
        await api(`/segments/${editItem.id}`, { method: "PATCH", body });
      } else {
        await api("/segments", { method: "POST", body });
      }
      await reload();
      setPageMode("list");
      setEditItem(null);
      toast.success(t("segments.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("segments.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDelete(null);
    setBusy(true);
    try {
      await api(`/segments/${id}`, { method: "DELETE" });
      await reload();
      toast.success(t("segments.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("segments.deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleBroadcast = async (segment: CustomerSegment, text: string) => {
    setBroadcastFor(null);
    setBusy(true);
    try {
      const res = await api<{ sent: number; skipped: number; total: number }>(
        `/segments/${segment.id}/broadcast`,
        { method: "POST", body: { text } },
      );
      toast.success(t("segments.broadcastDone", { sent: res.sent, total: res.total, skipped: res.skipped }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("segments.broadcastFailed"));
    } finally {
      setBusy(false);
    }
  };

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-cream-300">
          <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="p-2 rounded-lg hover:bg-cream-100" aria-label={t("common.back")}><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-forest-800">{editItem ? t("segments.editTitle") : t("segments.createTitle")}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
            <button form="segment-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 text-forest-800 font-medium">{t("common.save")}</button>
          </div>
        </div>

        <SegmentForm initial={editItem} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-800">{t("segments.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("segments.subtitle")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("segments.stat.total")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalSegments}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("segments.stat.active")}</p>
            <p className="text-lg font-semibold text-forest-700">{stats.activeCount}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("segments.stat.members")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalMembers.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.search")} className={inputClass + " pl-10"} />
        </div>
        <button onClick={() => { setPageMode("create"); setEditItem(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-leaf-400 text-forest-800 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          {t("segments.new")}
        </button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-cream-300 bg-white/50 py-12 text-center text-slate-500">
            {loading ? t("common.loading") : t("segments.empty")}
          </div>
        ) : (
          filtered.map((segment) => (
            <motion.div key={segment.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-cream-300 bg-white/50 p-4 hover:bg-white/70 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-forest-800 truncate">{segment.name}</h3>
                    <SegmentTypeBadge type={segment.type} />
                    {!segment.active && <span className="text-xs px-2 py-1 rounded bg-cream-200/70 text-slate-500">{t("segments.inactive")}</span>}
                  </div>
                  <p className="text-sm text-slate-500 mb-3 line-clamp-2">{segment.description}</p>
                  <div className="flex flex-wrap gap-3 items-center text-xs text-slate-500">
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-cream-100">
                      <Users className="w-3.5 h-3.5" />
                      {t("segments.membersCount", { count: segment.memberCount.toLocaleString() })}
                    </div>
                    <ConditionsList conditions={segment.conditions} />
                    <span className="px-2 py-1 rounded bg-cream-100">{t("segments.createdAt", { date: segment.createdAt })}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setBroadcastFor(segment)}
                    disabled={segment.memberCount === 0}
                    className="p-2 rounded text-slate-500 hover:text-forest-700 hover:bg-cream-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={segment.memberCount === 0 ? t("segments.noMembers") : t("segments.sendBroadcast")}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setViewItem(segment); setPageMode("view"); }} className="p-2 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100" title={t("segments.view")}>
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditItem(segment); setPageMode("edit"); }} className="p-2 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100" title={t("common.edit")}>
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPendingDelete(segment.id)} className="p-2 rounded text-slate-500 hover:text-rose-600 hover:bg-cream-100" title={t("common.delete")}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={() => setPendingDelete(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border border-cream-300 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-forest-800 font-medium mb-2">{t("mkt.confirmDelete.title")}</p>
              <p className="text-sm text-slate-500 mb-6">{t("mkt.confirmDelete.body")}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
                <button onClick={() => handleDelete(pendingDelete)} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-forest-800 font-medium">{t("common.delete")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rassilka modali */}
      {broadcastFor && (
        <BroadcastModal
          segment={broadcastFor}
          busy={busy}
          onClose={() => setBroadcastFor(null)}
          onSend={(text) => handleBroadcast(broadcastFor, text)}
        />
      )}
    </div>
  );
}

function BroadcastModal({
  segment, busy, onClose, onSend,
}: {
  segment: CustomerSegment;
  busy: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const { t } = useT();
  const [text, setText] = useState("");
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
      <div className="bg-white border border-cream-300 rounded-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-forest-800 mb-1">{t("segments.broadcast")}</h3>
        <p className="text-xs text-slate-500 mb-4">
          {t("segments.segmentLabel")}: <span className="text-forest-800">{segment.name}</span> · <span className="text-forest-700">{t("segments.membersN", { count: segment.memberCount })}</span>
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={t("segments.broadcastPlaceholder")}
          className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 resize-none"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
          <button
            onClick={() => text.trim() && onSend(text.trim())}
            disabled={!text.trim() || busy}
            className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 disabled:opacity-50 text-forest-800 font-medium flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t("common.send")}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SegmentFormProps {
  initial: CustomerSegment | null;
  onSave: (data: Pick<CustomerSegment, "name" | "description" | "type" | "active">) => void;
}

function SegmentForm({ initial, onSave }: SegmentFormProps) {
  const { t } = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<SegmentType>(initial?.type ?? "automatic");
  const [active, setActive] = useState(initial?.active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, description, type, active });
  };

  return (
    <form id="segment-form" onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("segments.form.info")}</h3>
          <div>
            <label className={labelClass}>{t("segments.form.name")}</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("segments.form.namePlaceholder")} />
          </div>
          <div>
            <label className={labelClass}>{t("segments.form.description")}</label>
            <textarea className={inputClass + " min-h-[100px]"} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("segments.form.descriptionPlaceholder")} />
          </div>
          <div>
            <label className={labelClass}>{t("segments.form.type")}</label>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as SegmentType)}>
              <option value="automatic">{t("segments.type.automatic")}</option>
              <option value="smart">{t("segments.type.smart")}</option>
              <option value="manual">{t("segments.type.manual")}</option>
            </select>
            <p className="text-xs text-slate-500 mt-2">
              {type === "automatic" && t("segments.typeHint.automatic")}
              {type === "smart" && t("segments.typeHint.smart")}
              {type === "manual" && t("segments.typeHint.manual")}
            </p>
          </div>
        </div>

        {type !== "manual" && (
          <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
            <h3 className="font-semibold text-forest-800">{t("segments.form.conditions")}</h3>
            <p className="text-sm text-slate-500">{t("segments.form.conditionsHint")}</p>
            <div className="p-3 rounded-lg bg-cream-100/50 border border-cream-300 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <AlertCircle className="w-4 h-4 text-sky-600" />
                <span>{t("segments.form.conditionsNote")}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("segments.form.status")}</h3>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="sr-only" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <div className={`w-5 h-5 rounded border ${active ? "bg-emerald-600 border-emerald-500" : "border-slate-600"}`}>
              {active && <div className="w-full h-full flex items-center justify-center text-forest-800 text-xs">✓</div>}
            </div>
            <span className="text-sm text-slate-700">{t("segments.active")}</span>
          </label>
          <button type="submit" className="w-full mt-6 px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 text-forest-800 font-medium">{t("common.save")}</button>
        </div>
      </div>
    </form>
  );
}

function SegmentDetailView({ segment, onBack }: { segment: CustomerSegment; onBack: () => void }) {
  const { t } = useT();
  const segmentMembers = useMemo(
    () => customers.slice(0, segment.memberCount),
    [segment.memberCount]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 pb-4 border-b border-cream-300">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-cream-100"><ChevronLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-forest-800">{segment.name}</h1>
          <p className="text-sm text-slate-500 mt-1">{segment.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase mb-1">{t("segments.detail.type")}</p>
          <p className="text-sm font-semibold text-forest-800">{segmentTypeLabels[segment.type as SegmentType]}</p>
        </div>
        <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase mb-1">{t("segments.detail.members")}</p>
          <p className="text-sm font-semibold text-forest-800">{segment.memberCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase mb-1">{t("segments.detail.conditions")}</p>
          <p className="text-sm font-semibold text-forest-800">{segment.conditions.length}</p>
        </div>
        <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase mb-1">{t("segments.form.status")}</p>
          <div className="flex items-center gap-1">
            {segment.active ? <CheckCircle2 className="w-4 h-4 text-forest-700" /> : <AlertCircle className="w-4 h-4 text-slate-500" />}
            <span className="text-sm font-semibold">{segment.active ? t("segments.active") : t("segments.inactive")}</span>
          </div>
        </div>
      </div>

      {segment.conditions.length > 0 && (
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6">
          <h3 className="font-semibold text-forest-800 mb-4">{t("segments.detail.conditionsTitle")}</h3>
          <div className="space-y-2">
            {segment.conditions.map((cond) => (
              <div key={cond.id} className="flex items-center gap-3 p-3 rounded-lg bg-cream-100/50 border border-cream-300">
                <span className="text-sm font-medium text-slate-700">{segmentConditionFields[cond.field]}</span>
                <span className="text-xs px-2 py-1 rounded bg-cream-200 text-slate-700">{cond.operator}</span>
                <span className="text-sm text-slate-500">{String(cond.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-cream-300 bg-white/50 p-6">
        <h3 className="font-semibold text-forest-800 mb-4">{t("segments.detail.membersTitle", { count: segmentMembers.length })}</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {segmentMembers.slice(0, 10).map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-cream-100/50 border border-cream-300/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-forest-800 font-semibold text-sm">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-forest-800">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-slate-500">{member.phone}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-forest-700">{t("segments.ordersCount", { count: member.totalOrders })}</p>
                <p className="text-xs text-slate-500">{member.totalSpent.toLocaleString()} {t("segments.currency")}</p>
              </div>
            </div>
          ))}
          {segmentMembers.length > 10 && (
            <div className="text-center pt-4 border-t border-cream-300">
              <p className="text-xs text-slate-500">{t("segments.moreMembers", { count: segmentMembers.length - 10 })}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
