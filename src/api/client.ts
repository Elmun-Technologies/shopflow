// API client — JWT access token + refresh token mexanizmi.
// Access token 15 daqiqada, refresh token 30 kunda tugaydi.
// 401 javobida refresh tokendan yangi access token olinadi.

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
      headers: { "Content-Type": "application/json" },
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
  const headers: Record<string, string> = {};
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
    throw new ApiError(401, "Unauthorized");
  }

  let payload: unknown;
  const text = await res.text();
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = text; }
  }

  if (!res.ok) {
    const msg = (payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error: unknown }).error)
      : `HTTP ${res.status}`);
    throw new ApiError(res.status, msg, payload);
  }
  return payload as T;
}
