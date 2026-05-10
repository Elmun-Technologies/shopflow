import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle2, AlertCircle, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { useNotifications } from "../lib/notifications";

type Provider = "moysklad" | "click" | "payme";

interface Props {
  provider: Provider;
  open: boolean;
  onClose: () => void;
}

const meta: Record<Provider, { title: string; description: string; docs: string; color: string }> = {
  moysklad: {
    title: "MoySklad",
    description: "Mahsulot katalogi va buyurtma sinxronizatsiyasi",
    docs: "https://my.moysklad.ru/app/#users",
    color: "#1a73e8",
  },
  click: {
    title: "Click",
    description: "Click orqali onlayn to'lov qabul qilish",
    docs: "https://merchant.click.uz/",
    color: "#00b5ad",
  },
  payme: {
    title: "Payme",
    description: "Payme orqali onlayn to'lov qabul qilish",
    docs: "https://merchant.paycom.uz/",
    color: "#3eaeff",
  },
};

export default function IntegrationModal({ provider, open, onClose }: Props) {
  const { toast } = useNotifications();
  const [list, setList] = useState<{ status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, provider]);

  async function refresh() {
    try {
      const all = await api.integrations.list();
      const found = all.find((i) => i.type === provider);
      setList(found ? { status: found.status } : null);
    } catch { /* */ }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${meta[provider].color}20` }}>
                  <span className="text-xl font-bold" style={{ color: meta[provider].color }}>{provider[0].toUpperCase()}</span>
                </div>
                <div>
                  <h2 className="text-white font-semibold">{meta[provider].title}</h2>
                  <p className="text-xs text-slate-500">{meta[provider].description}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              {list && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-sm text-emerald-300 flex items-center justify-between mb-4">
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Ulangan</span>
                  <button
                    disabled={loading}
                    onClick={async () => {
                      if (!confirm("Integration uziladi va ma'lumotlar o'chiriladi. Davom etamizmi?")) return;
                      setLoading(true);
                      try {
                        if (provider === "moysklad") await api.integrations.moysklad.disconnect();
                        if (provider === "click") await api.integrations.click.disconnect();
                        if (provider === "payme") await api.integrations.payme.disconnect();
                        toast({ kind: "success", title: "Uzildi" });
                        setList(null);
                      } catch (err) {
                        toast({ kind: "error", title: "Xato", description: err instanceof ApiError ? err.message : "" });
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Uzish
                  </button>
                </div>
              )}

              <a href={meta[provider].docs} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 mb-4">
                {meta[provider].title} kabinetiga o'tish <ExternalLink className="w-3 h-3" />
              </a>

              {provider === "moysklad" && (
                <MoyskladForm onError={setError} setLoading={setLoading} loading={loading} onSuccess={refresh} />
              )}
              {provider === "click" && (
                <ClickForm onError={setError} setLoading={setLoading} loading={loading} onSuccess={refresh} />
              )}
              {provider === "payme" && (
                <PaymeForm onError={setError} setLoading={setLoading} loading={loading} onSuccess={refresh} />
              )}

              {error && (
                <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MoyskladForm({ onError, setLoading, loading, onSuccess }: { onError: (e: string | null) => void; setLoading: (b: boolean) => void; loading: boolean; onSuccess: () => void }) {
  const { toast } = useNotifications();
  const [mode, setMode] = useState<"token" | "basic">("token");
  const [token, setToken] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ connected: boolean; lastSyncAt?: number | null; syncedProducts?: number } | null>(null);
  const [logs, setLogs] = useState<Array<{ id: number; entity: string; status: string; message: string | null; direction: string; createdAt: number }>>([]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const [s, l] = await Promise.all([
        api.integrations.moysklad.status(),
        api.integrations.moysklad.logs(10).catch(() => []),
      ]);
      setStatus(s);
      setLogs(l);
    } catch { /* */ }
  }

  async function connect() {
    onError(null);
    setLoading(true);
    try {
      mode === "token"
        ? await api.integrations.moysklad.connectToken(token)
        : await api.integrations.moysklad.connectBasic(login, password);
      toast({ kind: "success", title: "MoySklad ulandi", description: "Endi mahsulotlarni sinxronlashtirsangiz bo'ladi" });
      onSuccess();
      await refresh();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Xato");
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    setLoading(true);
    onError(null);
    try {
      const r = await api.integrations.moysklad.sync();
      toast({
        kind: "success",
        title: "Sinxronizatsiya tugadi",
        description: `+${r.imported} yangi, ${r.updated} yangilandi, stock ${r.stockUpdated} ta${r.errors > 0 ? `, ${r.errors} xato` : ""}`,
      });
      await refresh();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Xato");
    } finally {
      setLoading(false);
    }
  }

  async function syncStockNow() {
    setLoading(true);
    onError(null);
    try {
      const r = await api.integrations.moysklad.syncStock();
      toast({ kind: "success", title: "Stock yangilandi", description: `${r.updated} mahsulot` });
      await refresh();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Xato");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!status?.connected ? (
        <>
          <div className="flex gap-2">
            <button onClick={() => setMode("token")} className={`flex-1 py-2 rounded-lg text-sm ${mode === "token" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"}`}>Bearer token</button>
            <button onClick={() => setMode("basic")} className={`flex-1 py-2 rounded-lg text-sm ${mode === "basic" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"}`}>Login/parol</button>
          </div>

          {mode === "token" ? (
            <Field label="Bearer token">
              <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="abc123..." className={input} spellCheck={false} />
              <p className="text-[10px] text-slate-500 mt-1">MoySklad → Sozlamalar → API → Token yaratish</p>
            </Field>
          ) : (
            <>
              <Field label="Login (email)">
                <input value={login} onChange={(e) => setLogin(e.target.value)} className={input} />
              </Field>
              <Field label="Parol">
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
              </Field>
            </>
          )}

          <button onClick={connect} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Ulash va tekshirish
          </button>
        </>
      ) : (
        <>
          <div className="bg-slate-800/40 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Sinxronlangan mahsulotlar:</span>
              <span className="text-white font-semibold">{status.syncedProducts ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Oxirgi sync:</span>
              <span className="text-white">
                {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" }) : "Hech qachon"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Avto-sync:</span>
              <span className="text-emerald-400">✓ Yoqilgan (har 15 daqiqada)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={syncNow} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              To'liq sync
            </button>
            <button onClick={syncStockNow} disabled={loading} className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-1.5">
              📊 Faqat stock
            </button>
          </div>

          {logs.length > 0 && (
            <div className="bg-slate-800/40 rounded-lg p-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Sync tarixi</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {logs.map((l) => (
                  <div key={l.id} className="flex items-start gap-2 text-xs py-1">
                    <span className={`mt-0.5 ${l.status === "success" ? "text-emerald-400" : l.status === "error" ? "text-red-400" : "text-slate-500"}`}>
                      {l.status === "success" ? "✓" : l.status === "error" ? "✕" : "·"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-300 truncate">{l.message}</p>
                      <p className="text-[10px] text-slate-600">{l.entity} · {l.direction} · {new Date(l.createdAt).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClickForm({ onError, setLoading, loading, onSuccess }: { onError: (e: string | null) => void; setLoading: (b: boolean) => void; loading: boolean; onSuccess: () => void }) {
  const { toast } = useNotifications();
  const [merchantId, setMerchantId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [secretKey, setSecretKey] = useState("");

  async function save() {
    onError(null);
    setLoading(true);
    try {
      await api.integrations.click.connect({ merchantId, serviceId, secretKey });
      toast({ kind: "success", title: "Click ulandi" });
      onSuccess();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Xato");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Merchant ID"><input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className={input} /></Field>
      <Field label="Service ID"><input value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={input} /></Field>
      <Field label="Secret key"><input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} className={input} spellCheck={false} /></Field>
      <p className="text-xs text-slate-500">Merchant URL Click kabinetida: <code className="text-emerald-400">https://your-domain/api/payments/click/&#123;shopId&#125;</code></p>
      <button onClick={save} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
      </button>
    </div>
  );
}

function PaymeForm({ onError, setLoading, loading, onSuccess }: { onError: (e: string | null) => void; setLoading: (b: boolean) => void; loading: boolean; onSuccess: () => void }) {
  const { toast } = useNotifications();
  const [merchantId, setMerchantId] = useState("");
  const [merchantKey, setMerchantKey] = useState("");

  async function save() {
    onError(null);
    setLoading(true);
    try {
      await api.integrations.payme.connect({ merchantId, merchantKey });
      toast({ kind: "success", title: "Payme ulandi" });
      onSuccess();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Xato");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Merchant ID"><input value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className={input} /></Field>
      <Field label="Merchant key"><input type="password" value={merchantKey} onChange={(e) => setMerchantKey(e.target.value)} className={input} spellCheck={false} /></Field>
      <p className="text-xs text-slate-500">Endpoint Payme kabinetida: <code className="text-emerald-400">https://your-domain/api/payments/payme/&#123;shopId&#125;</code></p>
      <button onClick={save} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
      </button>
    </div>
  );
}

const input = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
