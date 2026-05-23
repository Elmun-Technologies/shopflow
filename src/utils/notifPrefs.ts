// Admin notification sozlamalari — har voqea turi uchun ovoz/browser
// notification yoqish/o'chirish va ovoz turini tanlash.
// localStorage'da saqlanadi, sahifa qayta yuklanganda saqlanib qoladi.

const PREFS_KEY = "shopflow.notifPrefs";

export type SoundType = "ding" | "bell" | "chime";

export interface EventPref {
  sound: boolean;
  browser: boolean;
}

export interface NotifPrefs {
  orders: EventPref;
  leads: EventPref;
  chat: EventPref;
  soundType: SoundType;
}

export const DEFAULT_PREFS: NotifPrefs = {
  orders: { sound: true, browser: true },
  leads: { sound: true, browser: false },
  chat: { sound: false, browser: false },
  soundType: "ding",
};

export function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
    // Eski default'larni yangi yo'qolib ketishi kerak emas — merge
    return {
      orders: { ...DEFAULT_PREFS.orders, ...parsed.orders },
      leads: { ...DEFAULT_PREFS.leads, ...parsed.leads },
      chat: { ...DEFAULT_PREFS.chat, ...parsed.chat },
      soundType: parsed.soundType ?? DEFAULT_PREFS.soundType,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveNotifPrefs(prefs: NotifPrefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}
