import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, LogIn, UserPlus, AlertCircle, ShoppingBag } from "lucide-react";
import { api, ApiError, getToken, setToken } from "../lib/api";

interface Props {
  onAuthed: () => void;
}

export default function AuthGate({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const tok = getToken();
    if (!tok) {
      setChecking(false);
      return;
    }
    void api.me().then(() => onAuthed()).catch(() => {
      setToken(null);
      setChecking(false);
    });
  }, [onAuthed]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = mode === "login"
        ? await api.login({ email, password })
        : await api.register({ email, password, name, shopName });
      setToken(res.token);
      onAuthed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Xato yuz berdi");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ShopFlow</h1>
            <p className="text-xs text-slate-500">Telegram E-commerce platformasi</p>
          </div>
        </div>

        <div className="flex bg-slate-800/50 rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "login" ? "bg-emerald-600 text-white" : "text-slate-400"}`}
          >
            <LogIn className="w-4 h-4 inline mr-1" /> Kirish
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === "register" ? "bg-emerald-600 text-white" : "text-slate-400"}`}
          >
            <UserPlus className="w-4 h-4 inline mr-1" /> Ro'yxatdan o'tish
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              className={input}
              placeholder="admin@shopflow.uz"
            />
          </Field>

          {mode === "register" && (
            <>
              <Field label="Ismingiz">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className={input}
                />
              </Field>
              <Field label="Do'kon nomi">
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  required
                  className={input}
                  placeholder="Mening do'konim"
                />
              </Field>
            </>
          )}

          <Field label="Parol">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : 1}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={input}
              placeholder={mode === "register" ? "Kamida 8 belgi" : ""}
            />
          </Field>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          {mode === "login" ? "Hisobingiz yo'qmi? " : "Hisobingiz bormi? "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            className="text-emerald-400 hover:text-emerald-300"
          >
            {mode === "login" ? "Yaratish" : "Kirish"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

const input = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
