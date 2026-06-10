import { api } from "./client";
import type {
  User,
  Tenant,
  Lead,
  Order,
  Product,
  Customer,
  Channel,
  Category,
  Interaction,
  DashboardKPIs,
  PaginatedResponse,
  LeadStatus,
  OrderStatus,
  VitrinaLayout,
  VitrinaBlock,
} from "../types/api";

// ===== Auth =====

export const auth = {
  login: (email: string, password: string, tenantSlug?: string) =>
    api<{ token: string; user: User; tenant: Tenant }>("/auth/login", {
      method: "POST",
      body: { email, password, tenantSlug },
    }),

  register: (data: {
    tenantName: string;
    tenantSlug: string;
    email: string;
    password: string;
    name: string;
  }) =>
    api<{ token: string; user: User; tenant: Tenant }>("/auth/register", {
      method: "POST",
      body: data,
    }),

  me: () => api<{ user: User; tenant: Tenant }>("/auth/me"),
};

// ===== Leads =====

export const leadsApi = {
  list: (params: { status?: LeadStatus; channelId?: string; search?: string; page?: number; pageSize?: number } = {}) =>
    api<PaginatedResponse<Lead>>("/leads", { query: params }),

  stats: () =>
    api<{
      byStatus: { status: LeadStatus; count: number; value: number }[];
      byChannel: {
        channelId: string | null;
        channel: { id: string; name: string; type: string } | null;
        count: number;
        value: number;
      }[];
      wonValue: number;
    }>("/leads/stats"),

  get: (id: string) => api<Lead & { interactions: Interaction[] }>(`/leads/${id}`),

  create: (data: Partial<Lead>) => api<Lead>("/leads", { method: "POST", body: data }),

  update: (id: string, data: Partial<Lead>) =>
    api<Lead>(`/leads/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) => api<{ ok: true }>(`/leads/${id}`, { method: "DELETE" }),

  addInteraction: (id: string, data: Partial<Interaction>) =>
    api<Interaction>(`/leads/${id}/interactions`, { method: "POST", body: data }),
};

// ===== Orders =====

export const ordersApi = {
  list: (params: { status?: OrderStatus; channelId?: string; search?: string; page?: number; pageSize?: number } = {}) =>
    api<PaginatedResponse<Order>>("/orders", { query: params }),

  get: (id: string) => api<Order>(`/orders/${id}`),

  create: (data: {
    customerId?: string;
    channelId?: string;
    status?: OrderStatus;
    notes?: string;
    currency?: string;
    items: { productId: string; qty: number; price: number }[];
  }) => api<Order>("/orders", { method: "POST", body: data }),

  update: (id: string, data: Partial<{ status: OrderStatus; notes: string; assigneeId: string }>) =>
    api<Order>(`/orders/${id}`, { method: "PATCH", body: data }),

  bulk: (data: { ids: string[]; action: "setStatus"; status?: OrderStatus }) =>
    api<{ affected: number; summary: string }>("/orders/bulk", { method: "POST", body: data }),
};

// ===== Products =====

export const productsApi = {
  list: (params: { search?: string; categoryId?: string; page?: number; pageSize?: number } = {}) =>
    api<PaginatedResponse<Product>>("/products", { query: params }),

  create: (data: Partial<Product>) => api<Product>("/products", { method: "POST", body: data }),

  update: (id: string, data: Partial<Product>) =>
    api<Product>(`/products/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) => api<{ ok: true }>(`/products/${id}`, { method: "DELETE" }),

  restock: (id: string, body: { quantity: number; note?: string }) =>
    api<{ id: string; stock: number; added: number }>(`/products/${id}/restock`, {
      method: "POST",
      body,
    }),
};

// ===== Customers =====

export type RfmSegment = "champion" | "loyal" | "new" | "atRisk" | "lost" | "hibernating" | "nobody";

export interface RfmCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  orderCount: number;
  totalSpent: number;
  daysSinceLast: number | null;
  segment: RfmSegment;
}

