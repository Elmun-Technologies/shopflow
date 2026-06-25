// Pul, sana, raqamlarni formatlash uchun yagona joy.
// Til-bog'liq matn (so'm/сум, "daqiqa oldin"/"мин назад") joriy tilga moslanadi —
// til o'zgarganda butun daraxt qayta render bo'lib formatlovchilar yangilanadi.

import { getLang, tStatic } from "../i18n";

// Joriy tilga mos Intl locale
function localeFor(): string {
  return getLang() === "ru" ? "ru-RU" : "uz-UZ";
}

export function formatCurrency(value: number, currency = "UZS"): string {
  if (currency === "UZS") {
    return `${value.toLocaleString(localeFor(), { maximumFractionDigits: 0 })} ${tStatic("common.sum")}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactCurrency(value: number, currency = "UZS"): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B ${currency}`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ${currency}`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K ${currency}`;
  }
  return `${value.toLocaleString()} ${currency}`;
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleDateString(localeFor(), { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toLocaleString(localeFor(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(input: string | Date | null | undefined): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return tStatic("time.now");
  if (minutes < 60) return tStatic("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tStatic("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return tStatic("time.daysAgo", { count: days });
  return formatDate(d);
}
