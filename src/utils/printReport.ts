// Analitika hisoboti — A4 PDF generatori.
// printOrder.ts kabi: yangi oyna ochib HTML yozadi, browser print → PDF.
// Email yuborish uchun ham shu HTML backend'ga berilishi mumkin (keyingi etap).

import { tStatic, type Lang } from "../i18n";

export interface ReportInput {
  storeName: string;
  periodLabel: string; // "Oylik", "Haftalik", ...
  generatedAt: Date;
  currency: string;
  lang: Lang;
  kpis: {
    revenue: { value: number; change: number };
    orders: { value: number; change: number };
    customers: { value: number; change: number };
    conversion: { value: number; change: number };
    avgOrder?: { value: number; change: number };
  };
  topProducts: Array<{ name: string; sold: number; revenue: number }>;
  categorySales: Array<{ name: string; value: number }>;
  trafficSources: Array<{ name: string; percentage: number }>;
}

function fmtMoney(n: number, currency: string, lang: Lang): string {
  const locale = lang === "ru" ? "ru-RU" : "uz-UZ";
  return new Intl.NumberFormat(locale).format(Math.round(n)) + " " + (currency === "UZS" ? tStatic("common.sum", undefined, lang) : currency);
}
function fmtNum(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "uz-UZ").format(n);
}
function changeBadge(change: number): string {
  const positive = change >= 0;
  const color = positive ? "#2f7d32" : "#c0392b";
  const arrow = positive ? "▲" : "▼";
  return `<span style="color:${color};font-size:11px;font-weight:600">${arrow} ${positive ? "+" : ""}${change.toFixed(1)}%</span>`;
}
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}

export function openReportPrint(input: ReportInput): boolean {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) return false; // Caller toast bilan xabar qiladi

  const tr = (key: string) => tStatic(key, undefined, input.lang);
  const dateStr = input.generatedAt.toLocaleString(input.lang === "ru" ? "ru-RU" : "uz-UZ", { dateStyle: "long", timeStyle: "short" });
  const maxCat = Math.max(1, ...input.categorySales.map((c) => c.value));

  const kpiCard = (label: string, value: string, change: number) => `
    <div class="kpi">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value">${value}</div>
      <div>${changeBadge(change)}</div>
    </div>`;

  const html = `<!doctype html>
<html lang="${input.lang}"><head><meta charset="utf-8"><title>${esc(tr("report.title"))} — ${esc(input.storeName)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #14201A; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #5FA340; padding-bottom: 12px; margin-bottom: 18px; }
  .store { font-size: 22px; font-weight: 700; color: #1F3327; }
  .sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .badge { background: #eaf5e1; color: #2f7d32; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
  h2 { font-size: 14px; color: #1F3327; margin: 22px 0 10px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .kpi { border: 1px solid #e5e5da; border-radius: 10px; padding: 12px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
  .kpi-value { font-size: 19px; font-weight: 700; margin: 4px 0; color: #1F3327; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; color: #94a3b8; font-size: 10px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #e5e5da; }
  td { padding: 7px 8px; border-bottom: 1px solid #f0f0e8; }
  .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .bar-name { width: 130px; font-size: 12px; }
  .bar-track { flex: 1; height: 10px; background: #f0f0e8; border-radius: 999px; overflow: hidden; }
  .bar-fill { height: 100%; background: linear-gradient(90deg,#A3D977,#5FA340); border-radius: 999px; }
  .bar-val { width: 90px; text-align: right; font-size: 12px; font-weight: 600; }
  .foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e5e5da; font-size: 10px; color: #94a3b8; text-align: center; }
  .print-button { position: fixed; top: 12px; right: 12px; background: #5FA340; color: #fff; border: 0; padding: 10px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; }
  @media print { .no-print { display: none !important; } }
</style></head>
<body>
  <button class="print-button no-print" onclick="window.print()">🖨 ${esc(tr("common.printPdf"))}</button>

  <div class="header">
    <div>
      <div class="store">${esc(input.storeName)}</div>
      <div class="sub">${esc(tr("report.salesOps"))} · ${dateStr}</div>
    </div>
    <span class="badge">${esc(input.periodLabel)}</span>
  </div>

  <h2>${esc(tr("report.mainMetrics"))}</h2>
  <div class="kpis">
    ${kpiCard(tr("analytics.kpi.revenue"), fmtMoney(input.kpis.revenue.value, input.currency, input.lang), input.kpis.revenue.change)}
    ${kpiCard(tr("analytics.kpi.orders"), fmtNum(input.kpis.orders.value, input.lang), input.kpis.orders.change)}
    ${kpiCard(tr("analytics.kpi.customers"), fmtNum(input.kpis.customers.value, input.lang), input.kpis.customers.change)}
    ${kpiCard(tr("analytics.kpi.conversion"), input.kpis.conversion.value.toFixed(1) + "%", input.kpis.conversion.change)}
    ${input.kpis.avgOrder ? kpiCard(tr("analytics.kpi.avgOrder"), fmtMoney(input.kpis.avgOrder.value, input.currency, input.lang), input.kpis.avgOrder.change) : ""}
  </div>

  ${input.topProducts.length ? `
  <h2>${esc(tr("report.topProducts"))}</h2>
  <table>
    <thead><tr><th>#</th><th>${esc(tr("analytics.topProducts.col.product"))}</th><th>${esc(tr("analytics.topProducts.col.sold"))}</th><th style="text-align:right">${esc(tr("analytics.topProducts.col.revenue"))}</th></tr></thead>
    <tbody>
      ${input.topProducts.slice(0, 10).map((p, i) => `
        <tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${fmtNum(p.sold, input.lang)}</td>
        <td style="text-align:right;font-weight:600">${fmtMoney(p.revenue, input.currency, input.lang)}</td></tr>`).join("")}
    </tbody>
  </table>` : ""}

  ${input.categorySales.length ? `
  <h2>${esc(tr("report.categorySales"))}</h2>
  ${input.categorySales.slice(0, 8).map((c) => `
    <div class="bar-row">
      <div class="bar-name">${esc(c.name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((c.value / maxCat) * 100)}%"></div></div>
      <div class="bar-val">${fmtMoney(c.value, input.currency, input.lang)}</div>
    </div>`).join("")}` : ""}

  ${input.trafficSources.length ? `
  <h2>${esc(tr("analytics.traffic.title"))}</h2>
  ${input.trafficSources.slice(0, 6).map((s) => `
    <div class="bar-row">
      <div class="bar-name">${esc(s.name)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(s.percentage)}%"></div></div>
      <div class="bar-val">${s.percentage.toFixed(0)}%</div>
    </div>`).join("")}` : ""}

  <div class="foot">${esc(tr("report.generated"))} · ${dateStr}</div>

  <script>setTimeout(function(){ try { window.print(); } catch(e){} }, 300);</script>
</body></html>`;

  w.document.write(html);
  w.document.close();
  return true;
}
