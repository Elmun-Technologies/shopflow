import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, ShoppingBag } from "lucide-react";
import { useAuth } from "../api/auth-context";

type Mode = "login" | "register";

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [name, setName] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password, tenantSlug || undefined);
      } else {
        await register({ tenantName, tenantSlug, email, password, name });
      }
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-8 shadow-xl"
      >
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-600/20 p-2">
              <ShoppingBag className="h-6 w-6 text-emerald-400" />
            </div>
            <span className="text-xl font-bold text-white">ShopFlow</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center">
          {mode === "login" ? "Kirish" : "Ro'yxatdan o'tish"}
        </h1>
        <p className="text-sm text-slate-400 text-center mt-1">
          {mode === "login"
            ? "Akkountingizga kiring"
            : "Yangi do'kon yarating va boshlang"}
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode === "register" && (
            <>
              <Field label="Do'kon nomi">
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  className="input"
                  placeholder="Mening do'konim"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                />
              </Field>
              <Field label="Sizning ismingiz">
                <input
                  required
                  minLength={2}
                  className="input"
                  placeholder="Aliev Salim"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </>
          )}

          <Field
            label={mode === "register" ? "Do'kon manzili (slug)" : "Do'kon manzili (ixtiyoriy)"}
            hint={mode === "register" ? "URL'da ko'rinadi: shopname.shopflow.uz" : "Bir nechta do'konda hisobingiz bo'lsa"}
          >
            <input
              required={mode === "register"}
              pattern="[a-z0-9]([a-z0-9-]{0,28}[a-z0-9])?"
              minLength={2}
              maxLength={30}
              className="input"
              placeholder="mendokon"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
            />
          </Field>

          <Field label="Email">
            <input
              required
              type="email"
              autoComplete="email"
              className="input"
              placeholder="siz@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Parol">
            <div className="relative">
              <input
                required
                minLength={8}
                type={showPw ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="input pr-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPw ? "Parolni yashirish" : "Parolni ko'rsatish"}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          {error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed py-2.5 font-medium text-white transition"
          >
            {loading
              ? "Yuborilmoqda…"
              : mode === "login"
                ? "Kirish"
                : "Ro'yxatdan o'tish"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          {mode === "login" ? (
            <>
              <span className="text-slate-400">Akkountingiz yo'qmi?</span>{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError(null);
                }}
                className="text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Ro'yxatdan o'ting
              </button>
            </>
          ) : (
            <>
              <span className="text-slate-400">Akkountingiz bormi?</span>{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Kiring
              </button>
            </>
          )}
        </div>
      </motion.div>

      <style>{`
        .input {
          width: 100%;
          background: rgb(15 23 42);
          border: 1px solid rgb(51 65 85);
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: rgb(16 185 129);
          box-shadow: 0 0 0 3px rgb(16 185 129 / 0.15);
        }
        .input::placeholder { color: rgb(100 116 139); }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-slate-300 mb-1.5">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] text-slate-500">{hint}</div>}
    </label>
  );
}

function extractMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const anyErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
    const msg = anyErr.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    if (typeof msg === "string") return msg;
    return anyErr.message ?? "Server bilan bog'lanishda xatolik";
  }
  return String(err);
}
