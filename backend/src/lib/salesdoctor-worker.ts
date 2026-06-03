// Sales Doctor retry worker.
// Har 60 soniyada SalesDoctorRetry'dan PENDING + nextAttemptAt<=now navbatini olib
// qayta urinadi. Xato bo'lsa exponential backoff (2^attempts daqiqa).
// 5 ta urinishdan keyin FAILED bo'ladi.

import type { PrismaClient } from "@prisma/client";
import { pushOrderToSalesDoctor, pushOrderStatus, pushOrderRefund, pushProductToSD, pushCustomerToSD } from "./salesdoctor-push.js";

const SCAN_INTERVAL_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

interface MinimalLog {
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}

let timer: NodeJS.Timeout | null = null;

interface RetryRow {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  method: string;
  attempts: number;
}

async function processOne(prisma: PrismaClient, row: RetryRow): Promise<{ ok: boolean; error?: string }> {
  try {
    if (row.method === "setOrder") {
      await pushOrderToSalesDoctor(prisma, row.tenantId, row.resourceId);
    } else if (row.method === "setStatus") {
      // Joriy buyurtma statusini olib pushOrderStatus chaqirish
      const order = await prisma.order.findFirst({
        where: { id: row.resourceId, tenantId: row.tenantId },
        select: { status: true },
      });
      if (order) {
        await pushOrderStatus(prisma, row.tenantId, row.resourceId, order.status as "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED");
      }
    } else if (row.method === "setOrderDefect") {
      await pushOrderRefund(prisma, row.tenantId, row.resourceId);
    } else if (row.method === "setProduct") {
      await pushProductToSD(prisma, row.tenantId, row.resourceId);
    } else if (row.method === "setClient") {
      await pushCustomerToSD(prisma, row.tenantId, row.resourceId);
    } else {
      return { ok: false, error: `Unknown method: ${row.method}` };
    }

    // Eslatma: pushOrderToSalesDoctor xato yuz bersa o'zi yangi retry yaratadi.
    // Shuning uchun "DONE" ni belgilashdan oldin, yangi retry yaratilmaganini tekshirmaymiz —
    // har bir push o'z taqdirini hal qiladi.
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function tick(prisma: PrismaClient, log?: MinimalLog): Promise<void> {
  const now = new Date();
  const rows = await prisma.salesDoctorRetry.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    take: BATCH_SIZE,
    select: { id: true, tenantId: true, resourceType: true, resourceId: true, method: true, attempts: true },
  });

  for (const row of rows) {
    // Race avoidance — RUNNING ga o'tkazamiz
    const updated = await prisma.salesDoctorRetry.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "RUNNING" },
    });
    if (updated.count === 0) continue; // boshqa process oldi

    const result = await processOne(prisma, row);

    if (result.ok) {
      await prisma.salesDoctorRetry.update({
        where: { id: row.id },
        data: { status: "DONE", lastError: null },
      });
    } else {
      const nextAttempts = row.attempts + 1;
      const backoffMin = Math.pow(2, nextAttempts); // 2, 4, 8, 16, 32 daqiqa
      const nextAttemptAt = new Date(Date.now() + backoffMin * 60 * 1000);
      const finalStatus = nextAttempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
      await prisma.salesDoctorRetry.update({
        where: { id: row.id },
        data: {
          status: finalStatus,
          attempts: nextAttempts,
          lastError: result.error?.slice(0, 1000) ?? null,
          nextAttemptAt,
        },
      });
      log?.warn?.({ retryId: row.id, attempts: nextAttempts, error: result.error }, "SD retry failed");
    }
  }
}

export function startSalesDoctorWorker(prisma: PrismaClient, log?: MinimalLog): void {
  if (timer) return;
  log?.info?.("[salesdoctor] retry worker started");
  // Birinchi tick'ni darhol emas, 10s keyin — server start paytida boshqa initial ish bilan to'qnashmaslik
  setTimeout(() => {
    tick(prisma, log).catch((err) => log?.warn?.({ err }, "salesdoctor tick failed"));
    timer = setInterval(() => {
      tick(prisma, log).catch((err) => log?.warn?.({ err }, "salesdoctor tick failed"));
    }, SCAN_INTERVAL_MS);
  }, 10_000);
}

export function stopSalesDoctorWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
