// Per-tenant SSE event bus — backend'da event yuz berganda admin paneliga
// real-time push qiladi (15s polling o'rniga). Faqat process-local in-memory —
// bitta backend container yetarli; multi-instance kelajakda Redis pub/sub'ga
// migratsiya qilinadi.

import type { FastifyReply } from "fastify";

export type SseEvent =
  | { type: "order.created"; orderId: string; code: string; total: number; currency: string }
  | { type: "order.status_changed"; orderId: string; code: string; status: string }
  | { type: "lead.created"; leadId: string; name: string }
  | { type: "ping" };

interface Subscriber {
  reply: FastifyReply;
  alive: boolean;
}

// tenantId -> Subscriber[]
const subscribers = new Map<string, Set<Subscriber>>();

export function subscribe(tenantId: string, reply: FastifyReply): () => void {
  let set = subscribers.get(tenantId);
  if (!set) {
    set = new Set();
    subscribers.set(tenantId, set);
  }
  const sub: Subscriber = { reply, alive: true };
  set.add(sub);
  return () => {
    sub.alive = false;
    set?.delete(sub);
    if (set && set.size === 0) subscribers.delete(tenantId);
  };
}

/**
 * Tenant'ning barcha ulangan admin sessiyalariga event yuboradi.
 * Fire-and-forget — agar bironta subscriber yo'q bo'lsa hech narsa qilmaydi.
 */
export function publishToTenant(tenantId: string, event: SseEvent): void {
  const set = subscribers.get(tenantId);
  if (!set || set.size === 0) return;
  const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const sub of set) {
    if (!sub.alive) continue;
    try {
      sub.reply.raw.write(data);
    } catch {
      sub.alive = false;
      set.delete(sub);
    }
  }
}

// Har 30 soniyada keep-alive — proxy connection'larni yopib qo'ymasligi uchun
setInterval(() => {
  for (const [tenantId, set] of subscribers) {
    for (const sub of set) {
      if (!sub.alive) continue;
      try {
        sub.reply.raw.write(`: keep-alive ${Date.now()}\n\n`);
      } catch {
        sub.alive = false;
        set.delete(sub);
      }
    }
    if (set.size === 0) subscribers.delete(tenantId);
  }
}, 30_000).unref();
