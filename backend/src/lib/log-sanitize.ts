// Log sanitization — URL query string ichidagi maxfiy parametrlarni
// (masalan `?token=...`) loglardan olib tashlaydi.
//
// SECURITY (M2): EventSource/SSE va <a download> linklar Authorization
// header yubora olmaydi, shuning uchun ba'zi route'lar JWT'ni query'dan
// (`?token=...`) qabul qiladi (events.ts, tenant-export.ts). Pino'ning
// `redact` paths faqat strukturalangan maydonlarni (headers/body) yashiradi,
// lekin `req.url` butun query string'ni o'z ichiga oladi. Bu yordamchi shu
// URL'larni log'ga yozishdan oldin tozalaydi.

// Loglardan yashiriladigan query parametr nomlari.
const SENSITIVE_QUERY_PARAMS = ["token", "access_token", "api_key", "apikey"];

const CENSOR = "[REDACTED]";

/**
 * URL (yoki path?query) ichidagi maxfiy query parametrlarni `[REDACTED]`'ga
 * almashtiradi. Absolyut va nisbiy URL'lar bilan ishlaydi, query yo'q bo'lsa
 * o'zgartirishsiz qaytaradi. Kirish tipini saqlaydi (string → string).
 */
export function sanitizeUrl(url: string): string;
export function sanitizeUrl(url: string | undefined | null): string | undefined | null;
export function sanitizeUrl(url: string | undefined | null): string | undefined | null {
  if (!url) return url;
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return url;

  const path = url.slice(0, qIndex);
  const queryString = url.slice(qIndex + 1);

  let changed = false;
  const params = new URLSearchParams(queryString);
  for (const key of SENSITIVE_QUERY_PARAMS) {
    if (params.has(key)) {
      params.set(key, CENSOR);
      changed = true;
    }
  }
  if (!changed) return url;

  // URLSearchParams `[REDACTED]` ichidagi `[` `]` ni encode qiladi —
  // o'qilishi uchun ortga qaytaramiz (xavfsiz, faqat log uchun).
  const sanitizedQuery = params.toString().replace(/%5B/gi, "[").replace(/%5D/gi, "]");
  return `${path}?${sanitizedQuery}`;
}
