// Yengil i18n — kutubxonasiz, faqat function + Context.
// Til localStorage'da saqlanadi va Customer.language bilan sinxronlanadi.

export type Lang = "uz" | "ru";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { dictionary } from "./dictionary";

const LS_KEY = "shopflow.lang";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const LangContext = createContext<LangContextValue | null>(null);

function loadLang(): Lang {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === "uz" || raw === "ru") return raw;
  } catch { /* ignore */ }
  // Brauzer tilidan default — agar Russian bo'lsa ru, aks holda uz
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("ru")) {
    return "ru";
  }
  return "uz";
}

function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const entry = dictionary[key];
  if (!entry) return key; // missing key — kalit o'zi qaytariladi (dev hint)
  const raw = entry[lang] ?? entry.uz ?? key;
  return interpolate(raw, params);
}

// ─── React'dan tashqari joylar uchun (utils/format.ts kabi) ──────────────────
// Joriy til module-level singleton'da saqlanadi. LangProvider uni sinxron tutadi.
// Til o'zgarganda butun daraxt qayta render bo'ladi → formatlovchilar yangi
// qiymatni shu yerdan oladi.
let currentLang: Lang = loadLang();
export function getLang(): Lang {
  return currentLang;
}
// React kontekstisiz tarjima — joriy (yoki berilgan) tilga.
export function tStatic(
  key: string,
  params?: Record<string, string | number>,
  lang: Lang = currentLang,
): string {
  return translate(lang, key, params);
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const initial = loadLang();
    currentLang = initial;
    return initial;
  });

  const setLang = useCallback((next: Lang) => {
    currentLang = next; // module singleton'ni sinxron tut (format.ts uchun)
    setLangState(next);
    try { localStorage.setItem(LS_KEY, next); } catch { /* ignore */ }
    try { document.documentElement.lang = next; } catch { /* ignore */ }
  }, []);

  // HTML lang attribute sync + boshqa tabda o'zgargan tilni darhol qabul qilish.
  useEffect(() => {
    currentLang = lang;
    try { document.documentElement.lang = lang; } catch { /* ignore */ }
  }, [lang]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LS_KEY && (event.newValue === "uz" || event.newValue === "ru")) {
        currentLang = event.newValue;
        setLangState(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<LangContextValue>(() => ({
    lang,
    setLang,
    t: (key, params) => translate(lang, key, params),
  }), [lang, setLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useT() {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // Provider yo'q test muhitida — uz default
    return {
      lang: "uz" as Lang,
      setLang: () => {},
      t: (key: string, params?: Record<string, string | number>) => translate("uz", key, params),
    };
  }
  return ctx;
}
