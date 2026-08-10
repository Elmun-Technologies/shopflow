// Single-product landing — ulashiladigan PREZENTATSION bo'limlar (dark Telegram tema).
// Maqsad: admin konstruktor preview'i mijoz ko'radigan sahifa bilan BIR XIL ko'rinsin (WYSIWYG).
// Bu komponentlar STATELESS — faqat ma'lumot oladi, interaktivlik yo'q (haptic, bottom-sheet,
// async fetch StorePage'da qoladi). Konstruktor preview'i shu komponentlardan foydalanadi.

import { useEffect, useState } from "react";
import {
  BadgeCheck, ShieldCheck, ChevronRight, Star, ShoppingBag,
  Truck, Clock, Package, Plus,
} from "lucide-react";
import { useT } from "../../i18n";

// ─── View-model ──────────────────────────────────────────────────────────────
// Admin Product'da bo'lmagan maydonlar (reviewCount/avgRating/weeklyBuyers/comboCount)
// preview'da "namuna" sifatida ko'rsatiladi — kelajakda admin DTO boyitilsa, real bo'ladi.
export interface SinglePreviewProduct {
  name: string;
  price: number;
  oldPrice?: number;
  currency: string;
  imageUrl?: string;
  description?: string;
  stock: number;
  featured: boolean;
  categoryName?: string;
  reviewCount: number;
  avgRating: number;
  weeklyBuyers: number;
  comboCount: number;
}

export const SECTION_SPACING = "pt-5 mt-5 border-t border-slate-800";

function money(n: number, currency: string, lang: "uz" | "ru"): string {
  const label = currency === "UZS" ? (lang === "ru" ? "сум" : "so'm") : currency;
  return `${Math.round(n).toLocaleString(lang === "ru" ? "ru-RU" : "uz-UZ")} ${label}`;
}

// "namuna / образец" yorlig'i — admin'da bo'lmagan (real bo'lmagan) qiymatlar uchun
function SampleTag() {
  const { t } = useT();
  return (
    <span className="text-[9px] uppercase tracking-wide text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
      {t("ui.preview.sampleTag")}
    </span>
  );
}

// ─── Yarim tunigacha ortga hisob (FOMO taymer) ───────────────────────────────
export function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, midnight.getTime() - now.getTime());
}

export function CountdownBanner({ label, color }: { label: string; color: string }) {
  const [remaining, setRemaining] = useState(msUntilMidnight);
  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border border-rose-500/30 bg-rose-500/10">
      <div className="flex items-center gap-2 text-rose-300">
        <Clock className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-lg font-bold font-mono tracking-wider text-white" style={{ color }}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </div>
  );
}

// ─── Bo'limlar (prezentatsion) ───────────────────────────────────────────────

export function GalleryPreview({ vm }: { vm: SinglePreviewProduct }) {
  return (
    <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-800 flex items-center justify-center">
      {vm.imageUrl ? (
        <img src={vm.imageUrl} alt={vm.name} className="w-full h-full object-cover" />
      ) : (
        <Package className="w-10 h-10 text-slate-600" />
      )}
    </div>
  );
}

export function PricePreview({ vm }: { vm: SinglePreviewProduct }) {
  const { lang } = useT();
  const discount = vm.oldPrice && vm.oldPrice > vm.price
    ? Math.round((1 - vm.price / vm.oldPrice) * 100)
    : 0;
  return (
    <div className="mt-4">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-white">{money(vm.price, vm.currency, lang)}</span>
        {vm.oldPrice && vm.oldPrice > vm.price && (
          <>
            <span className="text-sm text-slate-500 line-through">{money(vm.oldPrice, vm.currency, lang)}</span>
            <span className="text-[11px] font-bold text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded">−{discount}%</span>
          </>
        )}
      </div>
      <h2 className="text-lg font-semibold text-white mt-1.5 leading-snug">{vm.name}</h2>
    </div>
  );
}

export function TrustBadgesPreview({ onOpenOriginal, onOpenWarranty }: { onOpenOriginal?: () => void; onOpenWarranty?: () => void } = {}) {
  const { t } = useT();
  const cls = "flex-1 flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl";
  const btnCls = `${cls} active:scale-[0.98] transition-transform`;
  return (
    <div className="flex gap-2">
      {onOpenOriginal ? (
        <button type="button" onClick={onOpenOriginal} className={btnCls}>
          <BadgeCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-medium text-white">{t("pdp.original")}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
        </button>
      ) : (
        <div className={cls}>
          <BadgeCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs font-medium text-white">{t("pdp.original")}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
        </div>
      )}
      {onOpenWarranty ? (
        <button type="button" onClick={onOpenWarranty} className={btnCls}>
          <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span className="text-xs font-medium text-white">{t("pdp.warranty")}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
        </button>
      ) : (
        <div className={cls}>
          <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
          <span className="text-xs font-medium text-white">{t("pdp.warranty")}</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
        </div>
      )}
    </div>
  );
}

