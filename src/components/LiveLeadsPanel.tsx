import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw, Plus, Search, Phone, Mail, Globe, Send, MessageCircle, MessageSquare, Camera, Users, ShoppingBag, FileText, X, Trash2, TrendingUp, AlertCircle } from "lucide-react";
import { api, ApiError, type AdminLead, type LeadSource, type LeadStatus, type LeadPriority } from "../lib/api";
import { useNotifications } from "../lib/notifications";

const sourceConfig: Record<LeadSource, { label: string; icon: React.ElementType; color: string }> = {
  telegram: { label: "Telegram bot", icon: Send, color: "#3b82f6" },
  miniapp: { label: "Mini App", icon: ShoppingBag, color: "#10b981" },
  web_form: { label: "Veb-sayt", icon: Globe, color: "#06b6d4" },
  instagram: { label: "Instagram", icon: Camera, color: "#ec4899" },
  facebook: { label: "Facebook", icon: Users, color: "#3b82f6" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "#25d366" },
  marketplace: { label: "Marketplace", icon: ShoppingBag, color: "#f59e0b" },
  landing_page: { label: "Landing", icon: FileText, color: "#a855f7" },
  email: { label: "Email", icon: Mail, color: "#64748b" },
  google_ads: { label: "Google Ads", icon: Globe, color: "#ef4444" },
  yandex_direct: { label: "Yandex", icon: Globe, color: "#fcc72c" },
  phone: { label: "Telefon", icon: Phone, color: "#10b981" },
  other: { label: "Boshqa", icon: MessageSquare, color: "#94a3b8" },
};

