// API kalitlari — generatsiya va hash.
// Public API (v1) auth va Settings → API tab shu yerdan foydalanadi.
//
// Format: `sf_<56 hex>` (jami 59 belgi). Faqat yaratilganda bir marta to'liq
// ko'rsatiladi; DB'da faqat SHA-256 hash (`keyHash`) saqlanadi.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const API_KEY_PREFIX = "sf_";

/** Yangi API kalit yaratadi. `key` — to'liq kalit (bir martalik), `hash` — DB uchun. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const raw = `${API_KEY_PREFIX}${randomBytes(28).toString("hex")}`;
  const prefix = raw.slice(0, 10); // ro'yxatda ko'rsatish uchun ("sf_ab12cd")
  return { key: raw, prefix, hash: hashApiKey(raw) };
}

/** Kalitni DB'dagi `keyHash` bilan solishtirish uchun SHA-256 hash. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Constant-time hash solishtirish (timing attack'larga qarshi). */
export function safeHashEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
