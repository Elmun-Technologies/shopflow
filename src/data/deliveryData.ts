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

export const pharmacies: Pharmacy[] = [
  {
    id: "PH-001",
    name: "ShopFlow - Chilonzor",
    address: "Chilonzor tumani, Bunyodkor ko'chasi, 45-uy",
    city: "Toshkent",
    region: "Toshkent shahri",
    phone: "+998 71 123 45 67",
    workingHours: "08:00 - 22:00",
    lat: 41.2995,
    lng: 69.2401,
    status: "active",
    productsCount: 1245,
    manager: "Dilshod Rahimov",
    hasPickup: true,
    hasDelivery: true,
    deliveryRadius: 15,
    createdAt: "2024-01-15",
  },
  {
    id: "PH-002",
    name: "ShopFlow - Yunusobod",
    address: "Yunusobod tumani, Amir Temur ko'chasi, 102-uy",
    city: "Toshkent",
    region: "Toshkent shahri",
    phone: "+998 71 234 56 78",
    workingHours: "09:00 - 21:00",
    lat: 41.3686,
    lng: 69.2865,
    status: "active",
    productsCount: 987,
    manager: "Malika Yusupova",
    hasPickup: true,
    hasDelivery: true,
    deliveryRadius: 12,
    createdAt: "2024-02-20",
  },
  {
    id: "PH-003",
    name: "ShopFlow - Yakkasaroy",
    address: "Yakkasaroy tumani, Shota Rustaveli ko'chasi, 33-uy",
    city: "Toshkent",
    region: "Toshkent shahri",
    phone: "+998 71 345 67 89",
    workingHours: "08:00 - 23:00",
    lat: 41.2939,
    lng: 69.2497,
    status: "active",
    productsCount: 1567,
    manager: "Azizbek Karimov",
    hasPickup: true,
    hasDelivery: true,
    deliveryRadius: 20,
    createdAt: "2024-01-10",
  },
  {
    id: "PH-004",
    name: "ShopFlow - Samarqand",
    address: "Registon ko'chasi, 18-uy",
    city: "Samarqand",
    region: "Samarqand viloyati",
    phone: "+998 66 123 45 67",
    workingHours: "09:00 - 20:00",
    lat: 39.6542,
    lng: 66.9597,
    status: "active",
    productsCount: 678,
    manager: "Nodira Azimova",
    hasPickup: true,
    hasDelivery: false,
    deliveryRadius: 0,
    createdAt: "2024-03-05",
  },
  {
    id: "PH-005",
    name: "ShopFlow - Farg'ona",
    address: "Marg'ilon ko'chasi, 77-uy",
    city: "Farg'ona",
    region: "Farg'ona viloyati",
    phone: "+998 73 234 56 78",
    workingHours: "09:00 - 21:00",
    lat: 40.3842,
    lng: 71.7843,
    status: "active",
    productsCount: 543,
    manager: "Jasurbek Toshmatov",
    hasPickup: true,
    hasDelivery: false,
    deliveryRadius: 0,
    createdAt: "2024-03-15",
  },
  {
    id: "PH-006",
    name: "ShopFlow - Andijon",
    address: "Babur ko'chasi, 33-uy",
    city: "Andijon",
    region: "Andijon viloyati",
    phone: "+998 74 345 67 89",
    workingHours: "09:00 - 20:00",
    lat: 40.7821,
    lng: 72.3442,
    status: "inactive",
    productsCount: 234,
    manager: "Sherzod Aliyev",
    hasPickup: true,
    hasDelivery: false,
    deliveryRadius: 0,
    createdAt: "2024-04-01",
  },
  {
    id: "PH-007",
    name: "ShopFlow - Buxoro",
    address: "Abdulla Qodiriy ko'chasi, 22-uy",
    city: "Buxoro",
    region: "Buxoro viloyati",
    phone: "+998 65 456 78 90",
    workingHours: "09:00 - 21:00",
    lat: 39.7681,
    lng: 64.4556,
    status: "active",
    productsCount: 456,
    manager: "Otabek Xolmatov",
    hasPickup: true,
    hasDelivery: false,
    deliveryRadius: 0,
    createdAt: "2024-03-20",
  },
];

