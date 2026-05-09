/**
 * Backend API client. Token localStorage'da saqlanadi.
 */
const API_BASE = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "shopflow.token";

export function getToken(): string | null {
  return typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}

export function setToken(token: string | null) {
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const tok = getToken();
  if (tok) headers.set("authorization", `Bearer ${tok}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (err) {
    throw new ApiError(0, `Backend bilan aloqa yo'q (${API_BASE}). Server ishga tushganligini tekshiring.`, err);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data ? (data as { error?: string }).error : null) ?? res.statusText;
    throw new ApiError(res.status, msg ?? `HTTP ${res.status}`, data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string; role: string };
  shop: { id: string; name: string; currency: string };
}

export const api = {
  register: (body: { email: string; password: string; name: string; shopName: string }) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),

  me: () => request<{ userId: string; shopId: string }>("/api/auth/me"),

  bots: {
    list: () => request<Array<{ id: string; username: string | null; status: string; lastError: string | null; miniappUrl: string | null; createdAt: number }>>("/api/bots"),
    connect: (token: string) =>
      request<{ id: string; username: string; status: string; mode: string }>("/api/bots", {
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    status: (id: string) => request<{ id: string; username: string; botUserId: number; status: string; lastError: string | null }>(`/api/bots/${id}/status`),
    disconnect: (id: string) => request<{ ok: true }>(`/api/bots/${id}`, { method: "DELETE" }),
  },
};

/** Demo/dev: agar JWT yo'q bo'lsa, default admin'ni avto-yaratadi yoki login qiladi. */
export async function ensureDemoAuth() {
  if (getToken()) return;
  const creds = { email: "admin@shopflow.local", password: "shopflow12345", name: "Admin", shopName: "Mening do'konim" };
  try {
    const res = await api.register(creds);
    setToken(res.token);
  } catch {
    try {
      const res = await api.login(creds);
      setToken(res.token);
    } catch (err) {
      console.error("Auth muvaffaqiyatsiz:", err);
      throw err;
    }
  }
}
