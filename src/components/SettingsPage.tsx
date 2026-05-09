import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TelegramBotModal from "./TelegramBotModal";
import {
  User, Store, Bell, Shield, Key, Puzzle, Save, Eye, EyeOff,
  Send, CreditCard, Wallet, BarChart3, ShoppingBag, Calculator,
  Globe, CheckCircle2, XCircle, AlertCircle, Copy, Plus,
  Trash2, RefreshCw, Clock, Monitor, Smartphone, ChevronRight,
} from "lucide-react";
import {
  settingsTabOrder, settingsTabLabels,
  initialProfile, initialStore, initialNotifications,
  initialIntegrations, loginHistory, initialSecurity, initialApiKeys,
} from "../data/settingsData";
import type {
  SettingsTab, ProfileSettings, StoreSettings, NotificationGroup,
  Integration, SecuritySettings, ApiKey,
} from "../data/settingsData";

const integrationIconMap: Record<string, React.ElementType> = {
  Send, CreditCard, Wallet, BarChart3, Instagram: Globe, ShoppingBag, Calculator,
};

const statusConfig = {
  connected: { icon: CheckCircle2, label: "Ulangan", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  disconnected: { icon: XCircle, label: "Ulanmagan", color: "text-slate-500", bg: "bg-slate-500/10" },
  error: { icon: AlertCircle, label: "Xato", color: "text-red-400", bg: "bg-red-400/10" },
};

const deviceIcon: Record<string, React.ElementType> = {
  Chrome: Monitor, Safari: Smartphone, Firefox: Globe, Edge: Monitor,
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [profile, setProfile] = useState<ProfileSettings>({ ...initialProfile });
  const [store, setStore] = useState<StoreSettings>({ ...initialStore });
  const [notifications, setNotifications] = useState<NotificationGroup[]>(
    JSON.parse(JSON.stringify(initialNotifications))
  );
  const [integrations] = useState<Integration[]>(JSON.parse(JSON.stringify(initialIntegrations)));
  const [security, setSecurity] = useState<SecuritySettings>({ ...initialSecurity });
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(JSON.parse(JSON.stringify(initialApiKeys)));
  const [showPassword, setShowPassword] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);

  const handleSave = () => {
    setSavedMsg("Saqlandi!");
    setTimeout(() => setSavedMsg(""), 2000);
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

  const InputField = ({ label, value, onChange, type = "text" }: {
    label: string; value: string; onChange: (v: string) => void; type?: string;
  }) => (
    <div>
      <label className="text-xs text-slate-500 mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
      />
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
          {profile.avatar}
        </div>
        <div>
          <h3 className="text-white font-semibold">{profile.firstName} {profile.lastName}</h3>
          <p className="text-sm text-slate-500">{profile.role} · {profile.email}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="Ism" value={profile.firstName} onChange={(v) => setProfile({ ...profile, firstName: v })} />
        <InputField label="Familiya" value={profile.lastName} onChange={(v) => setProfile({ ...profile, lastName: v })} />
        <InputField label="Email" value={profile.email} onChange={(v) => setProfile({ ...profile, email: v })} type="email" />
        <InputField label="Telefon" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
        <InputField label="Vaqt mintaqasi" value={profile.timezone} onChange={(v) => setProfile({ ...profile, timezone: v })} />
        <InputField label="Til" value={profile.language} onChange={(v) => setProfile({ ...profile, language: v })} />
      </div>
    </div>
  );

  const renderStore = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-lg font-bold">
          {store.logo}
        </div>
        <div>
          <h3 className="text-white font-semibold">{store.name}</h3>
          <p className="text-xs text-slate-500">{store.city} · {store.currency}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="Do'kon nomi" value={store.name} onChange={(v) => setStore({ ...store, name: v })} />
        <InputField label="Shahar" value={store.city} onChange={(v) => setStore({ ...store, city: v })} />
        <div className="md:col-span-2">
          <InputField label="Tavsif" value={store.description} onChange={(v) => setStore({ ...store, description: v })} />
        </div>
        <div className="md:col-span-2">
          <InputField label="Manzil" value={store.address} onChange={(v) => setStore({ ...store, address: v })} />
        </div>
        <InputField label="Ish vaqti" value={store.workingHours} onChange={(v) => setStore({ ...store, workingHours: v })} />
        <InputField label="Valyuta" value={store.currency} onChange={(v) => setStore({ ...store, currency: v })} />
      </div>
      <div className="border-t border-slate-800 pt-4">
        <h4 className="text-sm font-semibold text-white mb-3">Yetkazib berish</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Min. buyurtma (so'm)</label>
            <input type="number" value={store.minOrderAmount} onChange={(e) => setStore({ ...store, minOrderAmount: +e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Yetkazish narxi (so'm)</label>
            <input type="number" value={store.deliveryFee} onChange={(e) => setStore({ ...store, deliveryFee: +e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Bepul yetkazish (dan)</label>
            <input type="number" value={store.freeDeliveryFrom} onChange={(e) => setStore({ ...store, freeDeliveryFrom: +e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr,60px,60px,60px] gap-2 pb-3 border-b border-slate-800 mb-2">
        <span className="text-xs text-slate-500 font-medium">Tur</span>
        <span className="text-xs text-slate-500 font-medium text-center">Email</span>
        <span className="text-xs text-slate-500 font-medium text-center">Push</span>
        <span className="text-xs text-slate-500 font-medium text-center">SMS</span>
      </div>
      {notifications.map((n) => (
        <div key={n.id} className="grid grid-cols-[1fr,60px,60px,60px] gap-2 py-3 border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors rounded-lg px-2">
          <div>
            <p className="text-sm text-white font-medium">{n.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{n.description}</p>
          </div>
          {(["email", "push", "sms"] as const).map((ch) => (
            <div key={ch} className="flex items-center justify-center">
              <button
                onClick={() => toggleNotification(n.id, ch)}
                className={`w-10 h-6 rounded-full transition-all relative ${n[ch] ? "bg-emerald-500" : "bg-slate-700"}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${n[ch] ? "left-5" : "left-1"}`} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const renderIntegrations = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {integrations.map((int) => {
        const Icon = integrationIconMap[int.icon] || Puzzle;
        const st = statusConfig[int.status];
        const StIcon = st.icon;
        return (
          <div key={int.id} className="bg-slate-800/50 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: int.color + "20" }}>
                  <Icon className="w-5 h-5" style={{ color: int.color }} />
                </div>
                <div>
                  <h4 className="text-sm text-white font-semibold">{int.name}</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">{int.description}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 text-xs ${st.color} ${st.bg} px-2.5 py-1 rounded-full`}>
                <StIcon className="w-3 h-3" />
                {st.label}
              </div>
              {int.connectedAt && (
                <span className="text-[10px] text-slate-600">{int.connectedAt}</span>
              )}
              <button
                onClick={() => { if (int.name === "Telegram Bot") setTelegramModalOpen(true); }}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  int.status === "connected" ? "text-slate-400 hover:text-white hover:bg-slate-700" :
                  int.status === "error" ? "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20" :
                  "text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20"
                }`}>
                {int.status === "connected" ? "Sozlash" : int.status === "error" ? "Tuzatish" : "Ulash"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      {/* 2FA */}
      <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm text-white font-semibold">Ikki bosqichli tasdiqlash (2FA)</h4>
            <p className="text-xs text-slate-500 mt-1">Qo'shimcha xavfsizlik darajasi</p>
          </div>
          <button
            onClick={() => setSecurity({ ...security, twoFactorEnabled: !security.twoFactorEnabled })}
            className={`w-12 h-7 rounded-full transition-all relative ${security.twoFactorEnabled ? "bg-emerald-500" : "bg-slate-700"}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${security.twoFactorEnabled ? "left-6" : "left-1"}`} />
          </button>
        </div>
        {security.twoFactorEnabled && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-400">Usul:</span>
            {(["sms", "app"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSecurity({ ...security, twoFactorMethod: m })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  security.twoFactorMethod === m ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {m === "sms" ? "SMS" : "Authenticator"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Password */}
      <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5">
        <h4 className="text-sm text-white font-semibold mb-1">Parol</h4>
        <p className="text-xs text-slate-500 mb-4">Oxirgi o'zgartirilgan: {security.lastPasswordChange}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <label className="text-xs text-slate-500 mb-1.5 block">Yangi parol</label>
            <input type={showPassword ? "text" : "password"} placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 pr-10" />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-slate-500 hover:text-white">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Tasdiqlash</label>
            <input type="password" placeholder="••••••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          </div>
        </div>
      </div>

      {/* Session */}
      <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-5">
        <h4 className="text-sm text-white font-semibold mb-1">Sessiya muddati</h4>
        <p className="text-xs text-slate-500 mb-3">Faoliyatsiz bo'lganda avtomatik chiqish</p>
        <div className="flex items-center gap-2">
          {[15, 30, 60, 120].map((m) => (
            <button
              key={m}
              onClick={() => setSecurity({ ...security, sessionTimeout: m })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                security.sessionTimeout === m ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {m} min
            </button>
          ))}
        </div>
      </div>

      {/* Login History */}
      <div>
        <h4 className="text-sm text-white font-semibold mb-3">Kirish tarixi</h4>
        <div className="space-y-2">
          {loginHistory.map((l) => {
            const browser = l.device.split(" — ")[0];
            const DevIcon = deviceIcon[browser] || Monitor;
            return (
              <div key={l.id} className="flex items-center justify-between bg-slate-800/50 border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 transition-colors">
                <div className="flex items-center gap-3">
                  <DevIcon className="w-4 h-4 text-slate-500" />
                  <div>
                    <p className="text-sm text-white">{l.device}</p>
                    <p className="text-[11px] text-slate-500">{l.location} · {l.ip}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium ${l.status === "success" ? "text-emerald-400" : "text-red-400"}`}>
                    {l.status === "success" ? "Muvaffaqiyatli" : "Rad etildi"}
                  </span>
                  <p className="text-[10px] text-slate-600 mt-0.5">{l.date}</p>
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
          <h4 className="text-sm text-white font-semibold">API kalitlari</h4>
          <p className="text-xs text-slate-500 mt-0.5">Tashqi xizmatlar uchun API kalitlar</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Yangi kalit
        </button>
      </div>
      {apiKeys.map((ak) => (
        <div key={ak.id} className={`bg-slate-800/50 border rounded-xl p-4 transition-all ${ak.active ? "border-slate-800 hover:border-slate-700" : "border-slate-800/50 opacity-60"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-white font-semibold">{ak.name}</span>
              {!ak.active && <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">O'chirilgan</span>}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => copyKey(ak.key, ak.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                title="Nusxa olish"
              >
                {copiedKey === ak.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setApiKeys((prev) => prev.map((k) => k.id === ak.id ? { ...k, active: !k.active } : k))}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="bg-slate-900 rounded-lg px-3 py-2 font-mono text-xs text-slate-400 mb-3">
            {maskKey(ak.key)}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {ak.permissions.map((p) => (
                <span key={p} className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">{p}</span>
              ))}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-600">
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
    notifications: renderNotifications,
    integrations: renderIntegrations,
    security: renderSecurity,
    api: renderApi,
  };

  const tabIcons: Record<SettingsTab, React.ElementType> = {
    profile: User, store: Store, notifications: Bell,
    integrations: Puzzle, security: Shield, api: Key,
  };

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Sozlamalar</h1>
          <p className="text-sm text-slate-500 mt-1">Profilingiz va do'kon sozlamalari</p>
        </div>
        <div className="flex items-center gap-2">
          {savedMsg && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-emerald-400 flex items-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {savedMsg}
            </motion.span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Save className="w-4 h-4" />
            Saqlash
          </button>
        </div>
      </motion.div>

      <div className="flex gap-6">
        {/* Tabs Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="w-56 flex-shrink-0"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-0.5 sticky top-20">
            {settingsTabOrder.map((tab) => {
              const Icon = tabIcons[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : ""}`} />
                  <span className="text-sm font-medium">{settingsTabLabels[tab]}</span>
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
              className="bg-slate-900 border border-slate-800 rounded-xl p-6"
            >
              <div className="mb-5 pb-4 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">{settingsTabLabels[activeTab]}</h2>
              </div>
              {tabRenderers[activeTab]()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <TelegramBotModal open={telegramModalOpen} onClose={() => setTelegramModalOpen(false)} />
    </>
  );
}
