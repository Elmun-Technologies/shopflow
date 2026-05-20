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
};

// ===== Products =====

export const productsApi = {
  list: (params: { search?: string; categoryId?: string; page?: number; pageSize?: number } = {}) =>
    api<PaginatedResponse<Product>>("/products", { query: params }),

  create: (data: Partial<Product>) => api<Product>("/products", { method: "POST", body: data }),

  update: (id: string, data: Partial<Product>) =>
    api<Product>(`/products/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) => api<{ ok: true }>(`/products/${id}`, { method: "DELETE" }),
};

// ===== Customers =====

export const customersApi = {
  list: (params: { search?: string; page?: number; pageSize?: number } = {}) =>
    api<PaginatedResponse<Customer>>("/customers", { query: params }),

  create: (data: Partial<Customer>) => api<Customer>("/customers", { method: "POST", body: data }),

  update: (id: string, data: Partial<Customer>) =>
    api<Customer>(`/customers/${id}`, { method: "PATCH", body: data }),

  delete: (id: string) => api<{ ok: true }>(`/customers/${id}`, { method: "DELETE" }),
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
  saveLayout: (data: { blocks: VitrinaBlock[]; brand?: Record<string, unknown>; published?: boolean }) =>
    api<VitrinaLayout>("/vitrina/layout", { method: "PUT", body: data }),
  saveBrand: (brand: Record<string, unknown>) =>
    api<VitrinaLayout>("/vitrina/brand", { method: "PUT", body: brand }),
};

// ===== Dashboard =====

export const dashboardApi = {
  kpis: () => api<DashboardKPIs>("/dashboard/kpis"),
  revenueTrend: () => api<{ month: string; revenue: number; orders: number }[]>("/dashboard/revenue-trend"),
  weeklySales: () => api<{ day: string; sales: number }[]>("/dashboard/weekly-sales"),
  topProducts: () =>
    api<{ id: string; name: string; category: string | null; price: number; sold: number; stock: number }[]>(
      "/dashboard/top-products",
    ),
  trafficSources: () =>
    api<{ channelId: string | null; source: string; type: string | null; visitors: number; percentage: number }[]>(
      "/dashboard/traffic-sources",
    ),
  salesByCategory: () =>
    api<{ name: string; sales: number; value: number }[]>("/dashboard/sales-by-category"),
  recentOrders: () => api<Order[]>("/dashboard/recent-orders"),
};
