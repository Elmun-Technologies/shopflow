// Buyurtmani chop etish uchun standalone HTML hujjat yaratadi va yangi
// brauzer oynasida ochadi. Foydalanuvchi Ctrl/Cmd+P bilan PDF qiladi yoki
// printer'ga jo'natadi. Yangi oyna popup blokchi tomonidan to'silishi mumkin
// (lekin user click trigger qilgani uchun odatda o'tadi).

interface PrintOrderInput {
  code: string;
  status: string; // ko'rinadigan label (allaqachon tarjima qilingan)
  createdAt: string;
  currency: string;
  total: number;
  notes: string | null;
  customer: { name: string; phone: string | null; email: string | null } | null;
  shippingAddress: string | null;
  items: Array<{ name: string; sku: string; qty: number; price: number }>;
  tenant: { name: string; phone?: string | null; address?: string | null } | null;
  // Lokalizatsiya — admin tilidagi labellar
  labels: {
    title: string; // "Hisob-faktura" / "Счёт-фактура"
    code: string;
    date: string;
    status: string;
    customer: string;
    address: string;
    sku: string;
    item: string;
    qty: string;
    price: string;
    sum: string;
    total: string;
    notes: string;
    footer: string;
  };
}

function fmtMoney(n: number, currency: string): string {
  if (currency === "UZS") return `${n.toLocaleString("uz-UZ")} so'm`;
  return `${n.toLocaleString()} ${currency}`;
}

