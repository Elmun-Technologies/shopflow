// Global klaviatura yorliqlari. Sidebar'da allaqachon ⌘K paletkasi bor,
// bu yerda navigatsiya (g o, g p, ...) va kontekstual `n` (yangi) shortcut'lari.

import { useEffect, useRef } from "react";

type Page =
  | "dashboard" | "analytics" | "orders" | "products" | "payments" | "delivery"
  | "leads" | "customers" | "segments" | "chat" | "platforms" | "uibuilder" | "botbuilder"
  | "marketing" | "settings";

interface Options {
  onNavigate: (page: Page) => void;
  onShowHelp: () => void;
  onCloseHelp: () => void;
}

// Vim uslubidagi 2 belgili sequence — `g` so'ng harf
const GOTO_MAP: Record<string, Page> = {
  d: "dashboard",
  o: "orders",
  p: "products",
  c: "customers",
  l: "leads",
  h: "chat",     // chat → 'h' (men "chat" ni h bilan emas, c bilan istardim, lekin c "customers" oldi)
  m: "marketing",
  a: "analytics",
  s: "settings",
  v: "uibuilder", // Vitrina
  b: "botbuilder", // Bot konstruktori
};

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function useGlobalShortcuts({ onNavigate, onShowHelp, onCloseHelp }: Options) {
  // 2-belgili sequence uchun — birinchi belgi `g` keldi, ikkinchisini kutamiz
  const awaitingNext = useRef<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const cancelSequence = () => {
      awaitingNext.current = null;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      // Cmd/Ctrl/Alt bilan birga — boshqa shortcut'lar (⌘K va h.k.) ishlasin
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Form ichida yozayotgan bo'lsa shortcut'larni o'tkazib yuboramiz
      if (isTextInput(e.target)) {
        // Esc — global "yopish" hodisasi bo'lib qolaversin
        if (e.key === "Escape") onCloseHelp();
        return;
      }

      // Esc — help'ni yopish + sequence'ni bekor qilish
      if (e.key === "Escape") {
        cancelSequence();
        onCloseHelp();
        return;
      }

      // ? — yordam overlay'i
      if (e.key === "?" && !awaitingNext.current) {
        e.preventDefault();
        onShowHelp();
        return;
      }

      // g — sequence boshlanishi
      if (e.key === "g" && !awaitingNext.current) {
        awaitingNext.current = "g";
        timeoutRef.current = window.setTimeout(cancelSequence, 1200);
        return;
      }

      // g'dan keyingi harf — navigatsiya
      if (awaitingNext.current === "g") {
        const target = GOTO_MAP[e.key.toLowerCase()];
        cancelSequence();
        if (target) {
          e.preventDefault();
          onNavigate(target);
        }
        return;
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      cancelSequence();
    };
  }, [onNavigate, onShowHelp, onCloseHelp]);
}

// Help overlay uchun shortcut ro'yxati
export const SHORTCUTS_LIST: Array<{ keys: string[]; labelKey: string }> = [
  { keys: ["⌘", "K"], labelKey: "shortcuts.palette" },
  { keys: ["?"], labelKey: "shortcuts.help" },
  { keys: ["Esc"], labelKey: "shortcuts.escape" },
  { keys: ["g", "d"], labelKey: "shortcuts.goDashboard" },
  { keys: ["g", "o"], labelKey: "shortcuts.goOrders" },
  { keys: ["g", "p"], labelKey: "shortcuts.goProducts" },
  { keys: ["g", "c"], labelKey: "shortcuts.goCustomers" },
  { keys: ["g", "l"], labelKey: "shortcuts.goLeads" },
  { keys: ["g", "h"], labelKey: "shortcuts.goChat" },
  { keys: ["g", "m"], labelKey: "shortcuts.goMarketing" },
  { keys: ["g", "a"], labelKey: "shortcuts.goAnalytics" },
  { keys: ["g", "v"], labelKey: "shortcuts.goVitrina" },
  { keys: ["g", "b"], labelKey: "shortcuts.goBot" },
  { keys: ["g", "s"], labelKey: "shortcuts.goSettings" },
];
