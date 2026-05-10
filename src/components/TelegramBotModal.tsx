import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, CheckCircle2, AlertCircle, Loader2, ExternalLink, Trash2, Sparkles } from "lucide-react";
import { api, ApiError } from "../lib/api";
import BotUiEditor from "./BotUiEditor";

interface BotRow {
  id: string;
  username: string | null;
  status: string;
  lastError: string | null;
  miniappUrl: string | null;
}

export default function TelegramBotModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [token, setToken] = useState("");
  const [bots, setBots] = useState<BotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editorBotId, setEditorBotId] = useState<string | null>(null);

  // Bot ro'yxatini yuklash + URL'siz botlar uchun avtomatik fonda refresh
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const list = await api.bots.list();
        if (cancelled) return;
        setBots(list);
        // Background: URL'siz botlar uchun avtomatik refresh (mijoz ko'rmaydi)
        const stale = list.filter((b) => !b.miniappUrl);
        if (stale.length > 0) {
          await Promise.allSettled(stale.map((b) => api.bots.refreshMiniapp(b.id)));
          if (cancelled) return;
          // Qayta yuklash
          const updated = await api.bots.list();
          if (!cancelled) setBots(updated);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Yuklab bo'lmadi");
      }
    })();
    return () => { cancelled = true; };
  }, [open, refreshKey]);

  async function handleConnect() {
    setError(null);
    setSuccess(null);
    if (!token.trim()) { setError("Tokenni kiriting"); return; }
    setLoading(true);
    try {
      const result = await api.bots.connect(token.trim());
      setSuccess(`✅ @${result.username} muvaffaqiyatli ulandi va do'kon ishga tushdi.`);
      setToken("");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xato yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect(id: string) {
    if (!confirm("Botni o'chirishga ishonchingiz komilmi?")) return;
    setLoading(true);
    try {
      await api.bots.disconnect(id);
      setSuccess("Bot uzildi");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "O'chirib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0088cc]/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-[#0088cc]" />
                </div>
                <div>
                  <h2 className="text-white font-semibold">Telegram Bot</h2>
                  <p className="text-xs text-slate-500">BotFather'dan token oling va shu yerga yopishtiring</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div className="rounded-xl bg-slate-800/40 border border-slate-800 p-4 text-xs text-slate-400 space-y-2">
                <p className="text-slate-300 font-medium">Bot tokenini qanday olish:</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Telegramda <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline inline-flex items-center gap-1">@BotFather <ExternalLink className="w-3 h-3" /></a> ga o'ting</li>
                  <li><code className="text-emerald-300">/newbot</code> buyrug'ini yuboring</li>
                  <li>Bot nomini va @username ni kiriting</li>
                  <li>Olingan tokenni shu yerga yopishtiring</li>
                </ol>
                <p className="text-slate-500 pt-1">Qolgani avtomatik — Mini App, do'kon, to'lov va hokazo o'zi ishga tushadi.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Bot tokeni</label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="123456789:ABCDEFghijklmnop_qrstuvwxyz1234567890"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 font-mono focus:outline-none focus:border-emerald-500/50"
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Ulash va do'konni ishga tushirish
              </button>

              {bots.length > 0 && (
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ulangan botlar</p>
                  {bots.map((b) => {
                    const isReady = b.status === "active" && !!b.miniappUrl;
                    const hasError = b.status === "error";
                    return (
                      <div key={b.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${isReady ? "bg-emerald-500" : hasError ? "bg-red-500" : "bg-amber-500"}`} />
                          <div>
                            <p className="text-sm text-white">@{b.username ?? "no_username"}</p>
                            <p className={`text-[11px] ${isReady ? "text-emerald-400" : hasError ? "text-red-400" : "text-amber-400"}`}>
                              {isReady && "Do'kon ishlamoqda"}
                              {hasError && (b.lastError || "Xato")}
                              {!isReady && !hasError && "Sozlanmoqda…"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditorBotId(b.id)}
                            className="p-1.5 rounded text-purple-400 hover:bg-slate-800"
                            title="Do'kon ko'rinishini sozlash"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDisconnect(b.id)}
                            disabled={loading}
                            className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800"
                            title="Uzish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
      {editorBotId && (
        <BotUiEditor botId={editorBotId} open={!!editorBotId} onClose={() => setEditorBotId(null)} />
      )}
    </AnimatePresence>
  );
}
