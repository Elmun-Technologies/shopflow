// Yengil i18n — kutubxonasiz, faqat function + Context.
// Til localStorage'da saqlanadi va Customer.language bilan sinxronlanadi.

export type Lang = "uz" | "ru";

import { createContext, useContext, useEffect, useState } from "react";
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

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => loadLang());

  const setLang = (next: Lang) => {
    setLangState(next);
    try { localStorage.setItem(LS_KEY, next); } catch { /* ignore */ }
    try { document.documentElement.lang = next; } catch { /* ignore */ }
  };

  // HTML lang attribute sync
  useEffect(() => {
    try { document.documentElement.lang = lang; } catch { /* ignore */ }
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t: (key, params) => translate(lang, key, params) }}>
      {children}
    </LangContext.Provider>
  );
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
