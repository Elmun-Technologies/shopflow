// API client — JWT access token + refresh token mexanizmi.
// Access token 15 daqiqada, refresh token 30 kunda tugaydi.
// 401 javobida refresh tokendan yangi access token olinadi.

import { getLang, tStatic } from "../i18n";

const TOKEN_KEY = "shopflow.token";
const REFRESH_TOKEN_KEY = "shopflow.refreshToken";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearAuth(): void {
  setToken(null);
  setRefreshToken(null);
}

export const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Eski backend route'laridagi xato matnlarining ko'pi faqat o'zbekcha.
 * Ruscha interfeys ichida o'zbekcha server xatosini chiqarish o'rniga ruscha,
 * statusli xavfsiz fallback ko'rsatamiz. Backend Accept-Language'ni qo'llagan
 * route'larda kirill matn o'z holicha saqlanadi.
 */
function localizeErrorMessage(message: string, status: number): string {
  const lang = getLang();
  const hasCyrillic = /[А-Яа-яЁё]/.test(message);
  if (lang === "ru") {
    return hasCyrillic ? message : tStatic("server.requestFailed", { status }, "ru");
  }
  return hasCyrillic ? tStatic("server.requestFailed", { status }, "uz") : message;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  // Refresh tokenni chaqirishni oldini olish (sikldan qochish)
  _skipRefresh?: boolean;
}

// Refresh token jarayoni — parallel so'rovlar uchun bir marta chaqiriladi
let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept-Language": getLang() },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearAuth();
      return null;
    }
    const data = await res.json() as { token: string };
    setToken(data.token);
    return data.token;
  } catch {
    clearAuth();
    return null;
  }
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const token = getToken();
  const hasBody = opts.body !== undefined;
  const headers: Record<string, string> = { "Accept-Language": getLang() };
  if (hasBody) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers,
    body: hasBody ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  // 401 — refresh tokendan yangi access token olishga harakat
  if (res.status === 401 && !opts._skipRefresh) {
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
    }
    const newToken = await refreshPromise;

    if (newToken) {
      // Qayta so'rov — yangi token bilan
      return api<T>(path, { ...opts, _skipRefresh: true });
    }

    // Refresh ham muvaffaqiyatsiz — logout
    clearAuth();
    window.dispatchEvent(new CustomEvent("shopflow:unauthorized"));
    throw new ApiError(401, tStatic("server.requestFailed", { status: 401 }));
  }

  let payload: unknown;
  const text = await res.text();
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = text; }
  }

  if (!res.ok) {
    const rawMessage = (payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error: unknown }).error)
      : `HTTP ${res.status}`);
    throw new ApiError(res.status, localizeErrorMessage(rawMessage, res.status), payload);
  }
  return payload as T;
}

/** Multipart rasm yuklash — JWT refresh ham ishlaydi (forma 15 daqiqadan oshsa). */
export async function uploadFile(file: File): Promise<{ url: string }> {
  const doPost = async (token: string | null) => {
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = { "Accept-Language": getLang() };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE}/upload`, { method: "POST", headers, body: form });
  };

  let res = await doPost(getToken());
  if (res.status === 401) {
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    const newToken = await refreshPromise;
    if (!newToken) {
      clearAuth();
      window.dispatchEvent(new CustomEvent("shopflow:unauthorized"));
      throw new ApiError(401, tStatic("server.requestFailed", { status: 401 }));
    }
    res = await doPost(newToken);
  }

  let payload: unknown;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!res.ok) {
    const rawMessage =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new ApiError(res.status, localizeErrorMessage(rawMessage, res.status), payload);
  }
  return payload as { url: string };
}
