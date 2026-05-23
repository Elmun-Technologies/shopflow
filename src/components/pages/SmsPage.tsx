import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, MessageSquare } from "lucide-react";
import type { SmsCampaign, SmsCampaignStatus } from "../../data/marketingData";
import { initialSmsCampaigns, smsStatusLabels } from "../../data/marketingData";
import EmptyState from "../EmptyState";

const inputClass = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 focus:ring-1 focus:ring-leaf-500/20";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-forest-700 border-t border-cream-300";

function SmsStatusBadge({ status }: { status: SmsCampaignStatus }) {
  const map: Record<SmsCampaignStatus, string> = {
    draft: "bg-cream-200 text-slate-700",
    scheduled: "bg-sky-100 text-sky-600 border border-sky-300",
    sent: "bg-leaf-100 text-forest-700 border border-leaf-400/50",
    failed: "bg-red-500/15 text-rose-600 border border-rose-300",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{smsStatusLabels[status]}</span>;
}

export default function SmsPage() {
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>(initialSmsCampaigns);
  const [search, setSearch] = useState("");
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");
  const [editItem, setEditItem] = useState<SmsCampaign | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => !q || c.name.toLowerCase().includes(q) || c.message.toLowerCase().includes(q));
  }, [campaigns, search]);

  const stats = useMemo(() => {
    const totalSent = campaigns.reduce((s, c) => s + c.sent, 0);
    const totalDelivered = campaigns.reduce((s, c) => s + c.delivered, 0);
    const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : "0";
    return {
      totalCampaigns: campaigns.length,
      totalSent,
      deliveryRate,
    };
  }, [campaigns]);

  const handleSave = (data: Omit<SmsCampaign, "id" | "sent" | "delivered" | "createdAt">) => {
    if (!data.name.trim()) {
      setFormError("Kampaniya nomi bo'sh bo'lishi mumkin emas");
      return;
    }
    if (editItem) {
      setCampaigns((prev) => prev.map((c) => (c.id === editItem.id ? { ...editItem, ...data } : c)));
    } else {
      const newCampaign: SmsCampaign = {
        id: `sms-${Date.now()}`,
        sent: 0,
        delivered: 0,
        createdAt: new Date().toISOString(),
        ...data,
      };
      setCampaigns((prev) => [newCampaign, ...prev]);
    }
    setPageMode("list");
    setEditItem(null);
    setFormError(null);
  };

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-cream-300">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-cream-100" aria-label="Orqaga"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-forest-800">{editItem ? "SMS kampaniyani tahrirlash" : "Yangi SMS kampaniya"}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">Bekor</button>
            <button form="sms-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 text-forest-800 font-medium">Saqlash</button>
          </div>
        </div>

        <SmsForm initial={editItem} error={formError} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-800">SMS yuborish</h1>
          <p className="text-sm text-slate-500 mt-1">SMS kampaniyalarini boshqaring</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Kampaniyalar</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalCampaigns}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Yuborilgan</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalSent.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Yetkazilish %</p>
            <p className="text-lg font-semibold text-forest-700">{stats.deliveryRate}%</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish..." className={inputClass + " pl-10"} />
        </div>
        <button onClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-leaf-400 text-forest-800 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          Yangi kampaniya
        </button>
      </div>

      {campaigns.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <EmptyState
            icon={MessageSquare}
            title="SMS kampaniyasi yarating"
            description="Hali SMS kampaniyasi yaratilmagan. Xaridorlarga SMS yuborish uchun birinchi kampaniyani yarating."
            buttonText="Yangi kampaniya"
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-cyan-600"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <table className="w-full min-w-[800px]">
            <thead className="bg-white/80">
              <tr>
                <th className={thClass}>Kampaniya</th>
                <th className={thClass}>Segment</th>
                <th className={thClass}>Holat</th>
                <th className={thClass}>Obonachilar</th>
                <th className={thClass}>Yuborilgan</th>
                <th className={thClass}>Yetkazilgan</th>
                <th className={`${thClass} text-right`}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-cream-100/40">
                  <td className={tdClass + " font-medium"}>{c.name}</td>
                  <td className={tdClass}>{c.segment}</td>
                  <td className={tdClass}><SmsStatusBadge status={c.status} /></td>
                  <td className={tdClass}>{c.recipients.toLocaleString()}</td>
                  <td className={tdClass}>{c.sent.toLocaleString()}</td>
                  <td className={tdClass + " text-xs"}>{c.sent > 0 ? ((c.delivered / c.sent) * 100).toFixed(1) : "—"}%</td>
                  <td className={tdClass + " text-right whitespace-nowrap"}>
                    <button onClick={() => { setEditItem(c); setPageMode("edit"); }} className="p-1.5 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(c.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-cream-100"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">Ma'lumot topilmadi</div>}
        </motion.div>
      )}

      <AnimatePresence>
        {pendingDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={() => setPendingDelete(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border border-cream-300 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-forest-800 font-medium mb-2">O'chirishni tasdiqlang</p>
              <p className="text-sm text-slate-500 mb-6">Bu amalni qaytarib bo'lmaydi.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">Bekor</button>
                <button onClick={() => { setCampaigns((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-forest-800 font-medium">O'chirish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SmsFormProps {
  initial: SmsCampaign | null;
  error: string | null;
  onSave: (data: Omit<SmsCampaign, "id" | "sent" | "delivered" | "createdAt">) => void;
}

function SmsForm({ initial, error, onSave }: SmsFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [segment, setSegment] = useState(initial?.segment ?? "");
  const [recipients, setRecipients] = useState(initial?.recipients ?? 0);
  const [status, setStatus] = useState<SmsCampaignStatus>(initial?.status ?? "draft");
  const [scheduledAt, setScheduledAt] = useState(initial?.scheduledAt ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, message, segment, recipients, status, scheduledAt });
  };

  return (
    <form id="sms-form" onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">Kampaniya ma'lumotlari</h3>
          <div>
            <label className={labelClass}>Kampaniya nomi</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Segment</label>
            <input className={inputClass} value={segment} onChange={(e) => setSegment(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Obonachilar soni</label>
            <input type="number" className={inputClass} value={recipients} onChange={(e) => setRecipients(Number(e.target.value))} />
          </div>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">SMS matni</h3>
          <textarea className={inputClass + " min-h-[150px]"} value={message} onChange={(e) => setMessage(e.target.value)} />
          <p className="text-xs text-slate-500">{message.length} belgi</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">Sozlamalar</h3>
          <div>
            <label className={labelClass}>Holat</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as SmsCampaignStatus)}>
              <option value="draft">Qoralama</option>
              <option value="scheduled">Rejalashtirilgan</option>
              <option value="sent">Yuborilgan</option>
              <option value="failed">Xato</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Yuborish vaqti</label>
            <input className={inputClass} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          {error && <div className="rounded-lg border border-red-500/40 bg-rose-100 px-3 py-2 text-sm text-red-300">{error}</div>}
        </div>
      </div>
    </form>
  );
}
