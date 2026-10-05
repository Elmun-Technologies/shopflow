// Telegram Mini App theme integratsiyasi.
// Dizayn yo'nalishi: har doim CLEAN LIGHT (oq fon, brand rang accent) —
// Telegram dark rejimidan qat'iy nazar, do'kon bir xil yorug' ko'rinadi.
// CSS variable'lar (`--tg-*`) defensiv: komponentlar asosan o'z palitrasidan
// foydalanadi, lekin hammasi bir-biriga mos bo'lishi uchun shu yerda yorug'
// qiymatlar majburlanadi.

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

// Light Mini App palitra (barcha storefront komponentlari shuga mos)
export const STORE_COLORS = {
  pageBg: "#f6f6f8",
  card: "#ffffff",
  inset: "#f2f3f6",
  track: "#eceef2",
  text: "#171a21",
  text2: "#64748b",
  text3: "#94a3b8",
  border: "rgba(17,24,39,0.08)",
} as const;

export function applyTelegramTheme(brandPrimary: string | undefined): ThemeColors {
  const twa = window.Telegram?.WebApp;

  // Har doim light — dark Telegram mijozga ham oq do'kon ko'rinadi.
  const isDark = false;
  const bg = STORE_COLORS.pageBg;
  const bgSecondary = STORE_COLORS.card;
  const text = STORE_COLORS.text;
  const textSecondary = STORE_COLORS.text2;
  const hint = STORE_COLORS.text3;
  const primary = brandPrimary || "#10b981";
  const primaryText = "#ffffff";
  const border = STORE_COLORS.border;

  // Telegram'ning o'z header/fon rangini ham light qilamiz — do'kon va
  // Telegram chrome bir-biriga yopishiq turadi.
  // (Metodlar Telegram 6.1+ da; lokal tipda deklaratsiya qilinmagan bo'lishi
  // mumkin — shuning uchun kengaytirilgan cast.)
  try {
    const twaChrome = twa as
      | { setHeaderColor?: (color: string) => void; setBackgroundColor?: (color: string) => void }
      | undefined;
    twaChrome?.setHeaderColor?.(bg);
    twaChrome?.setBackgroundColor?.(bg);
  } catch {
    /* eski Telegram versiyalari — jim o'tamiz */
  }

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