export const customersApi = {
  list: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
    api<PaginatedResponse<Customer>>("/customers", { query: params }),

  create: (data: Partial<Customer>) => api<Customer>("/customers", { method: "POST", body: data }),

  update: (id: string, data: Partial<Customer>) =>
    api<Customer>(`/customers/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) => api<{ ok: true }>(`/customers/${id}`, { method: "DELETE" }),

  rfm: () =>
    api<{
      customers: RfmCustomer[];
      counts: Record<RfmSegment, number>;
      total: number;
    }>("/customers/rfm"),
};

// ===== Channels =====

export const channelsApi = {
  list: () => api<Channel[]>("/channels"),
  create: (data: Partial<Channel>) => api<Channel>("/channels", { method: "POST", body: data }),
  update: (id: string, data: Partial<Channel>) =>
    api<Channel>(`/channels/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => api<{ ok: true }>(`/channels/${id}`, { method: "DELETE" }),
};

// ===== Categories =====

export const categoriesApi = {
  list: () => api<Category[]>("/categories"),
  create: (data: Partial<Category>) => api<Category>("/categories", { method: "POST", body: data }),
  update: (id: string, data: Partial<Category>) =>
    api<Category>(`/categories/${id}`, { method: "PATCH", body: data }),
  delete: (id: string) => api<{ ok: true }>(`/categories/${id}`, { method: "DELETE" }),
};

// ===== Vitrina =====

export const vitrinaApi = {
  getLayout: () => api<VitrinaLayout>("/vitrina/layout"),
  saveLayout: (data: {
    blocks: VitrinaBlock[];
    brand?: Record<string, unknown>;
    published?: boolean;
    storeMode?: "multi" | "single";
    singleProductId?: string | null;
  }) =>
    api<VitrinaLayout>("/vitrina/layout", { method: "PUT", body: data }),
  saveBrand: (brand: Record<string, unknown>) =>
    api<VitrinaLayout>("/vitrina/brand", { method: "PUT", body: brand }),
};

// ===== Dashboard =====

export type DashboardPeriod = "today" | "week" | "month" | "year" | "all";

export const dashboardApi = {
  kpis: (period?: DashboardPeriod) =>
    api<DashboardKPIs & { returnRate?: { value: number; change: number }; avgOrder?: { value: number; change: number } }>(
      "/dashboard/kpis",
      { query: period ? { period } : {} },
    ),
  revenueTrend: () => api<{ month: string; revenue: number; orders: number }[]>("/dashboard/revenue-trend"),
  weeklySales: () => api<{ day: string; sales: number }[]>("/dashboard/weekly-sales"),
  topProducts: (period?: DashboardPeriod) =>
    api<{ id: string; name: string; category: string | null; price: number; sold: number; stock: number }[]>(
      "/dashboard/top-products",
      { query: period ? { period } : {} },
    ),
  trafficSources: (period?: DashboardPeriod) =>
    api<{ channelId: string | null; source: string; type: string | null; visitors: number; percentage: number }[]>(
      "/dashboard/traffic-sources",
      { query: period ? { period } : {} },
    ),
  salesByCategory: (period?: DashboardPeriod) =>
    api<{ name: string; sales: number; value: number }[]>(
      "/dashboard/sales-by-category",
      { query: period ? { period } : {} },
    ),
  recentOrders: () => api<Order[]>("/dashboard/recent-orders"),
  dailySales: (days = 30) =>
    api<{ day: string; date: string; sales: number; orders: number }[]>(
      "/dashboard/daily-sales",
      { query: { days } },
    ),
  geography: (period?: DashboardPeriod) =>
    api<{ name: string; orders: number; revenue: number }[]>(
      "/dashboard/geography",
      { query: period ? { period } : {} },
    ),
  funnel: (period?: DashboardPeriod) =>
    api<{ stage: string; count: number; dropOff: number }[]>(
      "/dashboard/funnel",
      { query: period ? { period } : {} },
    ),
  customerSegments: () =>
    api<{ name: string; count: number; color: string }[]>("/dashboard/customer-segments"),
};

// ===== MoySklad Integration =====

export interface MoyskladStatus {
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";
  accountName: string | null;
  accountUuid?: string | null;
  connectedAt?: string | null;
  lastSyncAt: string | null;
  lastWebhookAt?: string | null;
  lastError: string | null;
  webhookCount?: number;
}

export interface SyncJob {
  id: string;
  type: "INITIAL_IMPORT" | "INCREMENTAL_PRODUCTS" | "INCREMENTAL_CUSTOMERS" | "INCREMENTAL_ORDERS" | "PUSH_ORDER";
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  progress: number;
  processedItems: number;
  totalItems: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export const moyskladApi = {
  status: () => api<MoyskladStatus>("/moysklad/status"),

  connect: (token: string) =>
    api<{ ok: boolean; status: string; accountName: string | null; accountUuid: string | null }>(
      "/moysklad/connect",
      { method: "POST", body: { token } },
    ),

  disconnect: () => api<{ ok: boolean }>("/moysklad/disconnect", { method: "POST" }),

  startSync: () => api<{ ok: boolean; jobId: string }>("/moysklad/sync", { method: "POST" }),

  getJob: (jobId: string) => api<SyncJob>(`/moysklad/sync/${jobId}`),

  listJobs: () => api<{ jobs: SyncJob[] }>("/moysklad/sync"),

  subscribeWebhooks: () =>
    api<{ ok: boolean; registered: number; errors: string[] }>("/moysklad/webhooks/subscribe", { method: "POST" }),
};

// ===== Sales Doctor =====

export interface SalesDoctorStatus {
  status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";
  domain?: string;
  login?: string;
  lastSyncAt?: string | null;
  lastError?: string | null;
  defaults?: {
    agentSdId: string | null;
    priceTypeSdId: string | null;
    warehouseSdId: string | null;
  };
  statusMap?: Record<string, number> | null;
  pendingRetries?: number;
  failedRetries?: number;
}

export interface SalesDoctorReference {
  id: string;
  name: string;
}

export interface OutboundWebhook {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  active: boolean;
  hasSecret: boolean;
  lastStatus: number | null;
  lastFiredAt: string | null;
  lastError: string | null;
  failureCount: number;
  createdAt: string;
}

export const webhooksApi = {
  list: () =>
    api<{ items: OutboundWebhook[]; availableEvents: string[] }>("/outbound-webhooks"),
  create: (data: { url: string; events: string[]; secret?: string; description?: string }) =>
    api<OutboundWebhook>("/outbound-webhooks", { method: "POST", body: data }),
  update: (id: string, data: Partial<{ url: string; events: string[]; secret: string | null; description: string; active: boolean }>) =>
    api<OutboundWebhook>(`/outbound-webhooks/${id}`, { method: "PATCH", body: data }),
  remove: (id: string) =>
    api<{ ok: true }>(`/outbound-webhooks/${id}`, { method: "DELETE" }),
  test: (id: string) =>
    api<{ ok: boolean; lastStatus: number | null; lastError: string | null }>(`/outbound-webhooks/${id}/test`, { method: "POST" }),
};

export const salesDoctorApi = {
  status: () => api<SalesDoctorStatus>("/salesdoctor/status"),

  connect: (data: { domain: string; login: string; password: string }) =>
    api<{ ok: boolean; status: string; domain: string }>("/salesdoctor/connect", {
      method: "POST",
      body: data,
    }),

  test: () => api<{ ok: boolean; agentCount: number }>("/salesdoctor/test", { method: "POST" }),

  references: () =>
    api<{
      agents: SalesDoctorReference[];
      priceTypes: SalesDoctorReference[];
      warehouses: SalesDoctorReference[];
    }>("/salesdoctor/references"),

  saveDefaults: (data: {
    defaultAgentSdId: string;
    defaultPriceTypeSdId: string;
    defaultWarehouseSdId: string;
    statusMap?: Record<string, number> | null;
  }) => api<{ ok: boolean }>("/salesdoctor/defaults", { method: "POST", body: data }),

  disconnect: () => api<{ ok: boolean }>("/salesdoctor/disconnect", { method: "POST" }),

  pushOrder: (orderId: string) =>
    api<{ ok: boolean }>(`/salesdoctor/push-order/${orderId}`, { method: "POST" }),

  pullCatalog: () =>
    api<{
      ok: boolean;
      customers: { linked: number; created: number };
      products: { linked: number; created: number };
    }>("/salesdoctor/pull-catalog", { method: "POST" }),

  retries: () =>
    api<{
      items: Array<{
        id: string;
        resourceType: string;
        resourceId: string;
        method: string;
        status: string;
        attempts: number;
        lastError: string | null;
        nextAttemptAt: string;
        createdAt: string;
      }>;
    }>("/salesdoctor/retries"),
};
