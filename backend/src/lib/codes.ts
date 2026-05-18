// Human-readable kodlar generatori (LID-2025001, ORD-7523, va h.k.)
// Tenant + prefix bo'yicha oxirgi raqamga +1 qiladi.

import type { PrismaClient } from "@prisma/client";

export async function nextLeadCode(prisma: PrismaClient, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LID-${year}`;
  const last = await prisma.lead.findFirst({
    where: { tenantId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastNum = last ? Number(last.code.slice(prefix.length)) : 0;
  return `${prefix}${String(lastNum + 1).padStart(3, "0")}`;
}

export async function nextOrderCode(prisma: PrismaClient, tenantId: string): Promise<string> {
  const prefix = "ORD-";
  const last = await prisma.order.findFirst({
    where: { tenantId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const lastNum = last ? Number(last.code.slice(prefix.length)) : 7000;
  return `${prefix}${lastNum + 1}`;
}
