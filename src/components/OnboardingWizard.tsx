// Yangi tenant uchun 5 qadamli sehrgar.
// Birinchi kirishda avtomatik ochiladi (mahsulot va buyurtma yo'q bo'lsa).
// Foydalanuvchi xohlasa "Keyinroq" tugmasi bilan yopib qo'ya oladi.
// Holat localStorage'da tenant.id ga bog'liq holda saqlanadi.

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, X, ChevronRight, ChevronLeft, Sparkles,
  Store as StoreIcon, Package, MessageCircle, Rocket,
} from "lucide-react";
import { productsApi, ordersApi } from "../api/endpoints";
import { useAuth } from "../contexts/AuthContext";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useT } from "../i18n";

const DISMISSED_KEY = (tenantId: string) => `shopflow.onboarding.dismissed.${tenantId}`;

type StepId = "welcome" | "store" | "product" | "channel" | "done";

interface Step {
  id: StepId;
  title: string;
  description: string;
  icon: typeof StoreIcon;
  ctaLabel?: string;
  ctaPage?: "products" | "settings" | "platforms" | "uibuilder";
}

interface Props {
  onNavigate?: (page: "products" | "settings" | "platforms" | "uibuilder") => void;
}

export function OnboardingWizard({ onNavigate }: Props) {
  const { tenant } = useAuth();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<Set<StepId>>(new Set());
  const [checking, setChecking] = useState(true);

  const STEPS: Step[] = [
    {
      id: "welcome",
      title: t("onboarding.welcome.title"),
      description: t("onboarding.welcome.desc"),
      icon: Sparkles,
    },
    {
      id: "store",
      title: t("onboarding.store.title"),
      description: t("onboarding.store.desc"),
      icon: StoreIcon,
      ctaLabel: t("onboarding.store.cta"),
      ctaPage: "settings",
    },
    {
      id: "product",
      title: t("onboarding.product.title"),
      description: t("onboarding.product.desc"),
      icon: Package,
      ctaLabel: t("onboarding.product.cta"),
      ctaPage: "products",
    },
    {
      id: "channel",
      title: t("onboarding.channel.title"),
      description: t("onboarding.channel.desc"),
      icon: MessageCircle,
      ctaLabel: t("onboarding.channel.cta"),
      ctaPage: "platforms",
    },
    {
      id: "done",
      title: t("onboarding.done.title"),
      description: t("onboarding.done.desc"),
      icon: Rocket,
      ctaLabel: t("onboarding.done.cta"),
      ctaPage: "uibuilder",
    },
  ];

  // Birinchi kirishda — mahsulot va buyurtma bormi?
  // Bo'sh bo'lsa va dismiss qilinmagan bo'lsa, sehrgarni ko'rsatamiz.
  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    (async () => {
      try {
        const dismissed = localStorage.getItem(DISMISSED_KEY(tenant.id)) === "1";
        if (dismissed) {
          if (!cancelled) setChecking(false);
          return;
        }
        const [products, orders] = await Promise.all([
          productsApi.list({ pageSize: 1 }).catch(() => ({ total: 0 })),
          ordersApi.list({ pageSize: 1 }).catch(() => ({ total: 0 })),
        ]);
        if (cancelled) return;
        // Bo'sh tenant — wizard ko'rsatamiz va qaysi qadamlar bajarilganini tekshiramiz
        if (products.total === 0 && orders.total === 0) {
          setOpen(true);
        }
        const done = new Set<StepId>();
        done.add("welcome");
        if (products.total > 0) done.add("product");
        if (orders.total > 0) {
          done.add("product");
          done.add("channel");
        }
        setCompleted(done);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  const dismiss = useCallback(() => {
    if (tenant) {
      try { localStorage.setItem(DISMISSED_KEY(tenant.id), "1"); } catch { /* ignore */ }
    }
    setOpen(false);
  }, [tenant]);

  const handleCta = (page: "products" | "settings" | "platforms" | "uibuilder") => {
    // CTA bosilganda sehrgar yopiladi (lekin dismiss qilinmaydi — keyin qaytib ochiladi
    // agar qadam bajarilmagan bo'lsa).
    setOpen(false);
    onNavigate?.(page);
  };

  // Focus-trap + Escape + fokus tiklash (modal a11y).
  // Hook early return'dan oldin — rules-of-hooks.
  const panelRef = useFocusTrap<HTMLDivElement>(!checking && open, dismiss);

  if (checking || !open) return null;

  const step = STEPS[stepIndex];
  const Icon = step.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={step.title}
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0 }}
          className="bg-white border border-cream-300 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
        >
          {/* Progress bar */}
          <div className="h-1 bg-cream-200">
            <motion.div
              className="h-full bg-leaf-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {t("onboarding.step", { current: stepIndex + 1, total: STEPS.length })}
            </div>
            <button
              onClick={dismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-cream-100"
              aria-label={t("common.close")}
              title={t("onboarding.comeBackLater")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 pb-5">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-leaf-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-forest-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-forest-800 mb-1">{step.title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            </div>

            {step.ctaLabel && step.ctaPage && (
              <button
                onClick={() => handleCta(step.ctaPage!)}
                className="w-full mb-4 px-4 py-3 bg-leaf-400 hover:bg-leaf-500 rounded-xl text-sm font-semibold text-forest-800 transition-colors flex items-center justify-center gap-2"
              >
                {step.ctaLabel}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Step checklist */}
            <div className="space-y-1.5 mb-5">
              {STEPS.map((s, i) => {
                const isCurrent = i === stepIndex;
                const isDone = completed.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => setStepIndex(i)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                      isCurrent ? "bg-cream-100" : "hover:bg-cream-50"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-leaf-500 flex-shrink-0" />
                    ) : (
                      <Circle className={`w-4 h-4 flex-shrink-0 ${isCurrent ? "text-leaf-500" : "text-cream-300"}`} />
                    )}
                    <span className={`text-xs font-medium ${
                      isCurrent ? "text-forest-800" : isDone ? "text-slate-500 line-through" : "text-slate-500"
                    }`}>
                      {s.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer nav */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-cream-300">
              <button
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                disabled={isFirst}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-cream-100 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {t("common.back")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={dismiss}
                  className="text-xs text-slate-500 hover:text-forest-800 px-2"
                >
                  {t("onboarding.later")}
                </button>
                {!isLast ? (
                  <button
                    onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-forest-700 text-white hover:bg-forest-800"
                  >
                    {t("onboarding.continue")}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={dismiss}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-leaf-400 text-forest-800 hover:bg-leaf-500"
                  >
                    {t("onboarding.start")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook — Header'da yoki Settings'da "Sehrgarni qayta ochish" tugmasi uchun
export function useResetOnboarding() {
  const { tenant } = useAuth();
  return useCallback(() => {
    if (!tenant) return;
    try { localStorage.removeItem(DISMISSED_KEY(tenant.id)); } catch { /* ignore */ }
    window.location.reload();
  }, [tenant]);
}
