import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Eye, Edit2, Trash2, ChevronLeft, Users, Filter, AlertCircle, CheckCircle2 } from "lucide-react";
import type { CustomerSegment, SegmentType, SegmentCondition } from "../../data/customersData";
import { initialSegments, segmentTypeLabels, segmentConditionFields, customers } from "../../data/customersData";

const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";

function SegmentTypeBadge({ type }: { type: SegmentType }) {
  const colors: Record<SegmentType, string> = {
    automatic: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    manual: "bg-slate-600 text-slate-200",
    smart: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border ${colors[type]}`}>
      {segmentTypeLabels[type]}
    </span>
  );
}

function ConditionsList({ conditions }: { conditions: SegmentCondition[] }) {
  if (conditions.length === 0) return <span className="text-xs text-slate-500">Shartlarsiz</span>;
  return (
    <div className="flex items-center gap-1 text-xs text-slate-400">
      <Filter className="w-3 h-3" />
      <span>{conditions.length} shart</span>
    </div>
  );
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<CustomerSegment[]>(initialSegments);
  const [search, setSearch] = useState("");
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit" | "view">("list");
  const [editItem, setEditItem] = useState<CustomerSegment | null>(null);
  const [viewItem, setViewItem] = useState<CustomerSegment | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="p-2 rounded-lg hover:bg-slate-800"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-white">{editItem ? "Segmentni tahrirlash" : "Yangi segment yaratish"}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Bekor</button>
            <button className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Saqlash</button>
          </div>
        </div>

        <SegmentForm initial={editItem} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Segmentlar</h1>
          <p className="text-sm text-slate-500 mt-1">Mijozlarni grupalari bo'yicha bo'ling va boshqaring</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Jami segmentlar</p>
            <p className="text-lg font-semibold text-white">{stats.totalSegments}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Faol</p>
            <p className="text-lg font-semibold text-emerald-400">{stats.activeCount}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Jami mijozlar</p>
            <p className="text-lg font-semibold text-white">{stats.totalMembers.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish..." className={inputClass + " pl-10"} />
        </div>
        <button onClick={() => { setPageMode("create"); setEditItem(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          Yangi segment
        </button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 py-12 text-center text-slate-500">Segmentlar topilmadi</div>
        ) : (
          filtered.map((segment) => (
            <motion.div key={segment.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:bg-slate-900/70 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white truncate">{segment.name}</h3>
                    <SegmentTypeBadge type={segment.type} />
                    {!segment.active && <span className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400">O'chiq</span>}
                  </div>
                  <p className="text-sm text-slate-400 mb-3 line-clamp-2">{segment.description}</p>
                  <div className="flex flex-wrap gap-3 items-center text-xs text-slate-400">
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800">
                      <Users className="w-3.5 h-3.5" />
                      {segment.memberCount.toLocaleString()} mijoz
                    </div>
                    <ConditionsList conditions={segment.conditions} />
                    <span className="px-2 py-1 rounded bg-slate-800">Yaratilgan: {segment.createdAt}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setViewItem(segment); setPageMode("view"); }} className="p-2 rounded text-slate-400 hover:text-white hover:bg-slate-800" title="Ko'rish">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setEditItem(segment); setPageMode("edit"); }} className="p-2 rounded text-slate-400 hover:text-white hover:bg-slate-800" title="Tahrirlash">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPendingDelete(segment.id)} className="p-2 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800" title="O'chirish">
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
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-white font-medium mb-2">O'chirishni tasdiqlang</p>
              <p className="text-sm text-slate-400 mb-6">Bu amalni qaytarib bo'lmaydi.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Bekor</button>
                <button onClick={() => { setSegments((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-medium">O'chirish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SegmentForm({ initial }: { initial: CustomerSegment | null }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<SegmentType>(initial?.type ?? "automatic");
  const [active, setActive] = useState(initial?.active ?? true);

  return (
    <form className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Segment ma'lumotlari</h3>
          <div>
            <label className={labelClass}>Segment nomi</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="masalan: VIP mijozlar" />
          </div>
          <div>
            <label className={labelClass}>Tavsifi</label>
            <textarea className={inputClass + " min-h-[100px]"} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bu segment qanday mijozlarni o'z ichiga oladi?" />
          </div>
          <div>
            <label className={labelClass}>Segment turi</label>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as SegmentType)}>
              <option value="automatic">Tizimli (avtomatik shartlar bilan)</option>
              <option value="smart">Aqlli (o'zgaruvchan shartlar)</option>
              <option value="manual">Qo'lda (qo'lda tanlangan mijozlar)</option>
            </select>
            <p className="text-xs text-slate-400 mt-2">
              {type === "automatic" && "Tizimli segmentlar belgilangan shartlarga asosan avtomatik yangilanadi"}
              {type === "smart" && "Aqlli segmentlar dinamik shartlar bilan real vaqtda yangilanadi"}
              {type === "manual" && "Qo'lda segmentlar administratorlar tomonidan boshqariladi"}
            </p>
          </div>
        </div>

        {type !== "manual" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
            <h3 className="font-semibold text-white">Shartlar</h3>
            <p className="text-sm text-slate-400">Shartlar qo'shish uchun tahrirlashni bosing va ularni sozlang</p>
            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <AlertCircle className="w-4 h-4 text-blue-400" />
                <span>Shartlar tahrirlash formasisida ko'rsatiladi</span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Holat</h3>
          <label className="flex items-center gap-3 cursor-pointer" onClick={() => setActive((v) => !v)}>
            <div className={`w-5 h-5 rounded border ${active ? "bg-emerald-600 border-emerald-500" : "border-slate-600"}`}>
              {active && <div className="w-full h-full flex items-center justify-center text-white text-xs">✓</div>}
            </div>
            <span className="text-sm text-slate-300">Faol</span>
          </label>
          <button className="w-full mt-6 px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Saqlash</button>
        </div>
      </div>
    </form>
  );
}

function SegmentDetailView({ segment, onBack }: { segment: CustomerSegment; onBack: () => void }) {
  const segmentMembers = customers.filter(() => Math.random() > 0.5).slice(0, segment.memberCount);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-800"><ChevronLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-white">{segment.name}</h1>
          <p className="text-sm text-slate-400 mt-1">{segment.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Turi</p>
          <p className="text-sm font-semibold text-white">{segmentTypeLabels[segment.type as SegmentType]}</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Mijozlar</p>
          <p className="text-sm font-semibold text-white">{segment.memberCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Shartlar</p>
          <p className="text-sm font-semibold text-white">{segment.conditions.length}</p>
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
          <p className="text-[10px] text-slate-500 uppercase mb-1">Holat</p>
          <div className="flex items-center gap-1">
            {segment.active ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-slate-400" />}
            <span className="text-sm font-semibold">{segment.active ? "Faol" : "O'chiq"}</span>
          </div>
        </div>
      </div>

      {segment.conditions.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="font-semibold text-white mb-4">Segmentlash shartlari</h3>
          <div className="space-y-2">
            {segment.conditions.map((cond) => (
              <div key={cond.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <span className="text-sm font-medium text-slate-300">{segmentConditionFields[cond.field]}</span>
                <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">{cond.operator}</span>
                <span className="text-sm text-slate-400">{String(cond.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="font-semibold text-white mb-4">Segmentdagi mijozlar ({segmentMembers.length})</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {segmentMembers.slice(0, 10).map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-slate-400">{member.phone}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-emerald-400">{member.totalOrders} buyurtma</p>
                <p className="text-xs text-slate-400">{member.totalSpent.toLocaleString()} so'm</p>
              </div>
            </div>
          ))}
          {segmentMembers.length > 10 && (
            <div className="text-center pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-400">+{segmentMembers.length - 10} ta boshqa mijoz</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
