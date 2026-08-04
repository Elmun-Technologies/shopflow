// 1C «Обмен с сайтом» sessiyasi va fayl staging'i.
//
// 1C almashinuvni bosqichma-bosqich qiladi: avval `mode=init` (staging tozalanadi),
// keyin `mode=file` bilan fayllarni (import.xml + import_files/*.jpg) bo'laklab
// yuboradi, oxirida `mode=import` bilan qayta ishlashni so'raydi. Shu sababli
// fayllar diskda vaqtincha saqlanadi.
//
// MUHIM: staging katalogi UPLOADS_DIR ichida EMAS — `/app/uploads` nginx orqali
// ochiq beriladi, import.xml esa butun katalogni oshkor qilardi.

import { createHmac, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

const EXCHANGE_DIR = process.env.ONEC_EXCHANGE_DIR ?? "/app/1c-exchange";

/** Sessiya cookie nomi — `mode=checkauth` javobida 1C'ga aytiladi. */
export const ONEC_COOKIE_NAME = "shopflow_1c";

/** Cookie amal qilish muddati — bitta almashinuv seansi uchun yetarli. */
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 soat

function sessionKey(): string {
  const secret = process.env.SECRETS_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET kerak — 1C sessiya imzosi uchun");
  return secret;
}

/**
 * Stateless sessiya tokeni: `base64url(tenantId.exp).hex(hmac)`.
 * Xotirada Map saqlamaymiz — backend qayta ishga tushsa ham almashinuv uzilmaydi.
 */
export function issueSessionToken(tenantId: string): string {
  const payload = Buffer.from(`${tenantId}.${Date.now() + SESSION_TTL_MS}`).toString("base64url");
  const sig = createHmac("sha256", sessionKey()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** Token to'g'ri va muddati o'tmagan bo'lsa tenantId qaytaradi. */
export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = createHmac("sha256", sessionKey()).update(payload).digest("hex");
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const sep = decoded.lastIndexOf(".");
  if (sep <= 0) return null;
  const tenantId = decoded.slice(0, sep);
  const exp = Number(decoded.slice(sep + 1));
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return tenantId || null;
}

/** `Cookie:` sarlavhasidan 1C sessiya qiymatini ajratadi. */
export function readSessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === ONEC_COOKIE_NAME) return part.slice(eq + 1).trim();
  }
  return null;
}

/** `Authorization: Basic ...` ni login/parolga ajratadi. */
export function parseBasicAuth(header: string | undefined): { login: string; password: string } | null {
  if (!header) return null;
  const m = /^Basic\s+(.+)$/i.exec(header.trim());
  if (!m) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(m[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return null;
  return { login: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
}

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]");

// ── Fayl staging ──────────────────────────────────────────────────────────

function tenantDir(tenantId: string): string {
  const safe = tenantId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw new Error("Yaroqsiz tenant ID");
  return path.join(EXCHANGE_DIR, safe);
}

/**
 * 1C bergan `filename` ni xavfsiz nisbiy yo'lga aylantiradi.
 * "..", absolyut yo'l va nazorat belgilari rad etiladi (path traversal himoyasi).
 */
export function safeRelPath(filename: string): string | null {
  if (!filename) return null;
  // Nazorat belgilari — fayl tizimi uchun xavfli
  if (CONTROL_CHARS.test(filename)) return null;
  const normalized = filename.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return null;

  const segments = normalized.split("/").filter((s) => s !== "" && s !== ".");
  if (!segments.length || segments.length > 12) return null;
  if (segments.some((s) => s === ".." || s.length > 200)) return null;

  const rel = segments.join("/");
  return rel.length > 500 ? null : rel;
}

/** Staging ichidagi absolyut yo'l. Katalogdan chiqib ketsa null. */
export function stagedPath(tenantId: string, filename: string): string | null {
  const rel = safeRelPath(filename);
  if (!rel) return null;
  const base = tenantDir(tenantId);
  const full = path.resolve(base, rel);
  // Belt-and-braces: normalize'dan keyin ham baza ichida qolganini tekshiramiz
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  return full;
}

/** Yangi almashinuv seansi — eski fayllarni tozalaymiz. */
export async function resetStaging(tenantId: string): Promise<void> {
  const dir = tenantDir(tenantId);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

/**
 * `mode=file` bo'lagini yozadi. 1C katta faylni bir nechta POST bilan
 * yuboradi — shuning uchun qo'shib yoziladi (append).
 */
export async function appendStagedChunk(
  tenantId: string,
  filename: string,
  chunk: Buffer,
): Promise<{ ok: true; size: number } | { ok: false; error: string }> {
  const full = stagedPath(tenantId, filename);
  if (!full) return { ok: false, error: "Yaroqsiz fayl nomi" };
  try {
    await mkdir(path.dirname(full), { recursive: true });
    await appendFile(full, chunk);
    const s = await stat(full);
    return { ok: true, size: s.size };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Staging'dagi faylni o'qiydi (topilmasa null). */
export async function readStagedFile(tenantId: string, filename: string): Promise<Buffer | null> {
  const full = stagedPath(tenantId, filename);
  if (!full) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}
