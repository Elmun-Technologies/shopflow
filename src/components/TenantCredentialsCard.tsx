import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Save, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { useAppToast } from "./ui/Toast";

type Credential = { key: string; category: string; label: string; secret: boolean; configured: boolean; value: string | null; maskedValue: string | null; updatedAt: string | null };
const categoryLabel: Record<string, string> = { maps: "Xarita va logistika", ai: "Sun’iy intellekt", sms: "SMS", email: "Email / SMTP" };

export function TenantCredentialsCard() {
  const toast = useAppToast();
  const [items, setItems] = useState<Credential[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(true);
  const load = async () => {
    try { const rows = await api<Credential[]>("/tenant-secrets"); setItems(rows); setDrafts(Object.fromEntries(rows.filter((row) => !row.secret && row.value != null).map((row) => [row.key, row.value!] as const))); }
    catch { setAllowed(false); }
  };
  useEffect(() => { void load(); }, []);
  const groups = useMemo(() => Object.entries(items.reduce<Record<string, Credential[]>>((all, item) => { (all[item.category] ??= []).push(item); return all; }, {})), [items]);
  if (!allowed) return null;

  const save = async (item: Credential) => {
    const value = drafts[item.key]?.trim(); if (!value) return toast.error("Qiymatni kiriting"); setBusy(item.key);
    try { await api(`/tenant-secrets/${item.key}`, { method: "PUT", body: { value } }); if (item.secret) setDrafts((old) => ({ ...old, [item.key]: "" })); await load(); toast.success(`${item.label} saqlandi`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Kalit saqlanmadi"); }
    finally { setBusy(null); }
  };
  const remove = async (item: Credential) => {
    if (!window.confirm(`${item.label} kalitini o‘chirasizmi?`)) return; setBusy(item.key);
    try { await api(`/tenant-secrets/${item.key}`, { method: "DELETE" }); setDrafts((old) => ({ ...old, [item.key]: "" })); await load(); toast.success("Kalit o‘chirildi"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Kalit o‘chirilmadi"); }
    finally { setBusy(null); }
  };

  return <section className="rounded-2xl border border-cream-300 bg-white overflow-hidden">
    <div className="p-5 border-b border-cream-200 bg-gradient-to-r from-forest-50 to-white"><h3 className="font-semibold text-forest-800 flex items-center gap-2"><KeyRound className="w-5 h-5" /> Tenant kalitlari va credential’lar</h3><p className="text-xs text-slate-500 mt-1">Har bir tashkilot o‘z kalitlarini boshqaradi. Maxfiy qiymatlar shifrlanadi va qayta ko‘rsatilmaydi.</p></div>
    <div className="p-5 space-y-6">{groups.map(([category, rows]) => <div key={category}><h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{categoryLabel[category] ?? category}</h4><div className="divide-y divide-cream-200 border border-cream-200 rounded-xl">{(rows ?? []).map((item) => <div key={item.key} className="p-3 grid md:grid-cols-[minmax(150px,1fr)_minmax(220px,2fr)_auto] items-center gap-3"><div><p className="text-sm font-medium text-forest-800">{item.label}</p><p className="text-[10px] text-slate-400 font-mono">{item.key}</p></div><div className="relative"><input type={item.secret ? "password" : "text"} value={drafts[item.key] ?? ""} onChange={(e) => setDrafts((old) => ({ ...old, [item.key]: e.target.value }))} placeholder={item.configured && item.secret ? "•••••••• — almashtirish uchun yangi qiymat" : "Qiymat kiriting"} className="input w-full pr-9" />{item.configured && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />}</div><div className="flex gap-1"><button disabled={busy === item.key || !drafts[item.key]?.trim()} onClick={() => void save(item)} title="Saqlash" className="p-2 rounded-lg bg-forest-700 text-white disabled:opacity-40">{busy === item.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}</button>{item.configured && <button disabled={busy === item.key} onClick={() => void remove(item)} title="O‘chirish" className="p-2 rounded-lg bg-rose-50 text-rose-600"><Trash2 className="w-4 h-4" /></button>}</div></div>)}</div></div>)}</div>
  </section>;
}
