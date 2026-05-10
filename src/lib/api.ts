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

export interface AdminOrder {
  id: string;
  orderNumber: string;
  status: "pending" | "confirmed" | "preparing" | "shipping" | "delivered" | "cancelled";
  paymentStatus: "unpaid" | "paid" | "refunded";
  paymentMethod: string | null;
  source: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  customerPhone: string | null;
  deliveryAddress: { city?: string; street?: string; house?: string; apartment?: string; notes?: string } | null;
  notes: string | null;
  tgUserId: string | null;
  createdAt: string | number;
  updatedAt: string | number;
}

export interface AdminProduct {
  id: string;
  shopId: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  images: string[];
  active: boolean;
  featured: boolean;
  rating: number;
  reviewCount: number;
  sku: string | null;
}

export type LeadSource = "telegram" | "miniapp" | "web_form" | "instagram" | "facebook" | "whatsapp" | "marketplace" | "landing_page" | "email" | "google_ads" | "yandex_direct" | "phone" | "other";
export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "lost";
export type LeadPriority = "low" | "medium" | "high";

export interface AdminLead {
  id: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  value: number;
  notes: string | null;
  tgUserId: string | null;
  orderId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | number;
  updatedAt: string | number;
}

export interface AdminCategory {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export type BannerAction =
  | { kind: "category"; categoryId: string }
  | { kind: "product"; productId: string }
  | { kind: "url"; url: string }
  | { kind: "none" };

export interface UIBanner {
  type: "banner";
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  action: BannerAction;
}

export type UISection =
  | { type: "categories"; id: string; title: string; layout: "grid" | "list" | "scroll"; visibleIds?: string[] }
  | { type: "products"; id: string; title: string; filter: { categoryId?: string; productIds?: string[]; limit: number } }
  | { type: "text"; id: string; title?: string; body: string };

export interface UISchema {
  version: 1;
  theme: { primary: string; accent?: string };
  welcomeMessage: string;
  banners: UIBanner[];
  sections: UISection[];
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
      request<{ id: string; username: string; status: string; mode: string; miniappUrl: string | null }>("/api/bots", {
        method: "POST",
        body: JSON.stringify({
          token,
          originUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      }),
    refreshMiniapp: (id: string) =>
      request<{ id: string; miniappUrl: string }>(`/api/bots/${id}/refresh-miniapp`, {
        method: "POST",
        body: JSON.stringify({
          originUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      }),
    status: (id: string) => request<{ id: string; username: string; botUserId: number; status: string; lastError: string | null }>(`/api/bots/${id}/status`),
    disconnect: (id: string) => request<{ ok: true }>(`/api/bots/${id}`, { method: "DELETE" }),
    getUiSchema: (id: string) => request<UISchema>(`/api/bots/${id}/ui-schema`),
    saveUiSchema: (id: string, schema: UISchema) => request<UISchema>(`/api/bots/${id}/ui-schema`, { method: "PUT", body: JSON.stringify(schema) }),
  },

  orders: {
    list: (params?: { status?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.limit) q.set("limit", String(params.limit));
      const qs = q.toString();
      return request<AdminOrder[]>(`/api/orders${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => request<AdminOrder & { items: Array<{ id: string; productName: string; quantity: number; price: number; total: number }>; customer: { firstName: string | null; username: string | null; phone: string | null } | null }>(`/api/orders/${id}`),
    update: (id: string, body: { status?: AdminOrder["status"]; paymentStatus?: AdminOrder["paymentStatus"]; notes?: string }) =>
      request<AdminOrder>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    stats: () => request<Array<{ status: string; count: number; total: number }>>("/api/orders/stats"),
    exportUrl: (params: { statuses?: string[]; type?: "by_orders" | "by_products" }) => {
      const q = new URLSearchParams();
      if (params.statuses?.length) q.set("statuses", params.statuses.join(","));
      if (params.type) q.set("type", params.type);
      return `/api/orders/export?${q.toString()}`;
    },
    exportCsv: async (params: { statuses?: string[]; type?: "by_orders" | "by_products" }) => {
      const q = new URLSearchParams();
      if (params.statuses?.length) q.set("statuses", params.statuses.join(","));
      if (params.type) q.set("type", params.type);
      const tok = getToken();
      const res = await fetch(`${(import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? "http://localhost:4000"}/api/orders/export?${q.toString()}`, {
        headers: tok ? { authorization: `Bearer ${tok}` } : {},
      });
      if (!res.ok) throw new ApiError(res.status, "Export muvaffaqiyatsiz");
      return await res.blob();
    },
  },

  products: {
    list: () => request<AdminProduct[]>("/api/products"),
    get: (id: string) => request<AdminProduct>(`/api/products/${id}`),
    create: (body: Partial<AdminProduct>) => request<AdminProduct>("/api/products", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<AdminProduct>) => request<AdminProduct>(`/api/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<{ ok: true }>(`/api/products/${id}`, { method: "DELETE" }),
    categories: {
      list: () => request<AdminCategory[]>("/api/products/categories"),
      create: (body: { name: string; parentId?: string | null; sortOrder?: number }) =>
        request<AdminCategory>("/api/products/categories", { method: "POST", body: JSON.stringify(body) }),
      update: (id: string, body: Partial<{ name: string; parentId: string | null; sortOrder: number }>) =>
        request<AdminCategory>(`/api/products/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
      remove: (id: string) => request<{ ok: true }>(`/api/products/categories/${id}`, { method: "DELETE" }),
    },
  },

  analytics: {
    dashboard: () => request<{
      revenue: { today: number; yesterday: number; week: number; month: number; deltaPct: number };
      orders: { today: number; week: number; month: number; total: number; pending: number };
      customers: { total: number; newToday: number; newWeek: number };
      products: { total: number; lowStock: number; outOfStock: number };
      generatedAt: number;
    }>("/api/analytics/dashboard"),
    revenue: (days = 30) => request<Array<{ date: string; revenue: number; orders: number }>>(`/api/analytics/revenue?days=${days}`),
    topProducts: (limit = 10) => request<Array<{ productId: string | null; productName: string; totalSold: number; totalRevenue: number; orderCount: number }>>(`/api/analytics/top-products?limit=${limit}`),
    sources: () => request<Array<{ source: string; count: number; revenue: number }>>("/api/analytics/sources"),
    recentOrders: (limit = 10) => request<Array<{ id: string; orderNumber: string; status: string; total: number; createdAt: string | number; customerName: string; customerPhone: string | null }>>(`/api/analytics/recent-orders?limit=${limit}`),
    lowStock: () => request<AdminProduct[]>("/api/analytics/low-stock"),
    weeklySales: () => request<Array<{ day: string; revenue: number; orders: number }>>("/api/analytics/weekly-sales"),
    salesByCategory: () => request<Array<{ categoryId: string | null; categoryName: string; revenue: number; orderCount: number; itemsSold: number }>>("/api/analytics/sales-by-category"),
    traffic: () => request<Array<{ source: string; label: string; orders: number; revenue: number; customers: number }>>("/api/analytics/traffic"),
    period: (params?: { from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.from) q.set("from", params.from);
      if (params?.to) q.set("to", params.to);
      const qs = q.toString();
      return request<{
        earnings: { total: number; costOfSales: number; deliveryAmount: number; profit: number };
        orders: { total: number; new: number; done: number; cancelled: number };
        clients: { total: number; new: number; returned: number; averageOrder: number };
        range: { from: number; to: number };
      }>(`/api/analytics/period${qs ? `?${qs}` : ""}`);
    },
    ordersByHour: (params?: { from?: string; to?: string }) => {
      const q = new URLSearchParams();
      if (params?.from) q.set("from", params.from);
      if (params?.to) q.set("to", params.to);
      const qs = q.toString();
      return request<Array<{ hour: number; new: number; cancelled: number; completed: number }>>(`/api/analytics/orders-by-hour${qs ? `?${qs}` : ""}`);
    },
    topCustomers: (limit = 10) =>
      request<Array<{ id: string; name: string; username: string | null; phone: string | null; totalSpent: number; orderCount: number; lastOrderAt: number }>>(`/api/analytics/top-customers?limit=${limit}`),
    orderLocations: () =>
      request<Array<{ id: string; orderNumber: string; total: number; address: string; status: string; createdAt: number }>>("/api/analytics/order-locations"),
  },

  payments: {
    list: () => request<Array<{ id: string; orderId: string; orderNumber: string | null; provider: string; providerTxnId: string | null; amount: number; state: string; createdAt: number; updatedAt: number }>>("/api/payments"),
    stats: () => request<Array<{ provider: string; state: string; count: number; total: number }>>("/api/payments/stats"),
  },

  leads: {
    list: (params?: { status?: string; source?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set("status", params.status);
      if (params?.source) q.set("source", params.source);
      if (params?.limit) q.set("limit", String(params.limit));
      const qs = q.toString();
      return request<AdminLead[]>(`/api/leads${qs ? `?${qs}` : ""}`);
    },
    stats: () => request<{
      total: number; new: number; contacted: number; qualified: number; converted: number; lost: number;
      conversionRate: number; wonValue: number; bySource: Record<string, number>;
    }>("/api/leads/stats"),
    bySource: () => request<Array<{ source: string; count: number; value: number }>>("/api/leads/by-source"),
    get: (id: string) => request<AdminLead>(`/api/leads/${id}`),
    create: (body: Partial<AdminLead> & { source: string; name: string }) =>
      request<AdminLead>("/api/leads", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<AdminLead>) =>
      request<AdminLead>(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    remove: (id: string) => request<{ ok: true }>(`/api/leads/${id}`, { method: "DELETE" }),
  },

  settings: {
    getAll: () => request<Record<string, unknown>>("/api/settings"),
    get: <T>(key: string) => request<{ key: string; value: T; updatedAt: number }>(`/api/settings/${encodeURIComponent(key)}`),
    set: (key: string, value: unknown) => request<{ ok: true; key: string }>(`/api/settings/${encodeURIComponent(key)}`, { method: "PUT", body: JSON.stringify({ value }) }),
    remove: (key: string) => request<{ ok: true }>(`/api/settings/${encodeURIComponent(key)}`, { method: "DELETE" }),
  },

  chat: {
    conversations: () => request<Array<{
      tgUserId: string; externalTgUserId: string; firstName: string | null; lastName: string | null;
      username: string | null; phone: string | null;
      lastMessageAt: number | null; lastMessagePreview: string; lastMessageDirection: string | null;
      messageCount: number;
    }>>("/api/chat/conversations"),
    messages: (tgUserId: string) => request<{
      user: { id: string; firstName: string | null; lastName: string | null; username: string | null; phone: string | null };
      messages: Array<{ id: number; direction: string; text: string | null; type: string | null; createdAt: number }>;
    }>(`/api/chat/messages/${tgUserId}`),
    send: (tgUserId: string, text: string) =>
      request<{ id: number; ok: true }>("/api/chat/send", { method: "POST", body: JSON.stringify({ tgUserId, text }) }),
  },

  customers: {
    list: () => request<Array<{
      id: string; tgUserId: string; username: string | null; firstName: string | null; lastName: string | null;
      phone: string | null; languageCode: string | null; createdAt: string | number;
      orderCount: number; totalSpent: number; lastOrderAt: number | null;
    }>>("/api/customers"),
    get: (id: string) => request<{
      id: string; tgUserId: string; username: string | null; firstName: string | null; lastName: string | null;
      phone: string | null; createdAt: string | number; orderCount: number; totalSpent: number;
      orders: AdminOrder[];
    }>(`/api/customers/${id}`),
  },

  integrations: {
    list: () => request<Array<{ id: string; type: string; status: string; lastSyncAt: number | null; createdAt: number }>>("/api/integrations"),
    moysklad: {
      connectToken: (token: string) =>
        request<{ ok: boolean; account?: { name?: string } }>("/api/integrations/moysklad", {
          method: "POST",
          body: JSON.stringify({ type: "token", token }),
        }),
      connectBasic: (login: string, password: string) =>
        request<{ ok: boolean; account?: { name?: string } }>("/api/integrations/moysklad", {
          method: "POST",
          body: JSON.stringify({ type: "basic", login, password }),
        }),
      disconnect: () => request<{ ok: true }>("/api/integrations/moysklad", { method: "DELETE" }),
      sync: () => request<{ ok: boolean; imported: number; updated: number; stockUpdated: number; imagesAdded: number; errors: number }>("/api/integrations/moysklad/sync", { method: "POST" }),
      syncStock: () => request<{ ok: boolean; updated: number }>("/api/integrations/moysklad/sync-stock", { method: "POST" }),
      test: () => request<{ ok: boolean; account?: { name?: string; email?: string } }>("/api/integrations/moysklad/test"),
      logs: (limit = 50) => request<Array<{ id: number; entity: string; status: string; message: string | null; direction: string; createdAt: number }>>(`/api/integrations/moysklad/logs?limit=${limit}`),
      status: () => request<{ connected: boolean; status?: string; lastSyncAt?: number | null; syncedProducts?: number; config?: { organizationId?: string; storeId?: string } }>("/api/integrations/moysklad/status"),
    },
    click: {
      connect: (body: { merchantId: string; serviceId: string; secretKey: string }) =>
        request<{ ok: true }>("/api/payments/click", { method: "POST", body: JSON.stringify(body) }),
      disconnect: () => request<{ ok: true }>("/api/payments/click", { method: "DELETE" }),
    },
    payme: {
      connect: (body: { merchantId: string; merchantKey: string }) =>
        request<{ ok: true }>("/api/payments/payme", { method: "POST", body: JSON.stringify(body) }),
      disconnect: () => request<{ ok: true }>("/api/payments/payme", { method: "DELETE" }),
    },
  },
};

/** WebSocket aloqasi — admin dashboard real-time event'larni qabul qiladi. */
export type ShopEvent =
  | { type: "hello"; shopId: string }
  | { type: "ping"; t: number }
  | { type: "order.created"; shopId: string; order: { id: string; orderNumber: string; total: number; createdAt: string | number } }
  | { type: "order.updated"; shopId: string; orderId: string; status: string }
  | { type: "product.updated"; shopId: string; productId: string }
  | { type: "error"; error: string };

export function connectShopEvents(onEvent: (e: ShopEvent) => void): () => void {
  const tok = getToken();
  if (!tok) return () => { /* */ };
  const wsUrl = API_BASE.replace(/^http/, "ws") + `/api/ws?token=${encodeURIComponent(tok)}`;
  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function open() {
    if (closed) return;
    ws = new WebSocket(wsUrl);
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as ShopEvent;
        onEvent(data);
      } catch { /* */ }
    };
    ws.onclose = () => {
      if (closed) return;
      reconnectTimer = setTimeout(open, 3000);
    };
    ws.onerror = () => { try { ws?.close(); } catch { /* */ } };
  }
  open();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    try { ws?.close(); } catch { /* */ }
  };
}

export function logout() {
  setToken(null);
  if (typeof window !== "undefined") window.location.reload();
}
