// Admin uchun brauzer notifikatsiya sozlamalari paneli.
// SettingsPage > Bildirishnomalar tab'i ichida ko'rsatiladi.
//
// Har voqea turi (Buyurtmalar / Lidlar / Chat) uchun ovoz + brauzer
// notification alohida yoqib o'chiriladi. Plyus ovoz turini tanlash
// va sinash tugmasi.

import { useEffect, useState } from "react";
import { Volume2, BellRing, Play, CheckCircle2, AlertTriangle } from "lucide-react";
import { loadNotifPrefs, saveNotifPrefs, type NotifPrefs, type SoundType } from "../utils/notifPrefs";
import { playSound, requestBrowserNotifPermission } from "../utils/notifSound";
import { useT } from "../i18n";

type EventKey = "orders" | "leads" | "chat";

const SOUND_OPTIONS: Array<{ value: SoundType; labelKey: string }> = [
  { value: "ding", labelKey: "notifSettings.sound.ding" },
  { value: "bell", labelKey: "notifSettings.sound.bell" },
  { value: "chime", labelKey: "notifSettings.sound.chime" },
];

const EVENTS: Array<{ key: EventKey; labelKey: string; descKey: string }> = [
  { key: "orders", labelKey: "notifSettings.event.orders", descKey: "notifSettings.event.ordersDesc" },
  { key: "leads", labelKey: "notifSettings.event.leads", descKey: "notifSettings.event.leadsDesc" },
  { key: "chat", labelKey: "notifSettings.event.chat", descKey: "notifSettings.event.chatDesc" },
];

export function BrowserNotifSection() {
  const { t } = useT();
  const [prefs, setPrefs] = useState<NotifPrefs>(() => loadNotifPrefs());
  const [permState, setPermState] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  // Boshqa tab'da o'zgartirilsa sync — kerak bo'lmasligi mumkin, lekin xavfsiz
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "shopflow.notifPrefs") setPrefs(loadNotifPrefs());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = (next: NotifPrefs) => {
    setPrefs(next);
    saveNotifPrefs(next);
  };

  const toggleEvent = (event: EventKey, channel: "sound" | "browser") => {
    update({
      ...prefs,
      [event]: { ...prefs[event], [channel]: !prefs[event][channel] },
    });
  };

  const setSoundType = (type: SoundType) => {
    update({ ...prefs, soundType: type });
    // Tanlangan ovozni darhol sinab ko'rsatish
    setTimeout(() => playSound(type), 100);
  };

  const handleRequestPermission = async () => {
    const perm = await requestBrowserNotifPermission();
    setPermState(perm);
  };

  return (
    <div className="space-y-4">
      {/* Sarlavha */}
      <div>
        <h3 className="text-sm font-semibold text-forest-800 flex items-center gap-2">
          <BellRing className="w-4 h-4 text-forest-700" />
          {t("notifSettings.title")}
        </h3>
        <p className="text-xs text-slate-500 mt-1">{t("notifSettings.subtitle")}</p>
      </div>

      {/* Browser permission status */}
      {permState !== "unsupported" && (
        <div className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${
          permState === "granted"
            ? "bg-leaf-100 border-leaf-400/50"
            : permState === "denied"
              ? "bg-rose-100 border-rose-300"
              : "bg-amber-100 border-amber-300"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {permState === "granted" ? (
              <CheckCircle2 className="w-4 h-4 text-forest-700 flex-shrink-0" />
            ) : (
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${permState === "denied" ? "text-rose-600" : "text-amber-500"}`} />
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-forest-800">
                {permState === "granted" ? t("notifSettings.perm.granted") : permState === "denied" ? t("notifSettings.perm.denied") : t("notifSettings.perm.default")}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {permState === "denied" ? t("notifSettings.perm.deniedHint") : t("notifSettings.perm.hint")}
              </p>
            </div>
          </div>
          {permState === "default" && (
            <button
              onClick={handleRequestPermission}
              className="px-3 py-1.5 text-xs font-medium bg-leaf-400 hover:bg-leaf-500 text-forest-800 rounded-lg flex-shrink-0"
            >
              {t("notifSettings.perm.enable")}
            </button>
          )}
        </div>
      )}

      {/* Voqea turlari jadval */}
      <div className="bg-cream-100/40 border border-cream-300 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr,70px,70px] gap-2 px-3 py-2 border-b border-cream-300 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          <span>{t("notifSettings.event")}</span>
          <span className="text-center">{t("notifSettings.sound")}</span>
          <span className="text-center">{t("notifSettings.browser")}</span>
        </div>
        {EVENTS.map((e) => (
          <div key={e.key} className="grid grid-cols-[1fr,70px,70px] gap-2 px-3 py-3 border-b border-cream-300/40 last:border-0 items-center">
            <div>
              <p className="text-sm text-forest-800 font-medium">{t(e.labelKey)}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{t(e.descKey)}</p>
            </div>
            <ToggleSwitch checked={prefs[e.key].sound} onChange={() => toggleEvent(e.key, "sound")} />
            <ToggleSwitch checked={prefs[e.key].browser} onChange={() => toggleEvent(e.key, "browser")} />
          </div>
        ))}
      </div>

      {/* Ovoz turi tanlash */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-forest-800 flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-slate-500" />
            {t("notifSettings.soundType")}
          </p>
          <button
            onClick={() => playSound(prefs.soundType)}
            className="flex items-center gap-1 text-xs text-forest-700 hover:text-forest-700 font-medium"
          >
            <Play className="w-3 h-3" />
            {t("notifSettings.testSound")}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SOUND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSoundType(opt.value)}
              className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                prefs.soundType === opt.value
                  ? "bg-leaf-100 border-leaf-400/60 text-forest-700"
                  : "bg-cream-100 border-cream-300 text-slate-700 hover:bg-cream-200"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-2">{t("notifSettings.soundTypeHint")}</p>
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-center">
      <button
        onClick={onChange}
        className={`w-10 h-6 rounded-full transition-all relative ${checked ? "bg-leaf-400" : "bg-cream-200"}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${checked ? "left-5" : "left-1"}`} />
      </button>
    </div>
  );
}
