export interface PlatformProduct {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
  image: string;
  category: string;
  rating: number;
  reviews: number;
  inStock: boolean;
  badge?: string;
}

export interface PlatformOrder {
  id: string;
  customer: string;
  phone: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: "new" | "processing" | "shipped" | "delivered" | "cancelled";
  date: string;
  platform: "telegram" | "website" | "qr_catalog";
  paymentMethod: string;
  address?: string;
}

export interface PlatformStat {
  platform: "telegram" | "website" | "qr_catalog";
  visitors: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  avgOrderValue: number;
  activeUsers: number;
  newUsers: number;
  bounceRate: number;
}

export interface PlatformSetting {
  key: string;
  label: string;
  value: boolean | string | number;
  type: "toggle" | "text" | "number" | "select";
  options?: string[];
}

export const platformProducts: PlatformProduct[] = [];

export const platformOrders: PlatformOrder[] = [];

export const platformStats: PlatformStat[] = [];

export const telegramSettings: PlatformSetting[] = [];

export const websiteSettings: PlatformSetting[] = [];

export const qrSettings: PlatformSetting[] = [];

export const platformDailyStats: { day: string; sales: number; orders: number }[] = [];

export const platformRevenueDaily: { day: string; revenue: number }[] = [];
