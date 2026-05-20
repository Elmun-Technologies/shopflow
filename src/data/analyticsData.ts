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

export const analyticsKPIs: AnalyticsKPI[] = [];

// ─── Monthly Revenue Trend ────────────────────────────────────────────────────
export interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders: number;
  customers: number;
}

export const monthlyRevenue: MonthlyRevenue[] = [];

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

export const topProducts: TopProduct[] = [];

// ─── Traffic Sources ──────────────────────────────────────────────────────────
export interface TrafficSource {
  name: string;
  visitors: number;
  percentage: number;
  color: string;
  conversions: number;
}

export const trafficSources: TrafficSource[] = [];

// ─── Category Sales ───────────────────────────────────────────────────────────
export interface CategorySale {
  category: string;
  sales: number;
  revenue: number;
  color: string;
  growth: number;
}

export const categorySales: CategorySale[] = [];

// ─── Geography ────────────────────────────────────────────────────────────────
export interface GeoData {
  city: string;
  orders: number;
  revenue: number;
  percentage: number;
}

export const geographyData: GeoData[] = [];

// ─── Conversion Funnel ────────────────────────────────────────────────────────
export interface FunnelStep {
  stage: string;
  count: number;
  percentage: number;
  color: string;
  dropOff: number;
}

export const conversionFunnel: FunnelStep[] = [];

// ─── Customer Segments ────────────────────────────────────────────────────────
export interface CustomerSegment {
  name: string;
  count: number;
  percentage: number;
  revenue: number;
  color: string;
  avgOrders: number;
}

export const customerSegments: CustomerSegment[] = [];

// ─── Daily Sales (Hafta) ──────────────────────────────────────────────────────
export interface DailySale {
  day: string;
  orders: number;
  revenue: number;
}

export const dailySales: DailySale[] = [];

// ─── Time Range ───────────────────────────────────────────────────────────────
export type AnalyticsTimeRange = "today" | "week" | "month" | "year" | "all";

export const timeRangeLabels: Record<AnalyticsTimeRange, string> = {
  today: "Bugun",
  week: "Hafta",
  month: "Oy",
  year: "Yil",
  all: "Hammasi",
};
