/**
 * Telegram WebApp SDK minimal wrapper.
 * Telegram Mini App ichida `window.Telegram.WebApp` mavjud bo'ladi.
 * Brauzerda bo'sh stub qaytariladi (development uchun).
 */

interface TgWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  sendData: (data: string) => void;
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; username?: string } };
  themeParams: Record<string, string>;
  colorScheme: "light" | "dark";
  HapticFeedback: { impactOccurred: (style: "light" | "medium" | "heavy") => void };
  MainButton: {
    text: string;
    isVisible: boolean;
    setText: (t: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    enable: () => void;
    disable: () => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  showAlert: (msg: string, cb?: () => void) => void;
  showConfirm: (msg: string, cb: (ok: boolean) => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

function noop() { /* */ }
function noopFn<T>(_: T) { /* */ }

const stub: TgWebApp = {
  ready: noop,
  expand: noop,
  close: noop,
  sendData: noopFn,
  initData: "dev",
  initDataUnsafe: { user: { id: 1, first_name: "Dev", username: "dev_user" } },
  themeParams: {},
  colorScheme: "dark",
  HapticFeedback: { impactOccurred: noopFn },
  MainButton: {
    text: "",
    isVisible: false,
    setText: noopFn,
    show: noop,
    hide: noop,
    onClick: noopFn,
    offClick: noopFn,
    enable: noop,
    disable: noop,
  },
  BackButton: {
    show: noop,
    hide: noop,
    onClick: noopFn,
    offClick: noopFn,
  },
  showAlert: (m, cb) => { window.alert(m); cb?.(); },
  showConfirm: (m, cb) => { cb(window.confirm(m)); },
};

export const tg: TgWebApp = (typeof window !== "undefined" && window.Telegram?.WebApp) ? window.Telegram.WebApp : stub;

export function isInTelegram(): boolean {
  return typeof window !== "undefined" && !!window.Telegram?.WebApp;
}

export function getBotIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.pathname.match(/^\/mini\/([^/?#]+)/);
  return m?.[1] ?? null;
}
