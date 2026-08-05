// Backend bilan birga bo'lgan TypeScript modellar.
// Prisma schema bilan sinxron tutiladi.

export type UserRole = "OWNER" | "ADMIN" | "MANAGER" | "AGENT";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  currency: string;
  deliveryPct?: number; // yetkazib berish narxi foizi (default 3)
  servicePct?: number; // xizmat ko'rsatish narxi foizi (default 15)
}

export type ChannelType =
  | "WEBSITE"
  | "LANDING_PAGE"
  | "INSTAGRAM"
  | "TELEGRAM"
  | "FACEBOOK"
  | "WHATSAPP"
  | "EMAIL"
  | "PHONE"
  | "REFERRAL"
  | "GOOGLE_ADS"
  | "YANDEX_DIRECT"
  | "MARKETPLACE"
  | "OFFLINE";

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  config: Record<string, unknown>;
  webhookKey: string;
  active: boolean;
  createdAt: string;
}

export type LeadStatus =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export type LeadPriority = "HIGH" | "MEDIUM" | "LOW";

export interface Lead {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  position: string | null;
  location: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  value: string | number;
  currency: string;
  notes: string | null;
  tags: string[];
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  channelId: string | null;
  channel?: Pick<Channel, "id" | "type" | "name"> | null;
  assigneeId: string | null;
  assignee?: { id: string; name: string } | null;
  lastContactAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InteractionType =
  | "CALL"
  | "EMAIL"
  | "SMS"
  | "WHATSAPP"
  | "TELEGRAM"
  | "MEETING"
  | "NOTE"
  | "STATUS_CHANGE";

export interface Interaction {
  id: string;
  leadId: string;
  type: InteractionType;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  duration: number | null;
  createdBy: string;
  createdAt: string;
}

export type OrderStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "REFUNDED";

export interface Order {
  id: string;
  code: string;
  status: OrderStatus;
  total: string | number;
  currency: string;
  notes: string | null;
  paid?: boolean;
  paidAt?: string | null;
  customerId: string | null;
  customer?: { id: string; name: string; email: string | null; phone: string | null } | null;
  channelId: string | null;
  channel?: Pick<Channel, "id" | "type" | "name"> | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  productId: string;
  qty: number;
  price: string | number;
  product?: { name: string } | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: string | number;
  oldPrice: string | number | null;
  currency: string;
  stock: number;
  active: boolean;
  featured: boolean;
  imageUrl: string | null;
  images: string[];
  categoryId: string | null;
  category?: { id: string; name: string; slug?: string } | null;
  // Public API (v1) maydonlari — tenant ichida unique slug, kelib chiqishi (origin),
  // va boy marketing kontenti (JSON: flat yoki per-locale {uz,ru}).
  slug?: string | null;
  origin?: string | null;
  content?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  parentId: string | null;
  createdAt: string;
}

export interface VitrinaBlock {
  id: string;
  type: string;
  title: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

// Do'kon turi:
//   multi  — ko'p mahsulotli chakana katalog (default)
//   single — bitta mahsulotga qaratilgan landing
//   b2b    — savatsiz ulgurji rejim: har bir yo'l buyurtma emas, LIDga olib boradi
export type StoreMode = "multi" | "single" | "b2b";

export interface VitrinaLayout {
  id: string;
  tenantId: string;
  blocks: VitrinaBlock[];
  brand: Record<string, unknown>;
  published: boolean;
  storeMode: StoreMode;
  singleProductId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export interface DashboardKPIs {
  revenue: { value: number; change: number };
  orders: { value: number; change: number };
  customers: { value: number; change: number };
  conversion: { value: number; change: number };
}
