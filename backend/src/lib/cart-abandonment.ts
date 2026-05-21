// Cart abandonment scheduler.
// Har 5 daqiqada AbandonedCart jadvalini skanerlaydi, 1 soatdan ortiq tinch
// turgan savatlarga Telegram orqali eslatma yuboradi.

import type { PrismaClient } from "@prisma/client";
import { notifyCustomerByTelegramId } from "./telegram-notify.js";

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 daqiqa
const ABANDONMENT_THRESHOLD_MS = 60 * 60 * 1000; // 1 soat tinch yotgan savat
const MAX_REMINDERS = 1; // bir savat uchun maksimal 1 ta eslatma

let timer: NodeJS.Timeout | null = null;

interface CartItem {
  productId: string;
  qty: number;
  name: string;
  price: number;
}

function formatItemsList(items: CartItem[]): string {
  const lines = items.slice(0, 5).map((i) => `• ${i.name} × ${i.qty}`);
  if (items.length > 5) lines.push(`<i>...va yana ${items.length - 5} ta</i>`);
  return lines.join("\n");
}

function buildReminderText(args: {
  storeName: string;
  customerName: string | null;
  items: CartItem[];
  total: number;
  currency: string;
}): string {
  const totalStr = args.currency === "UZS"
    ? `${args.total.toLocaleString("uz-UZ")} so'm`
    : `${args.total} ${args.currency}`;
  const itemCount = args.items.reduce((s, i) => s + i.qty, 0);
  const greeting = args.customerName ? `${args.customerName}, ` : "";

  return (
    `🛒 <b>${greeting}savatingiz kutmoqda!</b>\n\n` +
    `<b>${args.storeName}</b> do'konida ${itemCount} ta mahsulot tanlab qoldingiz:\n\n` +
    formatItemsList(args.items) + `\n\n` +
    `<b>Jami:</b> ${totalStr}\n\n` +
    `Davom etish uchun do'konga qayting 👇`
  );
}

async function processOnce(prisma: PrismaClient, log: (msg: string, ...rest: unknown[]) => void): Promise<void> {
  const cutoff = new Date(Date.now() - ABANDONMENT_THRESHOLD_MS);

  const candidates = await prisma.abandonedCart.findMany({
    where: {
      lastActiveAt: { lt: cutoff },
      remindersSent: { lt: MAX_REMINDERS },
      // To'liq bo'sh savat bo'lishi shart emas (POST cart endpoint bo'sh bo'lsa o'chiradi),
      // lekin himoya uchun:
    },
    include: {
      tenant: { select: { name: true, currency: true } },
    },
    take: 100,
  });

  if (candidates.length === 0) return;

  log(`[cart-abandonment] ${candidates.length} ta abandoned cart topildi`);

  for (const cart of candidates) {
    try {
      const items = Array.isArray(cart.items) ? (cart.items as unknown as CartItem[]) : [];
      if (items.length === 0) {
        await prisma.abandonedCart.delete({ where: { id: cart.id } });
        continue;
      }
      const text = buildReminderText({
        storeName: cart.tenant.name,
        customerName: cart.customerName,
        items,
        total: Number(cart.total),
        currency: cart.currency,
      });
      const result = await notifyCustomerByTelegramId(
        prisma,
        cart.tenantId,
        cart.telegramUserId,
        text,
      );
      if (result.sent) {
        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: {
            reminderSentAt: new Date(),
            remindersSent: { increment: 1 },
          },
        });
        log(`[cart-abandonment] ✅ tenant=${cart.tenantId} tgUser=${cart.telegramUserId}`);
      } else {
        log(`[cart-abandonment] ⏭ skipped tenant=${cart.tenantId}: ${result.reason}`);
        // Token yoki user yo'q bo'lsa, qayta urinmaslik uchun reminderSentAt belgilaymiz
        if (result.reason && /no Telegram bot|no telegramUserId|sendMessage rejected/i.test(result.reason)) {
          await prisma.abandonedCart.update({
            where: { id: cart.id },
            data: {
              reminderSentAt: new Date(),
              remindersSent: { increment: 1 },
            },
          });
        }
      }
    } catch (err) {
      log(`[cart-abandonment] ❌ tenant=${cart.tenantId} error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

export function startCartAbandonmentScheduler(prisma: PrismaClient, log: (msg: string, ...rest: unknown[]) => void = console.log): () => void {
  if (timer) return () => undefined;

  // Birinchi run birozdan keyin (server startup'ni bloklamaslik uchun)
  const startTimer = setTimeout(() => {
    processOnce(prisma, log).catch((err) => log("[cart-abandonment] initial run failed", err));
    timer = setInterval(() => {
      processOnce(prisma, log).catch((err) => log("[cart-abandonment] interval failed", err));
    }, SCAN_INTERVAL_MS);
  }, 30_000);

  return () => {
    clearTimeout(startTimer);
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
