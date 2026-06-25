export interface CustomerOrder {
  id: string;
  product: string;
  category: string;
  quantity: number;
  price: number;
  total: number;
  status: "completed" | "processing" | "cancelled" | "refunded";
  date: string;
  platform: CustomerPlatform;
}

export interface CustomerActivity {
  id: string;
  type: "order" | "login" | "view" | "review" | "referral" | "bonus" | "ban" | "unban";
  description: string;
  date: string;
  value?: number;
}

export type CustomerPlatform =
  | "telegram_bot"
  | "website"
  | "catalog_site"
  | "instagram"
  | "telegram"
  | "facebook"
  | "whatsapp"
  | "marketplace"
  | "offline"
  | "referral";

export type CustomerStatus = "active" | "vip" | "new" | "banned" | "inactive";

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  avatar: string;
  region: string;
  city: string;
  address: string;
  status: CustomerStatus;
  platform: CustomerPlatform;
  bonusPoints: number;
  totalSpent: number;
  totalOrders: number;
  avgOrderValue: number;
  firstOrderDate: string;
  lastOrderDate: string;
  registeredAt: string;
  notes: string;
  tags: string[];
  orders: CustomerOrder[];
  activities: CustomerActivity[];
  referralCode?: string;
  referredBy?: string;
  birthday?: string;
  gender?: "male" | "female";
}

export const platformLabels: Record<CustomerPlatform, string> = {
  telegram_bot: "Telegram Bot",
  website: "Veb-sayt",
  catalog_site: "Katalog",
  instagram: "Instagram",
  telegram: "Telegram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  marketplace: "Marketplace",
  offline: "Ofline",
  referral: "Referral",
};

export const statusLabels: Record<CustomerStatus, string> = {
  active: "Faol",
  vip: "VIP",
  new: "Yangi",
  banned: "Ban",
  inactive: "Nofaol",
};

// Light admin tema — pastel pill (bg-*-100 + text-*-600), emerald → leaf (brand).
export const statusConfig: Record<CustomerStatus, { color: string; bg: string; icon: string }> = {
  active: { color: "text-leaf-600", bg: "bg-leaf-100 border-leaf-200", icon: "CheckCircle" },
  vip: { color: "text-amber-600", bg: "bg-amber-100 border-amber-200", icon: "Crown" },
  new: { color: "text-blue-600", bg: "bg-blue-100 border-blue-200", icon: "Sparkles" },
  banned: { color: "text-red-600", bg: "bg-red-100 border-red-200", icon: "Ban" },
  inactive: { color: "text-slate-500", bg: "bg-slate-100 border-slate-200", icon: "MinusCircle" },
};

export const regionStats = [];

export const platformStats = [];

export const customers: Customer[] = [];

export const customerStats = {
  total: customers.length,
  active: customers.filter((c) => c.status === "active").length,
  vip: customers.filter((c) => c.status === "vip").length,
  new: customers.filter((c) => c.status === "new").length,
  banned: customers.filter((c) => c.status === "banned").length,
  inactive: customers.filter((c) => c.status === "inactive").length,
  totalSpent: customers.reduce((s, c) => s + c.totalSpent, 0),
  totalOrders: customers.reduce((s, c) => s + c.totalOrders, 0),
  avgLifetime: 245,
};

// ─── Segments (Segmentlar) ───────────────────────────────────────────────────
export type SegmentType = "automatic" | "manual" | "smart";
export type SegmentConditionOperator = "equals" | "not_equals" | "greater_than" | "less_than" | "between" | "contains" | "in_list";

export interface SegmentCondition {
  id: string;
  field: "status" | "totalSpent" | "totalOrders" | "bonusPoints" | "platform" | "region" | "lastOrderDate" | "registeredAt";
  operator: SegmentConditionOperator;
  value: string | number | string[];
  value2?: string | number;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  type: SegmentType;
  conditions: SegmentCondition[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  createdBy: string;
  tags: string[];
}

export const segmentTypeLabels: Record<SegmentType, string> = {
  automatic: "Tizimli",
  manual: "Qo'lda",
  smart: "Aqlli",
};

export const segmentConditionFields: Record<string, string> = {
  status: "Holati",
  totalSpent: "Jami xarid",
  totalOrders: "Buyurtmalar soni",
  bonusPoints: "Bonus balllar",
  platform: "Platform",
  region: "Mintaqa",
  lastOrderDate: "Oxirgi buyurtma",
  registeredAt: "Ro'yxatdan o'tish",
};

export const initialSegments: CustomerSegment[] = [];
