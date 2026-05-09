const API_BASE = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_KEY = "shopflow.miniapp.token";

export function getToken(): string | null {
  return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null;
}
export function setToken(t: string | null) {
  if (typeof sessionStorage === "undefined") return;
  if (t) sessionStorage.setItem(TOKEN_KEY, t);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const tok = getToken();
  if (tok) headers.set("authorization", `Bearer ${tok}`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (err) {
    throw new ApiError(0, `Backend bilan aloqa yo'q (${API_BASE}). ${err instanceof Error ? err.message : ""}`);
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (data && typeof data === "object" && "error" in data ? (data as { error?: string }).error : null) ?? res.statusText;
    throw new ApiError(res.status, msg ?? `HTTP ${res.status}`);
  }
  return data as T;
}

function safeJson(t: string): unknown { try { return JSON.parse(t); } catch { return t; } }

export interface Product {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  images: string[];
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

export type BannerAction =
  | { kind: "category"; categoryId: string }
  | { kind: "product"; productId: string }
  | { kind: "url"; url: string }
  | { kind: "none" };

export interface BannerBlock {
  type: "banner";
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  action: BannerAction;
}

export type SectionBlock =
  | { type: "categories"; id: string; title: string; layout: "grid" | "list" | "scroll"; visibleIds?: string[] }
  | { type: "products"; id: string; title: string; filter: { categoryId?: string; productIds?: string[]; limit: number } }
  | { type: "text"; id: string; title?: string; body: string };

export interface UISchemaShape {
  version: 1;
  theme: { primary: string; accent?: string };
  welcomeMessage: string;
  banners: BannerBlock[];
  sections: SectionBlock[];
}

export const miniApi = {
  auth: (botId: string, initData: string) =>
    req<{ token: string; user: { id: string; firstName: string | null; username: string | null }; shop: { id: string; name: string; currency: string } }>(
      "/api/miniapp/auth",
      { method: "POST", body: JSON.stringify({ botId, initData }) },
    ),
  catalog: () => req<{ categories: Category[]; products: Product[] }>("/api/miniapp/catalog"),
  uiSchema: () => req<UISchemaShape>("/api/miniapp/ui-schema"),
  product: (id: string) => req<Product>(`/api/miniapp/products/${id}`),
  cart: {
    get: () => req<{ items: { productId: string; quantity: number }[] }>("/api/miniapp/cart"),
    save: (items: { productId: string; quantity: number }[]) =>
      req<{ ok: true }>("/api/miniapp/cart", { method: "PUT", body: JSON.stringify({ items }) }),
  },
  orders: {
    create: (body: {
      items: { productId: string; quantity: number }[];
      customerPhone: string;
      deliveryAddress?: object;
      paymentMethod?: "cash" | "card_online" | "transfer";
      notes?: string;
    }) => req<{ id: string; orderNumber: string; status: string; total: number }>("/api/miniapp/orders", { method: "POST", body: JSON.stringify(body) }),
    my: () => req<OrderSummary[]>("/api/miniapp/orders"),
  },
};
