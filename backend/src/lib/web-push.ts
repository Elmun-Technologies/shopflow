// Web Push — admin paneliga brauzer/OS push notifikatsiyalari.
// VAPID kalitlari .env'da (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT).
// Kalit yo'q bo'lsa hech narsa qilinmaydi (silent skip — feature ixtiyoriy).

import webpush from "web-push";
import type { PrismaClient } from "@prisma/client";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? `mailto:${process.env.EMAIL ?? "admin@shop-flow.uz"}`;

let configured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
  } catch {
    /* noto'g'ri format — silent */
  }
}

export function isPushConfigured(): boolean {
  return configured;
}

export function getPublicKey(): string {
  return VAPID_PUBLIC;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

/**
 * Tenant'ning barcha admin push obunalariga xabar yuboradi.
 * Fire-and-forget — caller javobni kutmasin. Yaroqsiz subscription'lar
 * (410 Gone, 404 Not Found) DB'dan o'chiriladi.
 */
export async function pushToTenantAdmins(
  prisma: PrismaClient,
  tenantId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!configured) return { sent: 0, removed: 0 };

  const subs = await prisma.pushSubscription.findMany({
    where: { tenantId },
    select: { id: true, endpoint: true, p256dh: true, authKey: true },
  });
  if (subs.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.authKey } },
          body,
        );
        sent++;
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsedAt: new Date() },
        }).catch(() => null);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Obuna yo'qolgan/bekor qilingan — DB'dan o'chiramiz
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
          removed++;
        }
      }
    }),
  );

  return { sent, removed };
}
