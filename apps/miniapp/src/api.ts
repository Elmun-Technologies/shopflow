import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  withCredentials: false,
});

export interface StorefrontProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  priceKopecks: number;
  salePriceKopecks: number | null;
  stockTotal: number;
  unit: string;
  image: string | null;
  category: { name: string; slug: string } | null;
}

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
}

export interface StorefrontOrderItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  priceKopecks: number;
}

export interface StorefrontOrder {
  id: string;
  number: string;
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "CANCELLED";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  totalKopecks: number;
  itemsCount: number;
  items?: StorefrontOrderItem[];
  createdAt: string;
}
