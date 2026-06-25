// Human-readable kodlar generatori (LID-2025001, ORD-7523, va h.k.)
// Tenant + prefix bo'yicha oxirgi raqamga +1 qiladi.
//
// MUHIM: oxirgi kodni `orderBy: createdAt` bilan topamiz, `orderBy: code` EMAS.
// String `code` leksikografik saralanadi ("ORD-9999" > "ORD-10000") — bu 4 xonadan
// keyin dublikat kod va @@unique buzilishiga (P2002) olib keladi. createdAt eng
// so'nggi (eng katta raqamli) yozuvni beradi. Race uchun create'da P2002 retry bor
// (createOrderCodeWithRetry).

import type { PrismaClient } from "@prisma/client";

function parseTrailingNumber(code: string, prefixLen: number, fallback: number): number {
  const n = Number(code.slice(prefixLen));
  return Number.isFinite(n) ? n : fallback;
}

export async function nextLeadCode(prisma: PrismaClient, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LID-${year}`;
  const last = await prisma.lead.findFirst({
    where: { tenantId, code: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  const lastNum = last ? parseTrailingNumber(last.code, prefix.length, 0) : 0;
  return `${prefix}${String(lastNum + 1).padStart(3, "0")}`;
}

export async function nextOrderCode(prisma: PrismaClient, tenantId: string): Promise<string> {
  const prefix = "ORD-";
  const last = await prisma.order.findFirst({
    where: { tenantId, code: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  const lastNum = last ? parseTrailingNumber(last.code, prefix.length, 7000) : 7000;
  return `${prefix}${lastNum + 1}`;
}

// Concurrent yaratishda ikkita so'rov bir xil kodni olishi mumkin (P2002).
// Bu helper kodni qayta generatsiya qilib, bir necha marta urinadi.
export async function createOrderCodeWithRetry<T>(
  prisma: PrismaClient,
  tenantId: string,
  create: (code: string) => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const code = await nextOrderCode(prisma, tenantId);
    try {
      return await create(code);
    } catch (err) {
      // P2002 = unique constraint (kod allaqachon mavjud) → qayta urinish
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
