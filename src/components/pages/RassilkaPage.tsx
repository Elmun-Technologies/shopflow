import { useId, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Pencil, Trash2, ChevronLeft, Mail } from "lucide-react";
import type { EmailCampaign, EmailCampaignStatus } from "../../data/marketingData";
import { initialEmailCampaigns, emailCampaignStatusLabels } from "../../data/marketingData";
import EmptyState from "../EmptyState";
import { useT } from "../../i18n";

const inputClass = "w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2 text-sm text-forest-800 placeholder-slate-400 focus:outline-none focus:border-leaf-500/60 focus:ring-1 focus:ring-leaf-500/20";
const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";
const thClass = "text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3";
const tdClass = "py-3 px-3 text-sm text-forest-700 border-t border-cream-300";

function EmailStatusBadge({ status }: { status: EmailCampaignStatus }) {
  const map: Record<EmailCampaignStatus, string> = {
    draft: "bg-cream-200 text-slate-700",
    scheduled: "bg-sky-100 text-sky-600 border border-sky-300",
    sending: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
    sent: "bg-leaf-100 text-forest-700 border border-leaf-400/50",
    paused: "bg-orange-500/15 text-orange-600 border border-orange-500/30",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status]}`}>{emailCampaignStatusLabels[status]}</span>;
}

export default function RassilkaPage() {
  const { t } = useT();
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

  const handleSave = (data: Omit<EmailCampaign, "id" | "sent" | "opened" | "clicks" | "createdAt">) => {
    if (!data.name.trim()) {
      setFormError(t("rassilka.err.nameRequired"));
      return;
    }
    if (editItem) {
      setEmails((prev) => prev.map((e) => (e.id === editItem.id ? { ...editItem, ...data } : e)));
    } else {
      const newEmail: EmailCampaign = {
        id: `email-${Date.now()}`,
        sent: 0,
        opened: 0,
        clicks: 0,
        createdAt: new Date().toISOString(),
        ...data,
      };
      setEmails((prev) => [newEmail, ...prev]);
    }
    setPageMode("list");
    setEditItem(null);
    setFormError(null);
  };

  if (pageMode !== "list") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-cream-300">
          <button onClick={() => { setPageMode("list"); setEditItem(null); setFormError(null); }} className="p-2 rounded-lg hover:bg-cream-100" aria-label={t("common.back")}><ChevronLeft className="w-5 h-5" /></button>
          <h1 className="text-2xl font-bold text-forest-800">{editItem ? t("rassilka.edit") : t("rassilka.new")}</h1>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setPageMode("list"); setEditItem(null); }} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
            <button form="email-form" type="submit" className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-leaf-400 text-forest-800 font-medium">{t("common.save")}</button>
          </div>
        </div>

        <EmailForm initial={editItem} error={formError} onSave={handleSave} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest-800">{t("rassilka.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("rassilka.subtitle")}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("rassilka.stat.campaigns")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalCampaigns}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("rassilka.stat.sent")}</p>
            <p className="text-lg font-semibold text-forest-800">{stats.totalSent.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-white border border-cream-300 px-3 py-2">
            <p className="text-[10px] text-slate-500 uppercase">{t("rassilka.stat.openRate")}</p>
            <p className="text-lg font-semibold text-forest-700">{stats.openRate}%</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.search")} className={inputClass + " pl-10"} />
        </div>
        <button onClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-leaf-400 text-forest-800 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" />
          {t("rassilka.add")}
        </button>
      </div>

      {emails.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <EmptyState
            icon={Mail}
            title={t("rassilka.empty.title")}
            description={t("rassilka.empty.desc")}
            buttonText={t("rassilka.empty.btn")}
            onButtonClick={() => { setPageMode("create"); setEditItem(null); setFormError(null); }}
            iconColor="text-sky-600"
          />
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-cream-300 bg-white/50 overflow-hidden">
          <table className="w-full min-w-[800px]">
            <thead className="bg-white/80">
              <tr>
                <th className={thClass}>{t("rassilka.col.campaign")}</th>
                <th className={thClass}>{t("rassilka.col.segment")}</th>
                <th className={thClass}>{t("rassilka.col.status")}</th>
                <th className={thClass}>{t("rassilka.col.schedule")}</th>
                <th className={thClass}>{t("rassilka.col.sent")}</th>
                <th className={thClass}>{t("rassilka.col.opened")}</th>
                <th className={`${thClass} text-right`}>{t("rassilka.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-cream-100/40">
                  <td className={tdClass + " font-medium"}>{e.name}</td>
                  <td className={tdClass}>{e.segment}</td>
                  <td className={tdClass}><EmailStatusBadge status={e.status} /></td>
                  <td className={tdClass + " text-xs text-slate-500"}>{e.scheduledAt}</td>
                  <td className={tdClass}>{e.sent.toLocaleString()}</td>
                  <td className={tdClass + " text-xs"}>{e.sent > 0 ? ((e.opened / e.sent) * 100).toFixed(1) : "—"}%</td>
                  <td className={tdClass + " text-right whitespace-nowrap"}>
                    <button onClick={() => { setEditItem(e); setPageMode("edit"); }} className="p-1.5 rounded text-slate-500 hover:text-forest-900 hover:bg-cream-100"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => setPendingDelete(e.id)} className="p-1.5 rounded text-slate-500 hover:text-rose-600 hover:bg-cream-100"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="py-12 text-center text-slate-500 text-sm">{t("mkt.noData")}</div>}
        </motion.div>
      )}

      <AnimatePresence>
        {pendingDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70" onClick={() => setPendingDelete(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white border border-cream-300 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <p className="text-forest-800 font-medium mb-2">{t("mkt.confirmDelete.title")}</p>
              <p className="text-sm text-slate-500 mb-6">{t("mkt.confirmDelete.body")}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-sm text-slate-700 hover:bg-cream-100">{t("common.cancel")}</button>
                <button onClick={() => { setEmails((prev) => prev.filter((x) => x.id !== pendingDelete)); setPendingDelete(null); }} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-forest-800 font-medium">{t("common.delete")}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface EmailFormProps {
  initial: EmailCampaign | null;
  error: string | null;
  onSave: (data: Omit<EmailCampaign, "id" | "sent" | "opened" | "clicks" | "createdAt">) => void;
}

function EmailForm({ initial, error, onSave }: EmailFormProps) {
  const { t } = useT();
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [segment, setSegment] = useState(initial?.segment ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [status, setStatus] = useState<EmailCampaignStatus>(initial?.status ?? "draft");
  const [scheduledAt, setScheduledAt] = useState(initial?.scheduledAt ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, subject, segment, body, status, scheduledAt });
  };

  return (
    <form id="email-form" onSubmit={handleSubmit} className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("rassilka.form.campaignSettings")}</h3>
          <div>
            <label htmlFor={`${id}-name`} className={labelClass}>{t("rassilka.form.name")}</label>
            <input id={`${id}-name`} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-subject`} className={labelClass}>{t("rassilka.form.subject")}</label>
            <input id={`${id}-subject`} className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-segment`} className={labelClass}>{t("rassilka.col.segment")}</label>
            <input id={`${id}-segment`} className={inputClass} value={segment} onChange={(e) => setSegment(e.target.value)} />
          </div>
        </div>
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("rassilka.form.body")}</h3>
          <label htmlFor={`${id}-body`} className="sr-only">{t("rassilka.form.body")}</label>
          <textarea id={`${id}-body`} className={inputClass + " min-h-[150px]"} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-slate-500">{t("rassilka.form.charCount", { count: body.length })}</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-cream-300 bg-white/50 p-6 space-y-4">
          <h3 className="font-semibold text-forest-800">{t("rassilka.form.settings")}</h3>
          <div>
            <label htmlFor={`${id}-status`} className={labelClass}>{t("rassilka.col.status")}</label>
            <select id={`${id}-status`} className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as EmailCampaignStatus)}>
              {Object.entries(emailCampaignStatusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-schedule`} className={labelClass}>{t("rassilka.form.scheduleTime")}</label>
            <input id={`${id}-schedule`} className={inputClass} type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          {error && <div role="alert" className="rounded-lg border border-red-500/40 bg-rose-100 px-3 py-2 text-sm text-red-300">{error}</div>}
        </div>
      </div>
    </form>
  );
}
