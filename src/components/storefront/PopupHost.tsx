// Mini App ochilganda mijozga ko'rsatiladigan popup'lar:
// - server'dan aktiv ro'yxatni oladi
// - foydalanuvchining lokal "ko'rilgan" tarixini hisobga oladi (impression cap, cooldown)
// - bir vaqtda eng yuqori prioritetli mos popup'ni ko'rsatadi
// - impression/click eventlarini server'ga yuboradi

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { haptic } from "./storefront-theme";
import { useT } from "../../i18n";

export type PopupKind = "MODAL" | "BANNER" | "TOAST";
export type PopupTrigger = "ON_OPEN" | "AFTER_DELAY" | "ON_TAB_CHANGE" | "ON_CART_ABANDON";

export interface PopupItem {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  kind: PopupKind;
  trigger: PopupTrigger;
  triggerDelaySec: number;
  maxImpressionsPerUser: number;
  cooldownHours: number;
  priority: number;
}

interface SeenState {
  [popupId: string]: { count: number; lastAt: number };
}

const LS_KEY = (slug: string) => `shopflow:store:${slug}:popups:seen`;

function loadSeen(slug: string): SeenState {
  try {
    const raw = localStorage.getItem(LS_KEY(slug));
    if (!raw) return {};
    return JSON.parse(raw) as SeenState;
  } catch {
    return {};
  }
}

function saveSeen(slug: string, state: SeenState) {
  try {
    localStorage.setItem(LS_KEY(slug), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function eligible(popup: PopupItem, seen: SeenState): boolean {
  const s = seen[popup.id];
  if (!s) return true;
  if (popup.maxImpressionsPerUser > 0 && s.count >= popup.maxImpressionsPerUser) return false;
  if (popup.cooldownHours > 0 && Date.now() - s.lastAt < popup.cooldownHours * 3600_000) return false;
  return true;
}

async function reportEvent(apiBase: string, slug: string, popupId: string, kind: "impression" | "click") {
  try {
    await fetch(`${apiBase}/storefront/${encodeURIComponent(slug)}/popups/${popupId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind }),
    });
  } catch {
    // failsoft — analytics shouldn't block UX
  }
}

interface PopupHostProps {
  storeSlug: string;
  apiBase: string;
  primaryColor: string;
  /** Tab/view o'zgarganda popup'ni ko'rsatish kerakmi (ON_TAB_CHANGE uchun). */
  onCtaClick?: (url: string) => void;
}

export function PopupHost({ storeSlug, apiBase, primaryColor, onCtaClick }: PopupHostProps) {
  const { t } = useT();
  const [popups, setPopups] = useState<PopupItem[]>([]);
  const [active, setActive] = useState<PopupItem | null>(null);

  // 1. Server'dan aktiv popup'larni olamiz
  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBase}/storefront/${encodeURIComponent(storeSlug)}/popups?trigger=ON_OPEN`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { popups: PopupItem[] }) => {
        if (!cancelled) setPopups(data.popups ?? []);
      })
      .catch(() => {
        // failsoft
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, storeSlug]);

  // 2. Mos popup'ni topib, delay bilan ko'rsatamiz
  useEffect(() => {
    if (!popups.length) return;
    const seen = loadSeen(storeSlug);
    const candidate = popups.find((p) => eligible(p, seen));
    if (!candidate) return;

    const delayMs = candidate.trigger === "AFTER_DELAY" ? candidate.triggerDelaySec * 1000 : 200;
    const t = setTimeout(() => {
      setActive(candidate);
      // impression yozish
      const next: SeenState = { ...seen };
      const prev = next[candidate.id] ?? { count: 0, lastAt: 0 };
      next[candidate.id] = { count: prev.count + 1, lastAt: Date.now() };
      saveSeen(storeSlug, next);
      reportEvent(apiBase, storeSlug, candidate.id, "impression");
      haptic.soft();
    }, delayMs);
    return () => clearTimeout(t);
  }, [popups, storeSlug, apiBase]);

  if (!active) return null;

  const handleClose = () => {
    haptic.soft();
    setActive(null);
  };

  const handleCta = () => {
    haptic.medium();
    reportEvent(apiBase, storeSlug, active.id, "click");
    if (active.ctaUrl) {
      if (onCtaClick) onCtaClick(active.ctaUrl);
      else if (/^https?:\/\//.test(active.ctaUrl)) window.open(active.ctaUrl, "_blank");
    }
    setActive(null);
  };

  // BANNER variant — yuqorida, kichik
  if (active.kind === "BANNER") {
    return (
      <div className="fixed top-0 left-0 right-0 z-[150] px-3 pt-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
        <div
          className="rounded-2xl shadow-xl border overflow-hidden"
          style={{
            backgroundColor: primaryColor,
            borderColor: primaryColor,
          }}
        >
          <div className="flex items-center gap-3 p-3">
            {active.imageUrl && (
              <img src={active.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{active.title}</div>
              <div className="text-xs text-white/85 truncate">{active.body}</div>
            </div>
            {active.ctaText && active.ctaUrl && (
              <button
                onClick={handleCta}
                className="text-xs font-semibold bg-white/20 hover:bg-white/30 text-white rounded-lg px-3 py-1.5 transition-colors"
              >
                {active.ctaText}
              </button>
            )}
            <button onClick={handleClose} aria-label={t("common.close")} className="p-1 text-white/70 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MODAL variant — to'liq ekran overlay
  return (
    <div
      className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
      onClick={handleClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {active.imageUrl && (
          <div className="w-full aspect-[16/9] bg-slate-800">
            <img src={active.imageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-lg font-bold text-white leading-tight">{active.title}</h3>
            <button
              onClick={handleClose}
              aria-label={t("common.close")}
              className="p-1 -mr-1 text-slate-400 hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{active.body}</p>
          {active.ctaText && active.ctaUrl && (
            <button
              onClick={handleCta}
              className="w-full mt-5 py-3 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98]"
              style={{ backgroundColor: primaryColor }}
            >
              {active.ctaText}
            </button>
          )}
          <button
            onClick={handleClose}
            className="w-full mt-2 py-2 text-xs text-slate-500 hover:text-slate-300"
          >
            {t("popup.later")}
          </button>
        </div>
      </div>
    </div>
  );
}
