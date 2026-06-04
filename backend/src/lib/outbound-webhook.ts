// Outbound (chiquvchi) webhooklar — tenant tashqi tizimlariga event yuborish.
// Fire-and-forget: order yaratish/status hech qachon webhook tufayli bloklanmaydi.
// Har bir POST HMAC-SHA256 imzo bilan (X-ShopFlow-Signature header).

import type { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { decryptSecret } from "./secret-cipher.js";

export type WebhookEventType =
  | "order.created"
  | "order.status_changed"
  | "order.paid"
  | "lead.created";

const TIMEOUT_MS = 8000;

/**
 * Private/internal IP yoki host blok-listidagi manzilmi tekshiradi (SSRF himoyasi).
 * IPv4 + IPv6 private ranges, link-local, loopback va cloud metadata endpointi.
 */
function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((x) => Number.isNaN(x))) return false;
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16,
  // 0.0.0.0/8, 100.64.0.0/10 (CGNAT)
  return (
    p[0] === 10 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    p[0] === 127 ||
    (p[0] === 169 && p[1] === 254) ||
    p[0] === 0 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
  );
}

function isPrivateIPv6(ip: string): boolean {
  const s = ip.toLowerCase();
  return (
    s === "::1" || // loopback
    s.startsWith("fc") || s.startsWith("fd") || // ULA (fc00::/7)
    s.startsWith("fe80:") || // link-local
    s === "::" ||
    s.startsWith("::ffff:") // IPv4-mapped — alohida tekshirilishi kerak
  );
}

async function isUrlSafe(url: URL): Promise<boolean> {
  // Faqat http(s)
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  // Aniq blok-list (cloud metadata, loopback variantlari)
  if (host === "localhost" || host === "metadata.google.internal") return false;
  // Agar IP bo'lsa, to'g'ridan-to'g'ri tekshiramiz
  const ipKind = isIP(host);
  if (ipKind === 4) return !isPrivateIPv4(host);
  if (ipKind === 6) {
    if (host.startsWith("::ffff:")) {
      const v4 = host.slice(7);
      return isIP(v4) === 4 ? !isPrivateIPv4(v4) : false;
    }
    return !isPrivateIPv6(host);
  }
  // Hostname — DNS resolve qilamiz va barcha javoblar tashqi ekanini tekshiramiz
  try {
    const resolved = await lookup(host, { all: true });
    return resolved.every((r) => {
      if (r.family === 4) return !isPrivateIPv4(r.address);
      if (r.family === 6) {
        if (r.address.startsWith("::ffff:")) {
          const v4 = r.address.slice(7);
          return isIP(v4) === 4 ? !isPrivateIPv4(v4) : false;
        }
        return !isPrivateIPv6(r.address);
      }
      return false;
    });
  } catch {
    return false; // DNS xato → xavfsizlik tomon
  }
}
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

  // SSRF himoyasi — private/internal manzillarni rad qilamiz
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(hook.url);
  } catch {
    await prisma.outboundWebhook.update({
      where: { id: hook.id },
      data: { lastError: "Noto'g'ri URL formati", failureCount: { increment: 1 } },
    }).catch(() => null);
    return;
  }
  if (!(await isUrlSafe(parsedUrl))) {
    await prisma.outboundWebhook.update({
      where: { id: hook.id },
      data: { active: false, lastError: "Ichki/private manzil rad etildi (SSRF himoyasi)", failureCount: { increment: 1 } },
    }).catch(() => null);
    return;
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
