export function fmtMoney(amount: number, currency = "UZS"): string {
  const formatted = new Intl.NumberFormat("uz-UZ").format(Math.round(amount));
  return currency === "UZS" ? `${formatted} so'm` : `${formatted} ${currency}`;
}

export function fmtDate(d: string | number | Date): string {
  return new Date(d).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}
