// Outbound (chiquvchi) webhooklar — tenant tashqi tizimlariga event yuborish.
// Fire-and-forget: order yaratish/status hech qachon webhook tufayli bloklanmaydi.
// Har bir POST HMAC-SHA256 imzo bilan (X-ShopFlow-Signature header).

import type { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";
import { decryptSecret } from "./secret-cipher.js";

export type WebhookEventType =
  | "order.created"
  | "order.status_changed"
  | "order.paid"
  | "lead.created";

const TIMEOUT_MS = 8000;
const MAX_FAILURES_BEFORE_DISABLE = 20;

/**
 * Berilgan event uchun tenant'ning faol webhooklarini topib, har biriga
 * payload yuboradi. Hech qachon throw qilmaydi.
 */
export async function fireWebhookEvent(
  prisma: PrismaClient,
  tenantId: string,
  event: WebhookEventType,
  data: Record<string, unknown>,
): Promise<void> {
  let hooks: Array<{ id: string; url: string; encryptedSecret: string | null; failureCount: number }>;
  try {
    hooks = await prisma.outboundWebhook.findMany({
      where: { tenantId, active: true, events: { has: event } },
      select: { id: true, url: true, encryptedSecret: true, failureCount: true },
    });
  } catch {
    return; // jadval yo'q yoki DB xatosi — sokin
  }
  if (hooks.length === 0) return;

  const body = JSON.stringify({
    event,
    tenantId,
    timestamp: new Date().toISOString(),
    data,
  });

  // Har bir webhook'ni parallel yuboramiz (lekin natijani kutmaydigan caller)
  await Promise.allSettled(hooks.map((hook) => deliverOne(prisma, hook, event, body)));
}

async function deliverOne(
  prisma: PrismaClient,
  hook: { id: string; url: string; encryptedSecret: string | null; failureCount: number },
  event: WebhookEventType,
  body: string,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "ShopFlow-Webhook/1.0",
    "X-ShopFlow-Event": event,
  };

  // Maxfiy kalit bo'lsa — HMAC imzo qo'shamiz (qabul qiluvchi tekshira oladi)
  if (hook.encryptedSecret) {
    try {
      const secret = decryptSecret(hook.encryptedSecret);
      const sig = createHmac("sha256", secret).update(body).digest("hex");
      headers["X-ShopFlow-Signature"] = `sha256=${sig}`;
    } catch {
      /* kalit ochilmadi — imzosiz yuboramiz */
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const ok = res.status >= 200 && res.status < 300;
    await prisma.outboundWebhook.update({
      where: { id: hook.id },
      data: {
        lastStatus: res.status,
        lastFiredAt: new Date(),
        lastError: ok ? null : `HTTP ${res.status}`,
        failureCount: ok ? 0 : { increment: 1 },
        // Ko'p marta fail bo'lsa avtomatik o'chiramiz (dead endpoint spam'ga yo'l qo'ymaymiz)
        ...(!ok && hook.failureCount + 1 >= MAX_FAILURES_BEFORE_DISABLE ? { active: false } : {}),
      },
    }).catch(() => null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.outboundWebhook.update({
      where: { id: hook.id },
      data: {
        lastFiredAt: new Date(),
        lastError: msg.slice(0, 200),
        failureCount: { increment: 1 },
        ...(hook.failureCount + 1 >= MAX_FAILURES_BEFORE_DISABLE ? { active: false } : {}),
      },
    }).catch(() => null);
  } finally {
    clearTimeout(timer);
  }
}
