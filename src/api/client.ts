// API client — barcha so'rovlarda JWT tokenni avtomatik qo'shadi.
// Token localStorage'da saqlanadi. 401 javobida tokenni tozalaydi va auth eventini chiqaradi.

const TOKEN_KEY = "shopflow.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

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

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent("shopflow:unauthorized"));
    throw new ApiError(401, "Unauthorized");
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
    const msg = (payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error: unknown }).error)
      : `HTTP ${res.status}`);
    throw new ApiError(res.status, msg, payload);
  }
  return payload as T;
}
