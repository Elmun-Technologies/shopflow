import { CheckCircle2, Circle, Database, Send, Globe, CreditCard, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import {
  useMoyskladStatus,
  useTelegramBotStatus,
  usePaymentProviders,
} from "../api/hooks";
import { api } from "../api/client";
import { useQuery } from "@tanstack/react-query";
import type { StorefrontSite } from "@shopflow/shared-types";

interface Props {
  onNavigate: (page: string) => void;
  /** When true, only show if there's pending work. */
  compact?: boolean;
}

/**
 * First-run onboarding helper. Shows the current setup progress with direct
 * navigation to each integration page. Once everything is "done", admins can
 * dismiss it via the storefront publish toggle (the last step).
 */
export function OnboardingChecklist({ onNavigate, compact = false }: Props) {
  const moysklad = useMoyskladStatus();
  const telegram = useTelegramBotStatus();
  const payments = usePaymentProviders();
  const site = useQuery({
    queryKey: ["storefront", "site"],
    queryFn: () => api.get<StorefrontSite>("/storefront-admin/site").then((r) => r.data),
  });

  const moyskladDone = moysklad.data?.status === "CONNECTED";
  const telegramDone = !!telegram.data?.enabled;
  const paymentsDone = (payments.data ?? []).some((p) => p.enabled);
  const storefrontDone = !!site.data?.published;

  const allDone = moyskladDone && telegramDone && paymentsDone && storefrontDone;
  if (compact && allDone) return null;

  const total = 4;
  const done = [moyskladDone, telegramDone, paymentsDone, storefrontDone].filter(Boolean).length;
  const progress = Math.round((done / total) * 100);

  const steps: Array<{
    key: string;
    title: string;
    description: string;
    icon: React.ElementType;
    done: boolean;
    cta: string;
    page: string;
  }> = [
    {
      key: "moysklad",
      title: "MoySklad ulanishi",
      description: "Mahsulot va qoldiqlar manbai. Tokensiz mahsulotlar ham, buyurtmalar ham ko'rinmaydi.",
      icon: Database,
      done: moyskladDone,
      cta: "Ulanish",
      page: "integrations",
    },
    {
      key: "telegram",
      title: "Telegram bot",
      description: "Mijozlar bot orqali katalogni ko'radi va buyurtma beradi.",
      icon: Send,
      done: telegramDone,
      cta: "Bot ulanish",
      page: "integrations",
    },
    {
      key: "payments",
      title: "To'lov tizimi",
      description: "Click yoki Payme orqali to'lovlarni avtomatik qabul qiling.",
      icon: CreditCard,
      done: paymentsDone,
      cta: "Sozlash",
      page: "integrations",
    },
    {
      key: "storefront",
      title: "Saytni e'lon qilish",
      description: "shopname.shopflow.uz orqali ommaviy do'koningiz ishlaydi.",
      icon: Globe,
      done: storefrontDone,
      cta: storefrontDone ? "Ko'rib chiqish" : "E'lon qilish",
      page: "storefront",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/60 p-5"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            {allDone ? "✅ Sozlamalar tugadi" : "Boshlash uchun qadamlar"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {allDone
              ? "Hammasi tayyor. Bu cheklist har doim shu yerda turadi."
              : `${done}/${total} qadam bajarildi · ShopFlow'ni to'liq ishga tushirish uchun pastdagi qadamlarni bajaring.`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">{progress}%</div>
        </div>
      </div>

      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <motion.div
          className="h-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <ul className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.key}
            className={`flex items-center gap-3 rounded-lg border p-3 transition ${
              step.done
                ? "border-emerald-900/40 bg-emerald-950/20"
                : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
            }`}
          >
            <span className="shrink-0">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : (
                <Circle className="h-5 w-5 text-slate-600" />
              )}
            </span>
            <span className="shrink-0 text-slate-500">
              <step.icon className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{step.title}</div>
              <div className="text-xs text-slate-400 line-clamp-1">{step.description}</div>
            </div>
            {!step.done && (
              <button
                type="button"
                onClick={() => onNavigate(step.page)}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white"
              >
                {step.cta}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </motion.section>
  );
}
