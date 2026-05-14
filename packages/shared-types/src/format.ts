/**
 * Money is stored in kopecks (UZS × 100) throughout the system. UI surfaces
 * always show whole so'm — fractional kopecks are an artifact of MoySklad
 * pricing precision and are not meaningful to Uzbek customers.
 */
export function formatMoney(kopecks: number, options: { currency?: string } = {}): string {
  const currency = options.currency ?? "UZS";
  const value = Math.round(kopecks / 100);
  const formatted = new Intl.NumberFormat("uz-UZ").format(value);
  if (currency === "UZS") return `${formatted} so'm`;
  return `${formatted} ${currency}`;
}

export function formatDate(iso: string, options: { withTime?: boolean } = {}): string {
  const d = new Date(iso);
  if (options.withTime) {
    return d.toLocaleString("uz-UZ", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("uz-UZ", { year: "numeric", month: "short", day: "2-digit" });
}

export function formatPhone(input: string): string {
  const digits = input.replace(/\D+/g, "");
  if (digits.length === 12 && digits.startsWith("998")) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  return input;
}

/**
 * Uzbekistan tax identification code (IKPU / MXIK). 10 or 17 digits.
 * Returns true if format is plausible — doesn't verify against the central registry.
 */
export function isValidIkpu(code: string): boolean {
  return /^\d{10}$/.test(code) || /^\d{17}$/.test(code);
}