const statusConfig: Record<LeadStatus, { label: string; class: string }> = {
  new: { label: "Yangi", class: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  contacted: { label: "Bog'lanildi", class: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  qualified: { label: "Tasdiqlandi", class: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  converted: { label: "Mijozga aylantirildi", class: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  lost: { label: "Yo'qotildi", class: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const priorityConfig: Record<LeadPriority, { label: string; class: string }> = {
  low: { label: "Past", class: "text-slate-400" },
  medium: { label: "O'rta", class: "text-amber-400" },
  high: { label: "Yuqori", class: "text-red-400" },
};

export default function LiveLeadsPanel() {
  const { onShopEvent, toast } = useNotifications();
  const [list, setList] = useState<AdminLead[] | null>(null);
  const [stats, setStats] = useState<{ total: number; new: number; converted: number; conversionRate: number; wonValue: number; bySource: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "all">("all");
  const [active, setActive] = useState<AdminLead | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [leads, st] = await Promise.all([
        api.leads.list({ limit: 200 }),
        api.leads.stats(),
      ]);
      setList(leads);
      setStats(st);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Yuklab bo'lmadi");
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return onShopEvent((ev) => {
      // Yangi buyurtma kelsa, lead converted bo'lishi mumkin — yangilab olamiz
      if (ev.type === "order.created" || ev.type === "order.updated") void load();
    });
  }, [onShopEvent]);

  const filtered = useMemo(() => {
    if (!list) return [];
    const q = search.trim().toLowerCase();
    return list.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (q && !(l.name.toLowerCase().includes(q) || (l.phone ?? "").includes(q) || (l.email ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [list, search, statusFilter, sourceFilter]);

  async function updateLead(id: string, patch: Partial<AdminLead>) {
    try {
      const updated = await api.leads.update(id, patch);
      setList((prev) => prev ? prev.map((l) => l.id === id ? updated : l) : prev);
      if (active?.id === id) setActive(updated);
      toast({ kind: "success", title: "Yangilandi" });
      void load();
    } catch (err) {
      toast({ kind: "error", title: "Xato", description: err instanceof ApiError ? err.message : "" });
    }
  }

  async function removeLead(id: string) {
    if (!confirm("Lidni o'chirishga ishonchingiz komilmi?")) return;
    try {
      await api.leads.remove(id);
      setList((prev) => prev ? prev.filter((l) => l.id !== id) : prev);
      setActive(null);
      toast({ kind: "success", title: "O'chirildi" });
      void load();
    } catch (err) {
      toast({ kind: "error", title: "Xato", description: err instanceof ApiError ? err.message : "" });
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-white font-semibold">📡 Omnichannel lidlar (real)</h3>
            <p className="text-xs text-slate-500">Telegram, veb-sayt, Instagram, Facebook va boshqa manbalardan</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setCreating(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Yangi lid
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-6">
        <Stat label="Jami" value={stats?.total ?? 0} />
        <Stat label="Yangi" value={stats?.new ?? 0} accent="text-blue-400" />
        <Stat label="Aylantirildi" value={stats?.converted ?? 0} accent="text-emerald-400" />
        <Stat label="Konversiya" value={`${(stats?.conversionRate ?? 0).toFixed(1)}%`} accent="text-violet-400" />
        <Stat label="Tushum" value={`${(stats?.wonValue ?? 0).toLocaleString()} so'm`} accent="text-emerald-400" />
      </div>

      {/* Source breakdown */}
      {stats && Object.keys(stats.bySource).length > 0 && (
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {(Object.entries(stats.bySource) as Array<[LeadSource, number]>).map(([src, count]) => {
              const cfg = sourceConfig[src] ?? sourceConfig.other;
              const Icon = cfg.icon;
              return (
                <button
                  key={src}
                  onClick={() => setSourceFilter(src === sourceFilter ? "all" : src)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${sourceFilter === src ? "border-emerald-500/50 bg-emerald-500/10" : "border-slate-800 bg-slate-800/30 hover:bg-slate-800"}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: cfg.color }} />
                  <span className="text-xs text-slate-300 truncate flex-1 text-left">{cfg.label}</span>
                  <span className="text-xs font-semibold text-white">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-6 pb-4 flex flex-col sm:flex-row gap-3 border-t border-slate-800 pt-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ism, telefon, email bo'yicha qidirish..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "all")} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
          <option value="all">Barcha statuslar</option>
          {(Object.keys(statusConfig) as LeadStatus[]).map((s) => (
            <option key={s} value={s}>{statusConfig[s].label}</option>
          ))}
        </select>
      </div>

      {error && <div className="p-4 text-amber-400 text-sm">⚠️ {error}</div>}

      {loading && !list ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center">
          <TrendingUp className="w-12 h-12 mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 text-sm">{list?.length === 0 ? "Hali lid yo'q" : "Filtrga mos lid topilmadi"}</p>
          <p className="text-slate-600 text-xs mt-1">Telegram bot orqali kelgan har yangi mijoz avtomatik lid sifatida qo'shiladi</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">Lid</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Manba</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Status</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Qiymat</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-3">Prioritet</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">Sana</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((l) => {
                const src = sourceConfig[l.source] ?? sourceConfig.other;
                const SrcIcon = src.icon;
                const st = statusConfig[l.status];
                const pr = priorityConfig[l.priority];
                return (
                  <tr key={l.id} onClick={() => setActive(l)} className="border-t border-slate-800 hover:bg-slate-800/40 cursor-pointer">
                    <td className="py-3 px-6">
                      <p className="text-sm text-white font-medium">{l.name}</p>
                      <p className="text-xs text-slate-500">{l.phone ?? l.email ?? "—"}</p>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <SrcIcon className="w-3.5 h-3.5" style={{ color: src.color }} />
                        <span className="text-slate-300">{src.label}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block text-[10px] font-medium px-2 py-1 rounded-full border ${st.class}`}>{st.label}</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={l.value > 0 ? "text-emerald-400 font-semibold" : "text-slate-600"}>
                        {l.value > 0 ? `${l.value.toLocaleString()} so'm` : "—"}
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-xs font-medium ${pr.class}`}>{pr.label}</td>
                    <td className="py-3 px-6 text-xs text-slate-400 text-right whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleDateString("uz-UZ")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {active && <LeadDrawer lead={active} onClose={() => setActive(null)} onUpdate={(p) => updateLead(active.id, p)} onRemove={() => removeLead(active.id)} />}
        {creating && <LeadCreator onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void load(); }} />}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl bg-slate-800/50 border border-slate-800 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

function LeadDrawer({ lead, onClose, onUpdate, onRemove }: { lead: AdminLead; onClose: () => void; onUpdate: (p: Partial<AdminLead>) => void; onRemove: () => void }) {
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [value, setValue] = useState(lead.value);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-black/70 flex justify-end" onClick={onClose}>
      <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-900 border-l border-slate-800 overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase">Lid</p>
            <p className="text-white font-semibold">{lead.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status */}
          <div>
            <p className="text-xs text-slate-500 uppercase mb-2">Status</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(statusConfig) as LeadStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdate({ status: s })}
                  className={`text-xs px-3 py-2 rounded-lg border ${lead.status === s ? `${statusConfig[s].class} border-current` : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}
                >
                  {statusConfig[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <p className="text-xs text-slate-500 uppercase mb-2">Prioritet</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(priorityConfig) as LeadPriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => onUpdate({ priority: p })}
                  className={`text-xs px-3 py-2 rounded-lg border ${lead.priority === p ? "border-emerald-500/40 bg-emerald-500/10 " + priorityConfig[p].class : "border-slate-700 text-slate-400 hover:bg-slate-800"}`}
                >
                  {priorityConfig[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <p className="text-xs text-slate-500 uppercase">Aloqa</p>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-emerald-400">
                <Phone className="w-4 h-4 text-slate-500" /> {lead.phone}
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-emerald-400">
                <Mail className="w-4 h-4 text-slate-500" /> {lead.email}
              </a>
            )}
            {lead.company && <p className="text-sm text-slate-300">🏢 {lead.company}</p>}
            {!lead.phone && !lead.email && <p className="text-xs text-slate-600">Aloqa ma'lumotlari yo'q</p>}
          </div>

          {/* Value */}
          <div>
            <p className="text-xs text-slate-500 uppercase mb-2">Taxminiy qiymat</p>
            <div className="flex gap-2">
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              />
              <button onClick={() => onUpdate({ value })} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-2 rounded-lg">Saqlash</button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs text-slate-500 uppercase mb-2">Izoh</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => { if (notes !== (lead.notes ?? "")) onUpdate({ notes }); }}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
              placeholder="Lid haqida eslatma..."
            />
          </div>

          {/* Source info */}
          <div className="bg-slate-800/40 rounded-lg p-3 text-xs text-slate-400">
            <p>Manba: <span className="text-white">{sourceConfig[lead.source]?.label ?? lead.source}</span></p>
            <p className="mt-1">Yaratilgan: <span className="text-white">{new Date(lead.createdAt).toLocaleString("uz-UZ")}</span></p>
            {lead.tgUserId && <p className="mt-1 text-emerald-400">Telegram bilan bog'langan</p>}
            {lead.orderId && <p className="mt-1 text-emerald-400">✅ Buyurtma berilgan</p>}
          </div>

          <button onClick={onRemove} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm py-2.5 rounded-lg flex items-center justify-center gap-2">
            <Trash2 className="w-4 h-4" /> Lidni o'chirish
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LeadCreator({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useNotifications();
  const [source, setSource] = useState<LeadSource>("phone");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [value, setValue] = useState(0);
  const [priority, setPriority] = useState<LeadPriority>("medium");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    if (!name.trim()) { setError("Ism kerak"); return; }
    setSaving(true);
    try {
      await api.leads.create({ source, name, phone: phone || undefined, email: email || undefined, company: company || undefined, value, priority, notes: notes || undefined });
      toast({ kind: "success", title: "Lid qo'shildi" });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-white font-semibold">Yangi lid</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Manba *</label>
            <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              {(Object.keys(sourceConfig) as LeadSource[]).filter((s) => s !== "telegram" && s !== "miniapp").map((s) => (
                <option key={s} value={s}>{sourceConfig[s].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Ism *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Telefon</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Kompaniya</label>
            <input value={company} onChange={(e) => setCompany(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Qiymat (so'm)</label>
              <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Prioritet</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as LeadPriority)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                <option value="low">Past</option>
                <option value="medium">O'rta</option>
                <option value="high">Yuqori</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Izoh</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          </div>

          {error && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" /><span>{error}</span>
          </div>}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg">Bekor</button>
            <button onClick={save} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
