import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Mail } from "lucide-react";
import type { EmailCampaign, EmailCampaignStatus } from "../../data/marketingData";
import { initialEmailCampaigns, emailCampaignStatusLabels } from "../../data/marketingData";
import EmptyState from "../EmptyState";

const inputClass = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20";
const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-slate-200 border-t border-slate-800";

function EmailStatusBadge({ status }: { status: EmailCampaignStatus }) {
  const map: Record<EmailCampaignStatus, string> = {
    draft: "bg-slate-700 text-slate-300",
    scheduled: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    sending: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    sent: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    paused: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{emailCampaignStatusLabels[status]}</span>;
}

export default function RassilkaPage() {
  const [emails, setEmails] = useState<EmailCampaign[]>(initialEmailCampaigns);
  const [search, setSearch] = useState("");
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");
  const [editItem, setEditItem] = useState<EmailCampaign | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return emails.filter((e) => !q || e.name.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q));
  }, [emails, search]);

  const stats = useMemo(() => {
    const totalSent = emails.reduce((s, e) => s + e.sent, 0);
    const totalOpened = emails.reduce((s, e) => s + e.opened, 0);
    return {
      totalCampaigns: emails.length,
      totalSent,
      openRate: totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0",
    };
  }, [emails]);

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-slate-800"><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-white">{editItem ? "Email tahrirlash" : "Yangi email kampaniya"}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Bekor</button>
            <button className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium">Saqlash</button>
          </div>
        </div>

        <EmailForm initial={editItem} error={formError} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Email Rassilka</h1>
          <p className="text-sm text-slate-500 mt-1">Email kampaniyalarini boshqaring</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Kampaniyalar</p>
            <p className="text-lg font-semibold text-white">{stats.totalCampaigns}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Yuborilgan</p>
            <p className="text-lg font-semibold text-white">{stats.totalSent.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">Ochilish %</p>
            <p className="text-lg font-semibold text-emerald-400">{stats.openRate}%</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Qidirish..." className={inputClass + " pl-10"} />
        </div>
        <button onClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          Yangi qo'shish
        </button>
      </div>

      {emails.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <EmptyState
            icon={Mail}
            title="Email kampaniyasi yarating"
            description="Hali email kampaniyasi yaratilmagan. Xodimlarga xabar yuborish uchun birinchi kampaniyani yarating."
            buttonText="Yangi kampaniya"
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-blue-400"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-900/80">
              <tr>
                <th className={thClass}>Kampaniya</th>
                <th className={thClass}>Segment</th>
                <th className={thClass}>Holat</th>
                <th className={thClass}>Reja</th>
                <th className={thClass}>Yuborilgan</th>
                <th className={thClass}>Ochilish</th>
                <th className={`${thClass} text-right`}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-800/40">
                  <td className={tdClass + " font-medium"}>{e.name}</td>
                  <td className={tdClass}>{e.segment}</td>
                  <td className={tdClass}><EmailStatusBadge status={e.status} /></td>
                  <td className={tdClass + " text-xs text-slate-400"}>{e.scheduledAt}</td>
                  <td className={tdClass}>{e.sent.toLocaleString()}</td>
                  <td className={tdClass + " text-xs"}>{e.sent > 0 ? ((e.opened / e.sent) * 100).toFixed(1) : "—"}%</td>
                  <td className={tdClass + " text-right whitespace-nowrap"}>
                    <button onClick={() => { setEditItem(e); setPageMode("edit"); }} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(e.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
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
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-white font-medium mb-2">O'chirishni tasdiqlang</p>
              <p className="text-sm text-slate-400 mb-6">Bu amalni qaytarib bo'lmaydi.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800">Bekor</button>
                <button onClick={() => { setEmails((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white font-medium">O'chirish</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmailForm({ initial, error }: any) {
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [segment, setSegment] = useState(initial?.segment ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [status, setStatus] = useState<EmailCampaignStatus>(initial?.status ?? "draft");
  const [scheduledAt, setScheduledAt] = useState(initial?.scheduledAt ?? "");

  return (
    <form className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Kampaniya sozlamalari</h3>
          <div>
            <label className={labelClass}>Kampaniya nomi</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Email mavzusu</label>
            <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Segment</label>
            <input className={inputClass} value={segment} onChange={(e) => setSegment(e.target.value)} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Email matni</h3>
          <textarea className={inputClass + " min-h-[150px]"} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-slate-500">{body.length} belgi</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <h3 className="font-semibold text-white">Sozlamalar</h3>
          <div>
            <label className={labelClass}>Holat</label>
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as EmailCampaignStatus)}>
              {Object.entries(emailCampaignStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Reja vaqti</label>
            <input className={inputClass} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        </div>
      </div>
    </form>
  );
}
