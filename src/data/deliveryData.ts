export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  region: string;
  phone: string;
  workingHours: string;
  lat: number;
  lng: number;
  status: "active" | "inactive" | "closed";
  productsCount: number;
  manager: string;
  hasPickup: boolean;
  hasDelivery: boolean;
  deliveryRadius: number; // km
  createdAt: string;
}

export interface DeliveryMethod {
  id: string;
  code: string;
  name: string;
  nameUz: string;
  description: string;
  type: "pickup" | "courier" | "post" | "integration";
  status: "active" | "inactive" | "pending";
  cost: number;
  freeFrom: number;
  minDays?: number;
  maxDays?: number;
  config?: {
    apiKey?: string;
    apiUrl?: string;
    webhookUrl?: string;
    trackingUrl?: string;
  };
  stats: {
    totalOrders: number;
    totalCost: number;
    avgTime: number; // soat
    onTimeRate: number; // foiz
  };
  lastUpdated: string;
}

export interface DeliveryOrder {
  id: string;
  orderId: string;
  customer: string;
  phone: string;
  address: string;
  city: string;
  method: string;
  pharmacyId?: string;
  pharmacyName?: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";
  cost: number;
  estimatedDate: string;
  actualDate?: string;
  courier?: string;
  trackingNumber?: string;
  createdAt: string;
}

export interface DeliveryRegion {
  region: string;
  city: string;
  cost: number;
  freeFrom: number;
  minDays: number;
  maxDays: number;
  active: boolean;
}

export const pharmacies: Pharmacy[] = [];

export const deliveryMethods: DeliveryMethod[] = [];

export const deliveryOrders: DeliveryOrder[] = [];

export const deliveryRegions: DeliveryRegion[] = [];

export const dailyDeliveryStats = [];

export const methodDeliveryColors: Record<string, string> = {
  "Yaqin aptekadan olish": "#10b981",
  "O'z kuryerimiz": "#3b82f6",
  "FARGO": "#f59e0b",
  "Yandex Delivery": "#ef4444",
  "BTS Pochta": "#8b5cf6",
};
