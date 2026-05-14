import axios from "axios";
import WebApp from "@twa-dev/sdk";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  // Forward Telegram WebApp initData so the API can verify and resolve the customer.
  const initData = WebApp.initData;
  if (initData) {
    config.headers.set?.("X-Telegram-Init-Data", initData);
  }
  return config;
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
