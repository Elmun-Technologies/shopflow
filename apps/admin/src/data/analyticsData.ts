/** Analytics moduli — lokal demo ma'lumotlari */

// ─── KPI Cards ────────────────────────────────────────────────────────────────
export interface AnalyticsKPI {
  id: string;
  label: string;
  value: string;
  change: number; // foizda, manfiy bo'lishi mumkin
  trend: "up" | "down" | "flat";
  icon: string;
  color: string;
}

export const analyticsKPIs: AnalyticsKPI[] = [
  { id: "revenue", label: "Umumiy daromad", value: "284 500 000", change: 12.5, trend: "up", icon: "DollarSign", color: "#10b981" },
  { id: "orders", label: "Buyurtmalar", value: "1 247", change: 8.3, trend: "up", icon: "ShoppingCart", color: "#3b82f6" },
  { id: "customers", label: "Mijozlar", value: "3 842", change: 15.2, trend: "up", icon: "Users", color: "#8b5cf6" },
  { id: "avg_check", label: "O'rtacha chek", value: "228 000", change: -2.1, trend: "down", icon: "Receipt", color: "#f59e0b" },
  { id: "conversion", label: "Konversiya", value: "3.8%", change: 0.5, trend: "up", icon: "Target", color: "#ec4899" },
  { id: "returns", label: "Qaytishlar", value: "2.4%", change: -0.8, trend: "down", icon: "RotateCcw", color: "#ef4444" },
];

// ─── Monthly Revenue Trend ────────────────────────────────────────────────────
export interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders: number;
  customers: number;
}

export const monthlyRevenue: MonthlyRevenue[] = [
  { month: "Yan", revenue: 18500000, orders: 82, customers: 245 },
  { month: "Fev", revenue: 21200000, orders: 95, customers: 278 },
  { month: "Mar", revenue: 24800000, orders: 112, customers: 312 },
  { month: "Apr", revenue: 22100000, orders: 98, customers: 290 },
  { month: "May", revenue: 28400000, orders: 128, customers: 356 },
  { month: "Iyn", revenue: 31200000, orders: 142, customers: 398 },
  { month: "Iyl", revenue: 26800000, orders: 118, customers: 340 },
  { month: "Avg", revenue: 29500000, orders: 134, customers: 372 },
  { month: "Sen", revenue: 33100000, orders: 148, customers: 410 },
  { month: "Okt", revenue: 27600000, orders: 122, customers: 345 },
  { month: "Noy", revenue: 35800000, orders: 162, customers: 445 },
  { month: "Dek", revenue: 42500000, orders: 186, customers: 520 },
];

// ─── Top Products ─────────────────────────────────────────────────────────────
export interface TopProduct {
  id: string;
  rank: number;
  name: string;
  category: string;
  sold: number;
  revenue: number;
  growth: number;
}

export const topProducts: TopProduct[] = [
  { id: "tp-1", rank: 1, name: "iPhone 16 Pro Max", category: "Telefonlar", sold: 142, revenue: 2556000000, growth: 24.5 },
  { id: "tp-2", rank: 2, name: "Samsung Galaxy S25 Ultra", category: "Telefonlar", sold: 118, revenue: 1888000000, growth: 18.2 },
  { id: "tp-3", rank: 3, name: "MacBook Air M3", category: "Noutbuklar", sold: 67, revenue: 1139000000, growth: 31.0 },
  { id: "tp-4", rank: 4, name: "AirPods Pro 3", category: "Aksessuarlar", sold: 234, revenue: 936000000, growth: 12.8 },
  { id: "tp-5", rank: 5, name: "Sony WH-1000XM5", category: "Aksessuarlar", sold: 189, revenue: 567000000, growth: 8.4 },
  { id: "tp-6", rank: 6, name: "iPad Air M2", category: "Planshetlar", sold: 78, revenue: 546000000, growth: -3.2 },
  { id: "tp-7", rank: 7, name: "Dyson V15 Detect", category: "Maishiy", sold: 45, revenue: 405000000, growth: 42.1 },
  { id: "tp-8", rank: 8, name: "Nike Air Max 90", category: "Kiyim", sold: 312, revenue: 374400000, growth: 5.6 },
  { id: "tp-9", rank: 9, name: "Samsung Galaxy Watch 6", category: "Aksessuarlar", sold: 156, revenue: 312000000, growth: 15.3 },
  { id: "tp-10", rank: 10, name: "JBL Flip 6", category: "Aksessuarlar", sold: 278, revenue: 278000000, growth: -1.4 },
];

// ─── Traffic Sources ──────────────────────────────────────────────────────────
export interface TrafficSource {
  name: string;
  visitors: number;
  percentage: number;
  color: string;
  conversions: number;
}

export const trafficSources: TrafficSource[] = [
  { name: "Instagram", visitors: 18420, percentage: 32.4, color: "#E1306C", conversions: 892 },
  { name: "Telegram", visitors: 12860, percentage: 22.6, color: "#0088cc", conversions: 645 },
  { name: "Google", visitors: 9340, percentage: 16.4, color: "#4285F4", conversions: 412 },
  { name: "To'g'ridan-to'g'ri", visitors: 8210, percentage: 14.4, color: "#10b981", conversions: 356 },
  { name: "Facebook", visitors: 4890, percentage: 8.6, color: "#1877F2", conversions: 189 },
  { name: "Boshqa", visitors: 3180, percentage: 5.6, color: "#64748b", conversions: 98 },
];