export const deliveryMethods: DeliveryMethod[] = [
  {
    id: "DEL-pickup",
    code: "pickup",
    name: "Yaqin aptekadan olish",
    nameUz: "Yaqin aptekadan olish",
    description: "Eng yaqin aptekani tanlang va buyurtmani olib keting. QR skanerlash — Sodiqlik.",
    type: "pickup",
    status: "active",
    cost: 0,
    freeFrom: 0,
    stats: {
      totalOrders: 2345,
      totalCost: 0,
      avgTime: 0.5,
      onTimeRate: 98.5,
    },
    lastUpdated: "2026-04-25T10:00:00",
  },
  {
    id: "DEL-fargo",
    code: "fargo",
    name: "FARGO",
    nameUz: "FARGO",
    description: "FARGO kuryer xizmati. Tez va ishonchli yetkazib berish.",
    type: "courier",
    status: "inactive",
    cost: 35000,
    freeFrom: 500000,
    minDays: 1,
    maxDays: 2,
    config: {
      apiKey: "",
      apiUrl: "https://api.fargo.uz",
      webhookUrl: "https://shopflow.uz/api/webhooks/fargo",
      trackingUrl: "https://fargo.uz/track",
    },
    stats: {
      totalOrders: 0,
      totalCost: 0,
      avgTime: 0,
      onTimeRate: 0,
    },
    lastUpdated: "—",
  },
  {
    id: "DEL-yandex",
    code: "yandex",
    name: "Yandex Delivery",
    nameUz: "Yandex Delivery",
    description: "Yandex kuryer xizmati. Shahar ichida tez yetkazib berish.",
    type: "courier",
    status: "inactive",
    cost: 25000,
    freeFrom: 300000,
    minDays: 1,
    maxDays: 1,
    config: {
      apiKey: "",
      apiUrl: "https://b2b.taxi.yandex.net",
      webhookUrl: "https://shopflow.uz/api/webhooks/yandex",
      trackingUrl: "https://yandex.ru/support/delivery",
    },
    stats: {
      totalOrders: 0,
      totalCost: 0,
      avgTime: 0,
      onTimeRate: 0,
    },
    lastUpdated: "—",
  },
  {
    id: "DEL-bts",
    code: "bts",
    name: "BTS Pochta",
    nameUz: "BTS Pochta",
    description: "BTS pochta xizmati. Butun O'zbekiston bo'ylab yetkazib berish.",
    type: "post",
    status: "inactive",
    cost: 20000,
    freeFrom: 500000,
    minDays: 3,
    maxDays: 7,
    config: {
      apiKey: "",
      apiUrl: "https://api.bts.uz",
      webhookUrl: "https://shopflow.uz/api/webhooks/bts",
      trackingUrl: "https://bts.uz/track",
    },
    stats: {
      totalOrders: 0,
      totalCost: 0,
      avgTime: 0,
      onTimeRate: 0,
    },
    lastUpdated: "—",
  },
  {
    id: "DEL-own",
    code: "own",
    name: "O'z kuryerimiz",
    nameUz: "O'z kuryerimiz",
    description: "ShopFlow o'z kuryer xizmati. Toshkent bo'ylab bepul yetkazib berish.",
    type: "courier",
    status: "active",
    cost: 30000,
    freeFrom: 500000,
    minDays: 1,
    maxDays: 1,
    stats: {
      totalOrders: 1876,
      totalCost: 23400000,
      avgTime: 2.5,
      onTimeRate: 94.2,
    },
    lastUpdated: "2026-04-25T08:30:00",
  },
];

