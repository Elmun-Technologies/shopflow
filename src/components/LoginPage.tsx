import { useState } from "react";
import { motion } from "framer-motion";
import { Store, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useT } from "../i18n";

export default function LoginPage() {
  const { login, register, error } = useAuth();
  const { t } = useT();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password, tenantSlug || undefined);
      } else {
        await register({ email, password, name, tenantName, tenantSlug });
      }
    } catch {
      // error AuthContext orqali ko'rsatiladi
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-leaf-400 rounded-2xl flex items-center justify-center mb-3">
            <Store className="w-7 h-7 text-forest-800" />
          </div>
          <h1 className="text-2xl font-bold text-forest-800">ShopFlow</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === "login" ? t("login.title.login") : t("login.title.register")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-cream-300 rounded-2xl p-6 space-y-4"
        >
          {mode === "register" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  {t("login.tenantName")}
                </label>
                <input
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-emerald-500"
                  placeholder={t("login.tenantNamePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  {t("login.yourName")}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              {t("login.tenantSlug")} {mode === "login" && <span className="text-slate-400">({t("common.optional")})</span>}
            </label>
            <input
              type="text"
              required={mode === "register"}
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="mening-dokonim"
              pattern="[a-z0-9-]+"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t("login.email")}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-emerald-500"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t("login.password")}</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-emerald-500"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-rose-100 border border-rose-300 rounded-lg">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 rounded-lg text-forest-800 text-sm font-medium transition-all"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "login" ? t("login.submit.login") : t("login.submit.register")}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="w-full text-center text-sm text-slate-500 hover:text-forest-900 transition-colors"
          >
            {mode === "login" ? t("login.switchToRegister") : t("login.switchToLogin")}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
