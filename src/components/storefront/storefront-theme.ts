// Telegram Mini App theme integratsiyasi.
// Telegram WebApp.themeParams qiymatlarini CSS variable'lar sifatida joriy etadi
// va brand.primaryColor'ni hamma joyda ishlatish uchun export qiladi.

export interface ThemeColors {
  bg: string;
  bgSecondary: string;
  text: string;
  textSecondary: string;
  hint: string;
  primary: string;
  primaryText: string;
  border: string;
  isDark: boolean;
}

export function applyTelegramTheme(brandPrimary: string | undefined): ThemeColors {
  const twa = window.Telegram?.WebApp;
  const tp = twa?.themeParams ?? {};
  const colorScheme = (twa as { colorScheme?: "light" | "dark" } | undefined)?.colorScheme;

  // Telegram light/dark sxemasini aniqlaymiz
  const isDark = colorScheme === "dark" || (tp.bg_color ? isDarkHex(tp.bg_color) : true);

  const bg = tp.bg_color ?? (isDark ? "#0f172a" : "#ffffff");
  const bgSecondary = isDark ? darken(bg, 0.4) : lighten(bg, 0.02);
  const text = tp.text_color ?? (isDark ? "#f1f5f9" : "#0f172a");
  const textSecondary = tp.hint_color ?? (isDark ? "#94a3b8" : "#64748b");
  const hint = tp.hint_color ?? (isDark ? "#64748b" : "#94a3b8");
  const primary = brandPrimary || tp.button_color || "#10b981";
  const primaryText = tp.button_text_color ?? "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  // CSS variable'larni html'ga joylaymiz, kerakli component'lar shu orqali oladi
  const root = document.documentElement;
  root.style.setProperty("--tg-bg", bg);
  root.style.setProperty("--tg-bg-secondary", bgSecondary);
  root.style.setProperty("--tg-text", text);
  root.style.setProperty("--tg-text-secondary", textSecondary);
  root.style.setProperty("--tg-hint", hint);
  root.style.setProperty("--tg-primary", primary);
  root.style.setProperty("--tg-primary-text", primaryText);
  root.style.setProperty("--tg-border", border);
  root.classList.toggle("tg-dark", isDark);
  root.classList.toggle("tg-light", !isDark);

  return { bg, bgSecondary, text, textSecondary, hint, primary, primaryText, border, isDark };
}

function isDarkHex(hex: string): boolean {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex);
  if (!m) return false;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l < 0.5;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function darken(hex: string, amount: number): string {
  return shift(hex, -amount);
}

function lighten(hex: string, amount: number): string {
  return shift(hex, amount);
}

function shift(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex);
  if (!m) return hex;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const factor = amount < 0 ? 1 + amount : 1 - amount;
  const target = amount < 0 ? 0 : 255;
  const mix = (c: number) => clampByte(c * factor + target * (1 - factor));
  return `#${mix(r).toString(16).padStart(2, "0")}${mix(g).toString(16).padStart(2, "0")}${mix(b).toString(16).padStart(2, "0")}`;
}

/** Telegram WebApp HapticFeedback wrapper — safe no-op tashqi muhitda. */
export const haptic = {
  light: () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light"),
  medium: () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("medium"),
  heavy: () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("heavy"),
  soft: () => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("soft"),
  success: () => window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success"),
  error: () => window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("error"),
  warning: () => window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("warning"),
};
