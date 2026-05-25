import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Eye, EyeOff,
  Globe, CheckCircle2, AlertCircle, Copy, Plus,
  Trash2, RefreshCw, Clock, Monitor, Smartphone, ChevronRight, Loader2,
  Key, User, Store, Bell, Puzzle, Shield, Users,
} from "lucide-react";
import {
  settingsTabOrder,
  initialProfile, initialStore, initialNotifications,
  loginHistory, initialSecurity, initialApiKeys,
} from "../data/settingsData";
import type {
  SettingsTab, ProfileSettings, StoreSettings, NotificationGroup,
  SecuritySettings, ApiKey,
} from "../data/settingsData";
import { IntegrationsHub } from "./IntegrationsHub";
import { BrowserNotifSection } from "./BrowserNotifSection";
import { TeamSection } from "./TeamSection";
import { api } from "../api/client";
import { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useT } from "../i18n";

const deviceIcon: Record<string, React.ElementType> = {
  Chrome: Monitor, Safari: Smartphone, Firefox: Globe, Edge: Monitor,
};

function InputField({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60 transition-colors"
      />
    </label>
  );
}

export default function SettingsPage() {
  // useAuth() throw qiladi agar provider yo'q bo'lsa (test muhitida muammo).
  // useContext'ni to'g'ridan-to'g'ri ishlatib graceful fallback qilamiz.
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user ?? null;
  const tenant = authCtx?.tenant ?? null;
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [profile, setProfile] = useState<ProfileSettings>({ ...initialProfile });
  const [store, setStore] = useState<StoreSettings>({ ...initialStore });
  const [notifications, setNotifications] = useState<NotificationGroup[]>(
    JSON.parse(JSON.stringify(initialNotifications))
  );
  const [security, setSecurity] = useState<SecuritySettings>({ ...initialSecurity });
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(JSON.parse(JSON.stringify(initialApiKeys)));
  const [showPassword, setShowPassword] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Profile va tenant ma'lumotlarini auth context'dan to'ldiramiz
  useEffect(() => {
    if (user) {
      const parts = user.name.trim().split(/\s+/);
      setProfile((prev) => ({
        ...prev,
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" ") || "",
        email: user.email,
        role: user.role,
        avatar: (parts[0]?.[0] ?? "") + (parts.slice(1).join(" ")[0] ?? ""),
      }));
    }
    if (tenant) {
      setStore((prev) => ({
        ...prev,
        name: tenant.name,
        currency: tenant.currency,
        logo: tenant.name.slice(0, 2).toUpperCase(),
      }));
    }
  }, [user, tenant]);

  const flashSaved = (msg = "Saqlandi!") => {
    setSavedMsg(msg);
    setErrorMsg("");
    setTimeout(() => setSavedMsg(""), 2500);
  };
  const flashError = (msg: string) => {
    setErrorMsg(msg);
    setSavedMsg("");
    setTimeout(() => setErrorMsg(""), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (activeTab === "profile") {
        const fullName = `${profile.firstName} ${profile.lastName}`.trim();
        const body: Record<string, unknown> = {};
        if (fullName && fullName !== user?.name) body.name = fullName;
        if (profile.email && profile.email !== user?.email) body.email = profile.email;
        if (newPassword) {
          if (!currentPassword) {
            flashError("Joriy parolni kiriting");
            return;
          }
          body.currentPassword = currentPassword;
          body.newPassword = newPassword;
        }
        if (Object.keys(body).length === 0) {
          flashSaved("O'zgarishlar yo'q");
          return;
        }
        await api("/auth/me", { method: "PATCH", body });
        setCurrentPassword("");
        setNewPassword("");
        flashSaved("Profil saqlandi");
      } else if (activeTab === "store") {
        const body: Record<string, unknown> = {};
        if (store.name && store.name !== tenant?.name) body.name = store.name;
        if (store.currency && store.currency !== tenant?.currency) body.currency = store.currency;
        if (Object.keys(body).length === 0) {
          flashSaved("O'zgarishlar yo'q");
          return;
        }
        await api("/tenant", { method: "PATCH", body });
        flashSaved("Do'kon saqlandi");
      } else {
        flashSaved();
      }
    } catch (e) {
      flashError(e instanceof Error ? e.message : "Saqlanmadi");
    } finally {
      setSaving(false);
    }
  };

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const toggleNotification = (id: string, channel: "email" | "push" | "sms") => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [channel]: !n[channel] } : n))
    );
  };

  const maskKey = (key: string) => key.slice(0, 10) + "•".repeat(16) + key.slice(-4);

  const renderProfile = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-leaf-400 rounded-2xl flex items-center justify-center text-forest-800 text-xl font-bold">
          {profile.avatar}
        </div>
        <div>
          <h3 className="text-forest-800 font-semibold">{profile.firstName} {profile.lastName}</h3>
          <p className="text-sm text-slate-500">{profile.role} · {profile.email}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label={t("settings.profile.firstName")} value={profile.firstName} onChange={(v) => setProfile({ ...profile, firstName: v })} />
        <InputField label={t("settings.profile.lastName")} value={profile.lastName} onChange={(v) => setProfile({ ...profile, lastName: v })} />
        <InputField label={t("settings.profile.email")} value={profile.email} onChange={(v) => setProfile({ ...profile, email: v })} type="email" />
        <InputField label={t("settings.profile.phone")} value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
        <InputField label={t("settings.profile.timezone")} value={profile.timezone} onChange={(v) => setProfile({ ...profile, timezone: v })} />
        <InputField label={t("settings.profile.language")} value={profile.language} onChange={(v) => setProfile({ ...profile, language: v })} />
      </div>

      {/* Parolni o'zgartirish — Saqlash bosilganda yangi parol bo'lsa serverga jo'natiladi */}
      <div className="border-t border-cream-300 pt-6">
        <h4 className="text-sm font-semibold text-forest-800 mb-1">{t("settings.profile.changePassword")}</h4>
        <p className="text-xs text-slate-500 mb-3">{t("settings.profile.changePasswordHint")}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-slate-500 mb-1.5 block">{t("settings.profile.currentPassword")}</span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 pr-10 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-forest-900"
                aria-label={showPassword ? t("settings.profile.hide") : t("settings.profile.show")}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 mb-1.5 block">{t("settings.profile.newPassword")}</span>
            <input
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={8}
              className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60 transition-colors"
            />
          </label>
        </div>
      </div>
    </div>
  );

  const renderStore = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 bg-leaf-400 rounded-2xl flex items-center justify-center text-forest-800 text-lg font-bold">
          {store.logo}
        </div>
        <div>
          <h3 className="text-forest-800 font-semibold">{store.name}</h3>
          <p className="text-xs text-slate-500">{store.city} · {store.currency}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label={t("settings.store.name")} value={store.name} onChange={(v) => setStore({ ...store, name: v })} />
        <InputField label={t("settings.store.city")} value={store.city} onChange={(v) => setStore({ ...store, city: v })} />
        <div className="md:col-span-2">
          <InputField label={t("settings.store.description")} value={store.description} onChange={(v) => setStore({ ...store, description: v })} />
        </div>
        <div className="md:col-span-2">
          <InputField label={t("settings.store.address")} value={store.address} onChange={(v) => setStore({ ...store, address: v })} />
        </div>
        <InputField label={t("settings.store.workingHours")} value={store.workingHours} onChange={(v) => setStore({ ...store, workingHours: v })} />
        <InputField label={t("settings.store.currency")} value={store.currency} onChange={(v) => setStore({ ...store, currency: v })} />
      </div>
      <div className="border-t border-cream-300 pt-4">
        <h4 className="text-sm font-semibold text-forest-800 mb-3">{t("settings.store.delivery")}</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">{t("settings.store.minOrder")}</label>
            <input type="number" value={store.minOrderAmount} onChange={(e) => setStore({ ...store, minOrderAmount: +e.target.value })}
              className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">{t("settings.store.deliveryFee")}</label>
            <input type="number" value={store.deliveryFee} onChange={(e) => setStore({ ...store, deliveryFee: +e.target.value })}
              className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">{t("settings.store.freeDeliveryFrom")}</label>
            <input type="number" value={store.freeDeliveryFrom} onChange={(e) => setStore({ ...store, freeDeliveryFrom: +e.target.value })}
              className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      {/* Admin browser notifikatsiyalar — operator paneli uchun */}
      <BrowserNotifSection />

      {notifications.length > 0 && (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr,60px,60px,60px] gap-2 pb-3 border-b border-cream-300 mb-2">
            <span className="text-xs text-slate-500 font-medium">{t("settings.notify.type")}</span>
            <span className="text-xs text-slate-500 font-medium text-center">{t("settings.notify.email")}</span>
            <span className="text-xs text-slate-500 font-medium text-center">{t("settings.notify.push")}</span>
            <span className="text-xs text-slate-500 font-medium text-center">{t("settings.notify.sms")}</span>
          </div>
          {notifications.map((n) => (
            <div key={n.id} className="grid grid-cols-[1fr,60px,60px,60px] gap-2 py-3 border-b border-cream-300/50 hover:bg-cream-100/20 transition-colors rounded-lg px-2">
              <div>
                <p className="text-sm text-forest-800 font-medium">{n.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.description}</p>
              </div>
              {(["email", "push", "sms"] as const).map((ch) => (
                <div key={ch} className="flex items-center justify-center">
                  <button
                    onClick={() => toggleNotification(n.id, ch)}
                    className={`w-10 h-6 rounded-full transition-all relative ${n[ch] ? "bg-leaf-400" : "bg-cream-200"}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${n[ch] ? "left-5" : "left-1"}`} />
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderIntegrations = () => (
    <div>
      <IntegrationsHub />
    </div>
  );

  const renderTeam = () => (
    <TeamSection
      currentUserId={user?.id}
      currentUserRole={user?.role as "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | undefined}
    />
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      {/* 2FA */}
      <div className="bg-cream-100/50 border border-cream-300 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm text-forest-800 font-semibold">{t("settings.sec.2fa.title")}</h4>
            <p className="text-xs text-slate-500 mt-1">{t("settings.sec.2fa.hint")}</p>
          </div>
          <button
            onClick={() => setSecurity({ ...security, twoFactorEnabled: !security.twoFactorEnabled })}
            className={`w-12 h-7 rounded-full transition-all relative ${security.twoFactorEnabled ? "bg-leaf-400" : "bg-cream-200"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${security.twoFactorEnabled ? "left-6" : "left-1"}`} />
          </button>
        </div>
        {security.twoFactorEnabled && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-500">{t("settings.sec.2fa.method")}</span>
            {(["sms", "app"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSecurity({ ...security, twoFactorMethod: m })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  security.twoFactorMethod === m ? "bg-leaf-400 text-forest-800" : "bg-cream-100 text-slate-500 hover:text-forest-900"
                }`}
              >
                {m === "sms" ? "SMS" : "Authenticator"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Password */}
      <div className="bg-cream-100/50 border border-cream-300 rounded-xl p-5">
        <h4 className="text-sm text-forest-800 font-semibold mb-1">{t("settings.sec.password")}</h4>
        <p className="text-xs text-slate-500 mb-4">{t("settings.sec.lastChanged", { date: security.lastPasswordChange })}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <label className="text-xs text-slate-500 mb-1.5 block">{t("settings.sec.newPassword")}</label>
            <input type={showPassword ? "text" : "password"} placeholder="••••••••"
              className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60 pr-10" />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-slate-500 hover:text-forest-900">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">{t("settings.sec.confirmPassword")}</label>
            <input type="password" placeholder="••••••••"
              className="w-full bg-cream-100 border border-cream-300 rounded-lg px-3 py-2.5 text-sm text-forest-800 focus:outline-none focus:border-leaf-500/60" />
          </div>
        </div>
      </div>

      {/* Session */}
      <div className="bg-cream-100/50 border border-cream-300 rounded-xl p-5">
        <h4 className="text-sm text-forest-800 font-semibold mb-1">{t("settings.sec.session.title")}</h4>
        <p className="text-xs text-slate-500 mb-3">{t("settings.sec.session.hint")}</p>
        <div className="flex items-center gap-2">
          {[15, 30, 60, 120].map((m) => (
            <button
              key={m}
              onClick={() => setSecurity({ ...security, sessionTimeout: m })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                security.sessionTimeout === m ? "bg-leaf-400 text-forest-800" : "bg-cream-100 text-slate-500 hover:text-forest-900"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      {/* Login History */}
      <div>
        <h4 className="text-sm text-forest-800 font-semibold mb-3">{t("settings.sec.loginHistory")}</h4>
        <div className="space-y-2">
          {loginHistory.map((l) => {
            const browser = l.device.split(" — ")[0];
            const DevIcon = deviceIcon[browser] || Monitor;
            return (
              <div key={l.id} className="flex items-center justify-between bg-cream-100/50 border border-cream-300 rounded-xl px-4 py-3 hover:border-cream-300 transition-colors">
                <div className="flex items-center gap-3">
                  <DevIcon className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-sm text-forest-800">{l.device}</p>
                    <p className="text-[11px] text-slate-500">{l.location} · {l.ip}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium ${l.status === "success" ? "text-forest-700" : "text-rose-600"}`}>
                    {l.status === "success" ? t("settings.sec.loginSuccess") : t("settings.sec.loginFailed")}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5">{l.date}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderApi = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm text-forest-800 font-semibold">{t("settings.api.title")}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{t("settings.api.hint")}</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-leaf-400 hover:bg-leaf-500 text-forest-800 text-xs font-medium rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" />
          {t("settings.api.newKey")}
        </button>
      </div>
      {apiKeys.map((ak) => (
        <div key={ak.id} className={`bg-cream-100/50 border rounded-xl p-4 transition-all ${ak.active ? "border-cream-300 hover:border-cream-300" : "border-cream-300/50 opacity-60"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-forest-800 font-semibold">{ak.name}</span>
              {!ak.active && <span className="text-[10px] text-slate-400 bg-cream-100 px-2 py-0.5 rounded-full">{t("settings.api.disabled")}</span>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyKey(ak.key, ak.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-200 transition-colors"
                title={t("settings.api.copy")}
              >
                {copiedKey === ak.id ? <CheckCircle2 className="w-3.5 h-3.5 text-forest-700" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setApiKeys((prev) => prev.map((k) => k.id === ak.id ? { ...k, active: !k.active } : k))}
                className="p-1.5 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-200 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-100 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="bg-white rounded-lg px-3 py-2 font-mono text-xs text-slate-500 mb-3">
            {maskKey(ak.key)}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {ak.permissions.map((p) => (
                <span key={p} className="text-[10px] text-slate-500 bg-cream-100 px-2 py-0.5 rounded-md">{p}</span>
              ))}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <Clock className="w-3 h-3" />
              {ak.lastUsed}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const tabRenderers: Record<SettingsTab, () => React.ReactNode> = {
    profile: renderProfile,
    store: renderStore,
    team: renderTeam,
    notifications: renderNotifications,
    integrations: renderIntegrations,
    security: renderSecurity,
    api: renderApi,
  };

  const tabIcons: Record<SettingsTab, React.ElementType> = {
    profile: User, store: Store, team: Users, notifications: Bell,
    integrations: Puzzle, security: Shield, api: Key,
  };

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-forest-800">{t("settings.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("settings.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedMsg && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-forest-700 flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {savedMsg}
            </motion.span>
          )}
          {errorMsg && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-rose-600 flex items-center gap-1"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              {errorMsg}
            </motion.span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-leaf-400 hover:bg-leaf-500 disabled:opacity-50 text-forest-800 text-sm font-medium rounded-lg transition-colors shadow-lg shadow-leaf-500/20"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t("settings.save")}
          </button>
        </div>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Tabs — vertical on desktop, horizontal scroll on mobile */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="md:w-56 md:flex-shrink-0"
        >
          {/* Mobile — gorizontal pill row */}
          <div className="md:hidden flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-hide">
            {settingsTabOrder.map((tab) => {
              const Icon = tabIcons[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap text-xs font-medium transition-all flex-shrink-0 ${
                    isActive
                      ? "bg-leaf-400 text-forest-800"
                      : "bg-white border border-cream-300 text-slate-500"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t(`settings.tab.${tab}`)}
                </button>
              );
            })}
          </div>
          {/* Desktop — vertical sidebar */}
          <div className="hidden md:block bg-white border border-cream-300 rounded-xl p-2 space-y-0.5 sticky top-20">
            {settingsTabOrder.map((tab) => {
              const Icon = tabIcons[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    isActive
                      ? "bg-leaf-100 text-forest-700"
                      : "text-slate-500 hover:text-forest-900 hover:bg-cream-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-forest-700" : ""}`} />
                  <span className="text-sm font-medium">{t(`settings.tab.${tab}`)}</span>
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-cream-300 rounded-xl p-6"
            >
              <div className="mb-5 pb-4 border-b border-cream-300">
                <h2 className="text-lg font-bold text-forest-800">{t(`settings.tab.${activeTab}`)}</h2>
              </div>
              {tabRenderers[activeTab]()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