// ─── Category Sales ───────────────────────────────────────────────────────────
export interface CategorySale {
  category: string;
  sales: number;
  revenue: number;
  color: string;
  growth: number;
}

export const categorySales: CategorySale[] = [
  { category: "Telefonlar", sales: 342, revenue: 4788000000, color: "#3b82f6", growth: 18.5 },
  { category: "Noutbuklar", sales: 128, revenue: 2176000000, color: "#8b5cf6", growth: 24.2 },
  { category: "Aksessuarlar", sales: 856, revenue: 1284000000, color: "#f59e0b", growth: 9.3 },
  { category: "Kiyim", sales: 534, revenue: 640800000, color: "#ec4899", growth: 5.1 },
  { category: "Maishiy", sales: 167, revenue: 500100000, color: "#10b981", growth: 38.4 },
  { category: "Sport", sales: 223, revenue: 334500000, color: "#ef4444", growth: -2.8 },
  { category: "Kitoblar", sales: 412, revenue: 164800000, color: "#06b6d4", growth: 12.7 },
];

// ─── Geography ────────────────────────────────────────────────────────────────
export interface GeoData {
  city: string;
  orders: number;
  revenue: number;
  percentage: number;
}

export const geographyData: GeoData[] = [
  { city: "Toshkent", orders: 542, revenue: 125800000, percentage: 43.5 },
  { city: "Samarqand", orders: 186, revenue: 42100000, percentage: 14.9 },
  { city: "Buxoro", orders: 134, revenue: 31200000, percentage: 10.7 },
  { city: "Namangan", orders: 98, revenue: 22400000, percentage: 7.9 },
  { city: "Andijon", orders: 87, revenue: 19800000, percentage: 7.0 },
  { city: "Farg'ona", orders: 76, revenue: 17200000, percentage: 6.1 },
  { city: "Nukus", orders: 52, revenue: 11800000, percentage: 4.2 },
  { city: "Boshqalar", orders: 72, revenue: 14200000, percentage: 5.7 },
];

// ─── Conversion Funnel ────────────────────────────────────────────────────────
export interface FunnelStep {
  stage: string;
  count: number;
  percentage: number;
  color: string;
  dropOff: number;
}

export const conversionFunnel: FunnelStep[] = [
  { stage: "Saytga tashrif", count: 56800, percentage: 100, color: "#3b82f6", dropOff: 0 },
  { stage: "Mahsulotni ko'rish", count: 32400, percentage: 57.0, color: "#8b5cf6", dropOff: 43.0 },
  { stage: "Savatga qo'shish", count: 8640, percentage: 15.2, color: "#f59e0b", dropOff: 73.3 },
  { stage: "To'lov boshlash", count: 4120, percentage: 7.3, color: "#ec4899", dropOff: 52.3 },
  { stage: "Buyurtma berish", count: 2158, percentage: 3.8, color: "#10b981", dropOff: 47.6 },
];

// ─── Customer Segments ────────────────────────────────────────────────────────
export interface CustomerSegment {
  name: string;
  count: number;
  percentage: number;
  revenue: number;
  color: string;
  avgOrders: number;
}

export const customerSegments: CustomerSegment[] = [
  { name: "VIP mijozlar", count: 245, percentage: 6.4, revenue: 98000000, color: "#f59e0b", avgOrders: 8.2 },
  { name: "Qaytib kelganlar", count: 1280, percentage: 33.3, revenue: 128000000, color: "#10b981", avgOrders: 3.4 },
  { name: "Yangi mijozlar", count: 1842, percentage: 47.9, revenue: 42000000, color: "#3b82f6", avgOrders: 1.2 },
  { name: "Yo'qolganlar", count: 475, percentage: 12.4, revenue: 0, color: "#ef4444", avgOrders: 0 },
];

// ─── Daily Sales (Hafta) ──────────────────────────────────────────────────────
export interface DailySale {
  day: string;
  orders: number;
  revenue: number;
}

export const dailySales: DailySale[] = [
  { day: "Dush", orders: 42, revenue: 9800000 },
  { day: "Sesh", orders: 38, revenue: 8600000 },
  { day: "Chor", orders: 45, revenue: 10200000 },
  { day: "Pay", orders: 51, revenue: 11500000 },
  { day: "Jum", orders: 67, revenue: 15200000 },
  { day: "Shan", orders: 72, revenue: 16800000 },
  { day: "Yak", orders: 55, revenue: 12400000 },
];

// ─── Time Range ───────────────────────────────────────────────────────────────
export type AnalyticsTimeRange = "today" | "week" | "month" | "year" | "all";

export const timeRangeLabels: Record<AnalyticsTimeRange, string> = {
  today: "Bugun",
  week: "Hafta",
  month: "Oy",
  year: "Yil",
  all: "Hammasi",
};