export function RatingChipPreview({ vm, sample = true, className = "" }: { vm: SinglePreviewProduct; sample?: boolean; className?: string }) {
  const { t } = useT();
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
      <span className="text-sm font-semibold text-white">{vm.avgRating.toFixed(1)}</span>
      <span className="text-xs text-slate-500">·</span>
      <span className="text-xs text-slate-400">{t("pdp.totalReviews", { count: vm.reviewCount })}</span>
      {sample && <SampleTag />}
    </div>
  );
}

export function StatsPreview({ vm }: { vm: SinglePreviewProduct }) {
  const { t } = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {vm.categoryName && (
        <span className="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-1 rounded-md">{vm.categoryName}</span>
      )}
      {vm.stock > 0 ? (
        <span className="text-[11px] text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-md">{t("pdp.available")}</span>
      ) : (
        <span className="text-[11px] text-rose-300 bg-rose-500/10 px-2 py-1 rounded-md">{t("pdp.outOfStock")}</span>
      )}
      {vm.featured && (
        <span className="text-[11px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md">{t("pdp.bestseller")}</span>
      )}
    </div>
  );
}

export function WeeklyBuyersPreview({ vm, sample = true }: { vm: SinglePreviewProduct; sample?: boolean }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-300">
      <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
      <span>{t("pdp.weeklyBuyers", { count: vm.weeklyBuyers })}</span>
      {sample && <SampleTag />}
    </div>
  );
}

export function DescriptionPreview({ vm, expanded, onToggle, isLong = true }: { vm: SinglePreviewProduct; expanded?: boolean; onToggle?: () => void; isLong?: boolean }) {
  const { t } = useT();
  if (!vm.description) return null;
  // Konstruktor (onToggle yo'q) — doim qisqartirilgan. Live store — expanded'ga qarab.
  const clamp = onToggle ? (!expanded && isLong) : true;
  return (
    <div className="relative">
      <p className={`text-sm text-slate-300 leading-relaxed whitespace-pre-wrap ${clamp ? "line-clamp-4" : ""}`}>{vm.description}</p>
      {onToggle && isLong && (
        <button type="button" onClick={onToggle} className="mt-2 text-sm font-medium text-sky-400 active:opacity-70">
          {expanded ? t("pdp.readLess") : t("pdp.readMore")}
        </button>
      )}
    </div>
  );
}

export function DeliveryPreview({ dateStr }: { dateStr: string }) {
  const { t } = useT();
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
        <Truck className="w-5 h-5 text-sky-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{t("pdp.delivery", { date: dateStr })}</div>
        <div className="text-xs text-slate-400 mt-0.5">{t("pdp.deliveryNote")}</div>
      </div>
    </div>
  );
}

export function ReviewsPreview({ vm }: { vm: SinglePreviewProduct }) {
  const { t } = useT();
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">{t("pdp.reviews")}</h3>
        <span className="text-slate-500 text-xs">({vm.reviewCount})</span>
        <SampleTag />
      </div>
      <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
        <div className="flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(vm.avgRating) ? "fill-amber-400 text-amber-400" : "text-slate-700"}`} />
          ))}
        </div>
        <div className="h-2 mt-2 rounded bg-slate-800 w-3/4" />
        <div className="h-2 mt-1.5 rounded bg-slate-800 w-1/2" />
      </div>
    </div>
  );
}

export function ComboPreview() {
  const { t } = useT();
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Plus className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">{t("pdp.comboTitle")}</h3>
        <SampleTag />
      </div>
      <div className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-800 bg-slate-900">
        <div className="w-5 h-5 rounded border-2 border-slate-600 flex-shrink-0" />
        <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
          <Package className="w-5 h-5 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-2.5 rounded bg-slate-800 w-2/3" />
          <div className="h-2.5 mt-2 rounded bg-slate-800 w-1/3" />
        </div>
      </div>
    </div>
  );
}

export function CtaPreview({ vm }: { vm: SinglePreviewProduct }) {
  const { t } = useT();
  const out = vm.stock <= 0;
  return (
    <button
      type="button"
      disabled
      className={`w-full rounded-2xl py-3.5 text-base font-semibold ${
        out ? "bg-slate-800 text-slate-500" : "bg-emerald-500 text-white"
      }`}
    >
      {out ? t("pdp.outOfStock") : t("single.buy")}
    </button>
  );
}

// Single-config optional bo'lim kalitini JSX'ga aylantirish (konstruktor preview'i uchun).
// StorePage'dagi singleSectionEl switch bilan bir xil tartibda.
export function renderSinglePreviewSection(
  key: string,
  vm: SinglePreviewProduct,
  opts: { deliveryStr: string; timerLabel: string; timerColor: string },
) {
  switch (key) {
    case "trustBadges": return <TrustBadgesPreview />;
    case "reviews": return <ReviewsPreview vm={vm} />;
    case "weeklyBuyers": return <WeeklyBuyersPreview vm={vm} />;
    case "stats": return <StatsPreview vm={vm} />;
    case "timer": return <CountdownBanner label={opts.timerLabel} color={opts.timerColor} />;
    case "description": return <DescriptionPreview vm={vm} />;
    case "delivery": return <DeliveryPreview dateStr={opts.deliveryStr} />;
    case "combo": return <ComboPreview />;
    default: return null;
  }
}
