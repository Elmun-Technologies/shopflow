// Price List generator va Print chiqaruvchi utilita.
// Formating: Наименование товара, Артикул, Остаток, Себестоимость, Старая цена, Новая цена (пустой столбик).

export interface PriceListItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  costPrice?: number;
  oldPrice?: number | null;
  price: number;
  categoryName?: string;
  receiptDate?: string;
}

export interface PriceListPrintInput {
  storeName: string;
  generatedAt: Date;
  currency: string;
  items: PriceListItem[];
  filterLabel?: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}

function fmtMoney(n: number | undefined | null, currency: string): string {
  if (n === undefined || n === null) return "—";
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n)) + " " + (currency === "UZS" ? "so'm" : currency);
}

export function openPriceListPrint(input: PriceListPrintInput): boolean {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;

  const dateStr = input.generatedAt.toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" });

  const rowsHtml = input.items
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="font-weight: 600; color: #0f172a;">${esc(item.name)}</td>
      <td style="font-family: monospace; color: #334155;">${esc(item.sku || "—")}</td>
      <td style="text-align: center; font-weight: 600; color: ${item.stock > 0 ? "#166534" : "#991b1b"};">
        ${item.stock}
      </td>
      <td style="text-align: right; color: #475569;">${fmtMoney(item.costPrice, input.currency)}</td>
      <td style="text-align: right; color: #94a3b8; text-decoration: line-through;">
        ${item.oldPrice ? fmtMoney(item.oldPrice, input.currency) : "—"}
      </td>
      <td style="text-align: right; font-weight: 700; color: #166534;">
        ${fmtMoney(item.price, input.currency)}
      </td>
      <!-- Пустой столбик для записи новой цены -->
      <td style="width: 140px; border: 1.5px dashed #cbd5e1; background-color: #fafafa;"></td>
    </tr>
  `,
    )
    .join("");

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Прайс-лист — ${esc(input.storeName)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 10px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #15803d; padding-bottom: 10px; margin-bottom: 14px; }
    .title { font-size: 20px; font-weight: 800; color: #14532d; }
    .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
    .badge { background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    th { background: #f8fafc; color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; padding: 8px 6px; border: 1px solid #e2e8f0; text-align: left; }
    td { padding: 7px 6px; border: 1px solid #e2e8f0; vertical-align: middle; }
    .foot { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
    .print-button { position: fixed; top: 12px; right: 12px; background: #15803d; color: #fff; border: 0; padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .print-button:hover { background: #166534; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">🖨 Печать Прайс-листа</button>

  <div class="header">
    <div>
      <div class="title">${esc(input.storeName)} — ПРАЙС ЛИСТ</div>
      <div class="sub">Сформировано: ${dateStr} ${input.filterLabel ? `· ${esc(input.filterLabel)}` : ""}</div>
    </div>
    <span class="badge">Всего товаров: ${input.items.length}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">№</th>
        <th>Наименование товара</th>
        <th style="width: 90px;">Артикул</th>
        <th style="width: 60px; text-align: center;">Остаток</th>
        <th style="width: 100px; text-align: right;">Себестоимость</th>
        <th style="width: 90px; text-align: right;">Старая цена</th>
        <th style="width: 100px; text-align: right;">Текущая цена</th>
        <th style="width: 140px; text-align: center; background: #f1f5f9;">Новая цена (заполнение)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="foot">
    ShopFlow Management System · Прайс-лист для ревизии и переоценки
  </div>
</body>
</html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
