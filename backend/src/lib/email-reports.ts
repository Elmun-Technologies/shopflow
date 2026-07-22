// Avtomatik email hisobotlar — TenantNotifSettings.reportFrequency bo'yicha
// kunlik/haftalik/oylik snapshot yuboradi. Scheduler har soatda tekshiradi
// va kerakli tenantlarga email yuboradi.

import type { PrismaClient } from "@prisma/client";
import { sendEmail, isEmailConfigured } from "./email.js";

type Freq = "daily" | "weekly" | "monthly";
const PERIOD_DAYS: Record<Freq, number> = { daily: 1, weekly: 7, monthly: 30 };
const SCAN_INTERVAL_MS = 60 * 60 * 1000; // har soatda bir marta tekshirish

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}

interface ReportData {
  storeName: string;
  periodLabel: string;
  currency: string;
  totals: { revenue: number; orders: number; customers: number; avgOrder: number };
  topProducts: Array<{ name: string; sold: number; revenue: number }>;
}

function buildReportHtml(data: ReportData): string {
  const fmt = (n: number) => new Intl.NumberFormat("uz-UZ").format(Math.round(n));
  const cur = data.currency === "UZS" ? "so'm" : data.currency;
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#14201A;margin:0;padding:24px;background:#FAFAF5">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e5da;border-radius:12px;padding:24px">
    <div style="border-bottom:2px solid #5FA340;padding-bottom:12px;margin-bottom:18px">
      <h1 style="margin:0;font-size:20px;color:#1F3327">${esc(data.storeName)}</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Savdo hisoboti — ${esc(data.periodLabel)}</p>
    </div>

    <h2 style="font-size:14px;color:#1F3327;margin:18px 0 10px">Asosiy ko'rsatkichlar</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:8px 0;color:#94a3b8">Daromad</td><td style="padding:8px 0;text-align:right;font-weight:600">${fmt(data.totals.revenue)} ${cur}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;border-top:1px solid #f0f0e8">Buyurtmalar</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #f0f0e8">${fmt(data.totals.orders)}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;border-top:1px solid #f0f0e8">Yangi mijozlar</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #f0f0e8">${fmt(data.totals.customers)}</td></tr>
      <tr><td style="padding:8px 0;color:#94a3b8;border-top:1px solid #f0f0e8">O'rtacha chek</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #f0f0e8">${fmt(data.totals.avgOrder)} ${cur}</td></tr>
    </table>

    ${data.topProducts.length ? `
    <h2 style="font-size:14px;color:#1F3327;margin:22px 0 10px">Eng ko'p sotilgan</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${data.topProducts.slice(0, 5).map((p, i) => `
        <tr><td style="padding:6px 0">${i + 1}. ${esc(p.name)}</td>
        <td style="padding:6px 0;text-align:right;color:#6b7280">${fmt(p.sold)} dona</td>
        <td style="padding:6px 0;text-align:right;font-weight:600">${fmt(p.revenue)} ${cur}</td></tr>`).join("")}
    </table>` : ""}

    <p style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e5da;font-size:11px;color:#94a3b8;text-align:center">
      ShopFlow tomonidan yuborildi · ${new Date().toLocaleDateString("uz-UZ", { dateStyle: "long" })}
    </p>
  </div>
</body></html>`;
}

async function buildReport(
  prisma: PrismaClient,
  tenantId: string,
  freq: Freq,
): Promise<ReportData | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, currency: true },
  });
  if (!tenant) return null;

  const since = new Date(Date.now() - PERIOD_DAYS[freq] * 24 * 60 * 60 * 1000);

  const [orderAgg, customerCount, topRows] = await Promise.all([
    // Daromad ta'rifi Dashboard bilan bir xil: faqat COMPLETED (ilgari
    // COMPLETED+PROCESSING edi → dashboard bilan mos kelmasdi).
    prisma.order.aggregate({
      where: { tenantId, createdAt: { gte: since }, status: "COMPLETED" },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.customer.count({ where: { tenantId, createdAt: { gte: since } } }),
    // Eng ko'p sotilgan — faqat COMPLETED, va daromad OrderItem.price SNAPSHOT'idan
    // (jonli Product.price emas — tarixiy narx o'zgarsa buzilmaydi). groupBy qty*price
    // ni qo'llab-quvvatlamaydi, shuning uchun raw.
    prisma.$queryRaw<{ productId: string; sold: bigint; revenue: string }[]>`
      SELECT oi."productId" AS "productId",
             SUM(oi."qty") AS sold,
             SUM(oi."price" * oi."qty") AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."tenantId" = ${tenantId}
        AND o."status" = 'COMPLETED'::"OrderStatus"
        AND o."createdAt" >= ${since}
      GROUP BY oi."productId"
      ORDER BY sold DESC
      LIMIT 5
    `,
  ]);

  const revenue = Number(orderAgg._sum.total ?? 0);
  const orders = orderAgg._count._all;
  const products = await prisma.product.findMany({
    where: { id: { in: topRows.map((p) => p.productId) } },
    select: { id: true, name: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const periodLabel = freq === "daily" ? "Kunlik" : freq === "weekly" ? "Haftalik" : "Oylik";

  return {
    storeName: tenant.name,
    periodLabel,
    currency: tenant.currency,
    totals: {
      revenue,
      orders,
      customers: customerCount,
      avgOrder: orders > 0 ? revenue / orders : 0,
    },
    topProducts: topRows.map((tp) => {
      const p = productMap.get(tp.productId);
      return {
        name: p?.name ?? "—",
        sold: Number(tp.sold),
        revenue: Number(tp.revenue ?? 0),
      };
    }),
  };
}

export async function sendReportToTenant(
  prisma: PrismaClient,
  tenantId: string,
  freq: Freq,
): Promise<{ ok: boolean; reason?: string; sent?: number }> {
  if (!isEmailConfigured()) return { ok: false, reason: "smtp_not_configured" };
  const settings = await prisma.tenantNotifSettings.findUnique({ where: { tenantId } });
  if (!settings || !settings.emailNotificationsEnabled) return { ok: false, reason: "disabled" };
  if (!settings.emailRecipients || settings.emailRecipients.length === 0) return { ok: false, reason: "no_recipients" };

  const data = await buildReport(prisma, tenantId, freq);
  if (!data) return { ok: false, reason: "no_tenant" };

  const result = await sendEmail({
    to: settings.emailRecipients,
    subject: `[ShopFlow] ${data.periodLabel} hisobot — ${data.storeName}`,
    html: buildReportHtml(data),
  });
  if (result.ok) {
    await prisma.tenantNotifSettings.update({
      where: { tenantId },
      data: { lastReportSentAt: new Date() },
    });
  }
  return { ok: result.ok, reason: result.reason, sent: result.ok ? settings.emailRecipients.length : 0 };
}

function isDue(freq: Freq, lastSent: Date | null): boolean {
  if (!lastSent) return true;
  const sinceMs = Date.now() - lastSent.getTime();
  const periodMs = PERIOD_DAYS[freq] * 24 * 60 * 60 * 1000;
  // Kunlik — 23 soatdan keyin yangi yuboriladi (timezone drift uchun bufer)
  return sinceMs >= periodMs - 60 * 60 * 1000;
}

let timer: NodeJS.Timeout | null = null;

export function startEmailReportsScheduler(
  prisma: PrismaClient,
  log: (msg: string, ...rest: unknown[]) => void = console.log,
): () => void {
  if (timer) return () => undefined;
  if (!isEmailConfigured()) {
    log("[email-reports] SMTP sozlanmagan — scheduler ishlatilmaydi");
    return () => undefined;
  }

  const tick = async () => {
    try {
      const tenants = await prisma.tenantNotifSettings.findMany({
        where: { emailNotificationsEnabled: true, reportFrequency: { in: ["daily", "weekly", "monthly"] } },
        select: { tenantId: true, reportFrequency: true, lastReportSentAt: true },
      });
      for (const t of tenants) {
        const freq = t.reportFrequency as Freq;
        if (!isDue(freq, t.lastReportSentAt)) continue;
        const res = await sendReportToTenant(prisma, t.tenantId, freq);
        log(`[email-reports] tenant=${t.tenantId} freq=${freq} ok=${res.ok} reason=${res.reason ?? "-"}`);
      }
    } catch (err) {
      log("[email-reports] tick error", err);
    }
  };

  // Birinchi run 60 soniyadan keyin (server startup'ni bloklamaslik)
  const startTimer = setTimeout(() => {
    void tick();
    timer = setInterval(() => { void tick(); }, SCAN_INTERVAL_MS);
  }, 60_000);

  return () => {
    clearTimeout(startTimer);
    if (timer) { clearInterval(timer); timer = null; }
  };
}