function escapeHtml(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function openOrderPrint(input: PrintOrderInput): void {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) {
    // Popup bloklangan — alert va return
    alert("Pop-up blocked. Brauzer sozlamalaridan ruxsat bering.");
    return;
  }

  const { labels: L } = input;
  const dateStr = new Date(input.createdAt).toLocaleString("uz-UZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows = input.items.map((it, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>
        <div class="item-name">${escapeHtml(it.name)}</div>
        <div class="item-sku">SKU: ${escapeHtml(it.sku)}</div>
      </td>
      <td class="num">${it.qty}</td>
      <td class="num">${fmtMoney(it.price, input.currency)}</td>
      <td class="num bold">${fmtMoney(it.price * it.qty, input.currency)}</td>
    </tr>
  `).join("");

  const tenantName = escapeHtml(input.tenant?.name ?? "ShopFlow");
  const tenantPhone = input.tenant?.phone ? escapeHtml(input.tenant.phone) : "";
  const tenantAddress = input.tenant?.address ? escapeHtml(input.tenant.address) : "";

  const customerName = input.customer ? escapeHtml(input.customer.name) : "—";
  const customerContact = input.customer
    ? [input.customer.phone, input.customer.email].filter(Boolean).map((s) => escapeHtml(s!)).join(" · ")
    : "";

  const html = `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<title>${L.title} #${escapeHtml(input.code)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    background: #fff;
    margin: 0;
    padding: 32px;
    font-size: 13px;
    line-height: 1.45;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .brand { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
  .brand-meta { color: #64748b; font-size: 12px; }
  .invoice-title { font-size: 18px; font-weight: 700; margin: 0; text-align: right; }
  .invoice-code { color: #475569; font-size: 14px; margin-top: 4px; text-align: right; }
  .invoice-date { color: #64748b; font-size: 11px; margin-top: 2px; text-align: right; }

  .row { display: flex; gap: 32px; margin-bottom: 24px; }
  .col { flex: 1; }
  .col-label { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; margin-bottom: 4px; font-weight: 600; }
  .col-value { font-size: 13px; color: #0f172a; }
  .col-value-strong { font-weight: 600; }
  .col-sub { color: #475569; font-size: 12px; margin-top: 2px; }

  .status-badge {
    display: inline-block;
    background: #e0f2fe;
    color: #075985;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }

  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  table.items th {
    text-align: left;
    background: #f1f5f9;
    padding: 8px 10px;
    font-size: 11px;
    text-transform: uppercase;
    color: #475569;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  table.items th.num, table.items td.num { text-align: right; }
  table.items td {
    padding: 10px;
    border-bottom: 1px solid #e2e8f0;
    vertical-align: top;
  }
  table.items td .item-name { font-weight: 500; }
  table.items td .item-sku { color: #94a3b8; font-size: 11px; margin-top: 2px; }
  table.items td.bold { font-weight: 600; }

  .total-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
    gap: 24px;
  }
  .total-label { font-size: 14px; color: #475569; }
  .total-value { font-size: 20px; font-weight: 700; color: #0f172a; }

  .notes-box {
    margin-top: 24px;
    padding: 12px 16px;
    background: #fefce8;
    border: 1px solid #fde047;
    border-radius: 6px;
  }
  .notes-label { font-size: 11px; font-weight: 600; color: #854d0e; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.04em; }
  .notes-text { font-size: 13px; color: #0f172a; white-space: pre-wrap; }

  .footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
    text-align: center;
    color: #94a3b8;
    font-size: 11px;
  }

  @media print {
    body { padding: 16px; }
    .no-print { display: none; }
    @page { size: A4; margin: 12mm; }
  }

  .print-button {
    position: fixed;
    top: 16px;
    right: 16px;
    background: #10b981;
    color: white;
    border: 0;
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
  }
  .print-button:hover { background: #059669; }
</style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">🖨 Print / PDF</button>

  <div class="header">
    <div>
      <p class="brand">${tenantName}</p>
      ${tenantAddress ? `<p class="brand-meta">${tenantAddress}</p>` : ""}
      ${tenantPhone ? `<p class="brand-meta">${tenantPhone}</p>` : ""}
    </div>
    <div>
      <p class="invoice-title">${escapeHtml(L.title)}</p>
      <p class="invoice-code">${escapeHtml(L.code)}: <strong>#${escapeHtml(input.code)}</strong></p>
      <p class="invoice-date">${escapeHtml(L.date)}: ${escapeHtml(dateStr)}</p>
    </div>
  </div>

  <div class="row">
    <div class="col">
      <div class="col-label">${escapeHtml(L.customer)}</div>
      <div class="col-value col-value-strong">${customerName}</div>
      ${customerContact ? `<div class="col-sub">${customerContact}</div>` : ""}
    </div>
    <div class="col">
      <div class="col-label">${escapeHtml(L.status)}</div>
      <div class="col-value"><span class="status-badge">${escapeHtml(input.status)}</span></div>
    </div>
  </div>

  ${input.shippingAddress ? `
  <div class="row">
    <div class="col">
      <div class="col-label">${escapeHtml(L.address)}</div>
      <div class="col-value">${escapeHtml(input.shippingAddress)}</div>
    </div>
  </div>
  ` : ""}

  <table class="items">
    <thead>
      <tr>
        <th class="num">#</th>
        <th>${escapeHtml(L.item)}</th>
        <th class="num">${escapeHtml(L.qty)}</th>
        <th class="num">${escapeHtml(L.price)}</th>
        <th class="num">${escapeHtml(L.sum)}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="total-row">
    <span class="total-label">${escapeHtml(L.total)}:</span>
    <span class="total-value">${fmtMoney(input.total, input.currency)}</span>
  </div>

  ${input.notes ? `
  <div class="notes-box">
    <div class="notes-label">${escapeHtml(L.notes)}</div>
    <div class="notes-text">${escapeHtml(input.notes)}</div>
  </div>
  ` : ""}

  <div class="footer">${escapeHtml(L.footer)}</div>

  <script>
    // Avtomatik print dialog'ini ochish — ba'zi brauzerlarda autostart blokli,
    // shu sabab tugma ham qoldirilgan.
    setTimeout(() => { try { window.print(); } catch (e) {} }, 250);
  </script>
</body>
</html>`;

  w.document.write(html);
  w.document.close();
  w.focus();
}
