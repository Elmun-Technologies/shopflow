import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Store, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { ApiError } from "../api/client";
import { useT } from "../i18n";

const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";
const GIS_SRC = "https://accounts.google.com/gsi/client";

interface TenantOption {
  slug: string;
  name: string;
}

export default function LoginPage() {
  const { login, loginWithGoogle, register, error } = useAuth();
  const { t } = useT();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Google multi-tenant (409) — kelgan credential'ni saqlab, tashkilot tanlatamiz
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const pendingCredential = useRef<string | null>(null);
  const [googleTenants, setGoogleTenants] = useState<TenantOption[] | null>(null);

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

  // Google bilan kirish — credential olib, backend'ga yuboramiz.
  // 409 (bir nechta tenant) bo'lsa — tashkilot tanlash ro'yxatini ko'rsatamiz.
  const submitGoogle = async (credential: string, slug?: string) => {
    setSubmitting(true);
    try {
      await loginWithGoogle(credential, slug);
      // Muvaffaqiyat — AuthContext user'ni o'rnatadi, App ilovaga o'tadi.
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const data = err.data as { tenants?: TenantOption[] } | undefined;
        if (data?.tenants?.length) {
          pendingCredential.current = credential;
          setGoogleTenants(data.tenants);
          return;
        }
      }
      // boshqa xatolar AuthContext.error orqali ko'rsatiladi
    } finally {
      setSubmitting(false);
    }
  };

  const handleTenantPick = (slug: string) => {
    const credential = pendingCredential.current;
    if (!credential) return;
    setGoogleTenants(null);
    void submitGoogle(credential, slug);
  };

  // Google Identity Services skriptini yuklash va tugmani render qilish
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    const renderButton = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          void submitGoogle(response.credential);
        },
      });
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    };

    if (window.google) {
      renderButton();
      return () => {
        cancelled = true;
      };
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const onLoad = () => renderButton();

    if (!script) {
      script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", onLoad);
      document.head.appendChild(script);
    } else {
      script.addEventListener("load", onLoad);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", onLoad);
    };
    // submitGoogle har renderda barqaror emas, lekin ref orqali ishlagani uchun
    // qayta-yuklamaymiz — faqat client id o'zgarsa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                  className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-leaf-500"
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
                  className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-leaf-500"
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
              className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-leaf-500"
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
              className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-leaf-500"
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
              className="w-full px-3 py-2.5 bg-cream-100 border border-cream-300 rounded-lg text-forest-800 text-sm focus:outline-none focus:border-leaf-500"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-100 border border-red-300 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
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

          {GOOGLE_CLIENT_ID && (
            <>
              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-cream-300" />
                <span className="text-xs text-slate-400 uppercase tracking-wide">
                  {t("auth.orContinue")}
                </span>
                <div className="h-px flex-1 bg-cream-300" />
              </div>

              {googleTenants ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">{t("auth.googleMultiTenant")}</p>
                  {googleTenants.map((tn) => (
                    <button
                      key={tn.slug}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleTenantPick(tn.slug)}
                      className="w-full flex items-center justify-between px-3 py-2.5 bg-cream-100 hover:bg-cream-200 disabled:opacity-50 border border-cream-300 rounded-lg text-forest-800 text-sm font-medium transition-colors"
                    >
                      <span>{tn.name}</span>
                      <span className="text-xs text-slate-400">{tn.slug}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center" aria-label={t("auth.googleSignIn")}>
                  <div ref={googleButtonRef} />
                </div>
              )}
            </>
          )}

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
