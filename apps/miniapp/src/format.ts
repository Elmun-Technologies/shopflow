export function formatMoney(kopecks: number): string {
  const uzs = Math.round(kopecks / 100);
  return new Intl.NumberFormat("uz-UZ").format(uzs) + " so'm";
}