export const deliveryOrders: DeliveryOrder[] = [
  { id: "D-001", orderId: "ORD-7523", customer: "Azizbek Karimov", phone: "+998 90 123 45 67", address: "Yakkasaroy, Shota Rustaveli 45", city: "Toshkent", method: "O'z kuryerimiz", pharmacyId: "PH-003", pharmacyName: "ShopFlow - Yakkasaroy", status: "delivered", cost: 0, estimatedDate: "2026-04-25", actualDate: "2026-04-25", courier: "Kuryer #12", createdAt: "2026-04-25 09:00" },
  { id: "D-002", orderId: "ORD-7522", customer: "Michael Chen", phone: "+998 91 234 56 78", address: "Chilonzor, Bunyodkor 12", city: "Toshkent", method: "O'z kuryerimiz", pharmacyId: "PH-001", pharmacyName: "ShopFlow - Chilonzor", status: "shipped", cost: 0, estimatedDate: "2026-04-25", courier: "Kuryer #08", trackingNumber: "SF-2026008", createdAt: "2026-04-25 10:15" },
  { id: "D-003", orderId: "ORD-7521", customer: "Emily Davis", phone: "+998 93 345 67 89", address: "Yunusobod, Amir Temur 88", city: "Toshkent", method: "Yaqin aptekadan olish", pharmacyId: "PH-002", pharmacyName: "ShopFlow - Yunusobod", status: "delivered", cost: 0, estimatedDate: "2026-04-25", actualDate: "2026-04-25", createdAt: "2026-04-25 11:30" },
  { id: "D-004", orderId: "ORD-7520", customer: "James Wilson", phone: "+998 94 456 78 90", address: "Samarqand, Registon 5", city: "Samarqand", method: "Yaqin aptekadan olish", pharmacyId: "PH-004", pharmacyName: "ShopFlow - Samarqand", status: "pending", cost: 0, estimatedDate: "2026-04-26", createdAt: "2026-04-25 12:00" },
  { id: "D-005", orderId: "ORD-7519", customer: "Anna Martinez", phone: "+998 95 567 89 01", address: "Farg'ona, Marg'ilon 22", city: "Farg'ona", method: "Yaqin aptekadan olish", pharmacyId: "PH-005", pharmacyName: "ShopFlow - Farg'ona", status: "delivered", cost: 0, estimatedDate: "2026-04-25", actualDate: "2026-04-25", createdAt: "2026-04-25 08:45" },
  { id: "D-006", orderId: "ORD-7518", customer: "Robert Taylor", phone: "+998 97 678 90 12", address: "Buxoro, Qodiriy 10", city: "Buxoro", method: "Yaqin aptekadan olish", pharmacyId: "PH-007", pharmacyName: "ShopFlow - Buxoro", status: "processing", cost: 0, estimatedDate: "2026-04-25", createdAt: "2026-04-25 13:20" },
  { id: "D-007", orderId: "ORD-7517", customer: "Lisa Anderson", phone: "+998 98 789 01 23", address: "Chilonzor, Bunyodkor 78", city: "Toshkent", method: "O'z kuryerimiz", pharmacyId: "PH-001", pharmacyName: "ShopFlow - Chilonzor", status: "delivered", cost: 0, estimatedDate: "2026-04-25", actualDate: "2026-04-25", courier: "Kuryer #05", createdAt: "2026-04-25 07:30" },
  { id: "D-008", orderId: "ORD-7516", customer: "David Brown", phone: "+998 99 890 12 34", address: "Yunusobod, Amir Temur 156", city: "Toshkent", method: "O'z kuryerimiz", pharmacyId: "PH-002", pharmacyName: "ShopFlow - Yunusobod", status: "cancelled", cost: 0, estimatedDate: "2026-04-25", createdAt: "2026-04-25 14:00" },
  { id: "D-009", orderId: "ORD-7515", customer: "Jennifer Lee", phone: "+998 90 901 23 45", address: "Yakkasaroy, Rustaveli 12", city: "Toshkent", method: "O'z kuryerimiz", pharmacyId: "PH-003", pharmacyName: "ShopFlow - Yakkasaroy", status: "shipped", cost: 0, estimatedDate: "2026-04-25", courier: "Kuryer #15", trackingNumber: "SF-2026015", createdAt: "2026-04-25 15:30" },
  { id: "D-010", orderId: "ORD-7514", customer: "Christopher Moore", phone: "+998 91 012 34 56", address: "Andijon, Babur 8", city: "Andijon", method: "Yaqin aptekadan olish", pharmacyId: "PH-006", pharmacyName: "ShopFlow - Andijon", status: "pending", cost: 0, estimatedDate: "2026-04-26", createdAt: "2026-04-25 16:00" },
];

export const deliveryRegions: DeliveryRegion[] = [
  { region: "Toshkent shahri", city: "Toshkent", cost: 30000, freeFrom: 500000, minDays: 1, maxDays: 1, active: true },
  { region: "Samarqand viloyati", city: "Samarqand", cost: 45000, freeFrom: 700000, minDays: 2, maxDays: 3, active: true },
  { region: "Farg'ona viloyati", city: "Farg'ona", cost: 45000, freeFrom: 700000, minDays: 2, maxDays: 3, active: true },
  { region: "Andijon viloyati", city: "Andijon", cost: 45000, freeFrom: 700000, minDays: 2, maxDays: 3, active: true },
  { region: "Buxoro viloyati", city: "Buxoro", cost: 50000, freeFrom: 800000, minDays: 3, maxDays: 4, active: true },
  { region: "Namangan viloyati", city: "Namangan", cost: 45000, freeFrom: 700000, minDays: 2, maxDays: 3, active: false },
  { region: "Qarshi", city: "Qarshi", cost: 50000, freeFrom: 800000, minDays: 3, maxDays: 4, active: false },
  { region: "Nukus", city: "Nukus", cost: 60000, freeFrom: 1000000, minDays: 4, maxDays: 5, active: false },
];

export const dailyDeliveryStats = [
  { date: "20 Apr", pickup: 45, courier: 32, post: 5 },
  { date: "21 Apr", pickup: 52, courier: 38, post: 3 },
  { date: "22 Apr", pickup: 38, courier: 28, post: 7 },
  { date: "23 Apr", pickup: 61, courier: 45, post: 4 },
  { date: "24 Apr", pickup: 55, courier: 41, post: 6 },
  { date: "25 Apr", pickup: 48, courier: 35, post: 2 },
];

export const methodDeliveryColors: Record<string, string> = {
  "Yaqin aptekadan olish": "#10b981",
  "O'z kuryerimiz": "#3b82f6",
  "FARGO": "#f59e0b",
  "Yandex Delivery": "#ef4444",
  "BTS Pochta": "#8b5cf6",
};
