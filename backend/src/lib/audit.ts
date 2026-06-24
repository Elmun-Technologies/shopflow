// Audit log — kim, qachon, nima qildi
//
// Cross-cutting tracking: orders.patch, products.create/patch/delete,
// leads.patch va h.k. logAudit() ni chaqiradi. UI'da resource timeline
// ko'rsatish uchun ishlatiladi.

import type { PrismaClient } from "@prisma/client";

interface LogAuditArgs {
  prisma: PrismaClient;
  tenantId: string;
  actorId?: string | null;
  actorName?: string | null;
  action: string; // "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "ASSIGN" | "NOTE_ADDED" | ...
  resourceType: string; // "order" | "product" | "lead" | "customer" | ...
  resourceId: string;
  summary?: string | null;
  changes?: Record<string, unknown> | null;
}

/**
 * Audit yozuvini saqlaydi. Xatolik bo'lsa log qiladi va davom ettiradi —
 * audit ish jarayonini bloklamasligi kerak.
 */
export async function logAudit(args: LogAuditArgs): Promise<void> {
  try {
    await args.prisma.auditLog.create({
      data: {
        tenantId: args.tenantId,
        actorId: args.actorId ?? null,
        actorName: args.actorName ?? null,
        action: args.action,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        summary: args.summary ?? null,
        changes: (args.changes as never) ?? undefined,
      },
    });
  } catch (err) {
    // Audit log buzilsa, asosiy operatsiya hech qachon to'xtatilmaydi.
    console.warn("[audit] write failed", err);
  }
}

/**
 * logAudit'ning qulay varianti — session'dan actorId/tenantId oladi va
 * actor nomini avtomatik qidiradi. Route handler'larda boilerplate'ni
 * kamaytiradi (har joyda user.findUnique takrorlanmasin).
 */
export async function logAuditFor(
  prisma: PrismaClient,
  session: { userId: string; tenantId: string },
  args: Omit<LogAuditArgs, "prisma" | "tenantId" | "actorId" | "actorName">,
): Promise<void> {
  let actorName: string | null = null;
  try {
    const actor = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    });
    actorName = actor?.name ?? null;
  } catch {
    /* actor topilmasa ham audit yoziladi */
  }
  await logAudit({
    prisma,
    tenantId: session.tenantId,
    actorId: session.userId,
    actorName,
    ...args,
  });
}
