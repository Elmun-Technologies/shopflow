/** Settings moduli — lokal demo ma'lumotlari */

// ─── Settings Tabs ────────────────────────────────────────────────────────────
export type SettingsTab = "profile" | "store" | "notifications" | "integrations" | "security" | "api";

export const settingsTabLabels: Record<SettingsTab, string> = {
  profile: "Profil",
  store: "Do'kon",
  notifications: "Bildirishnomalar",
  integrations: "Integratsiyalar",
  security: "Xavfsizlik",
  api: "API",
};

export const settingsTabIcons: Record<SettingsTab, string> = {
  profile: "User",
  store: "Store",
  notifications: "Bell",
  integrations: "Puzzle",
  security: "Shield",
  api: "Key",
};

export const settingsTabOrder: SettingsTab[] = [
  "profile", "store", "notifications", "integrations", "security", "api",
];

// ─── Profile ──────────────────────────────────────────────────────────────────
export interface ProfileSettings {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
  timezone: string;
  language: string;
}

export const initialProfile: ProfileSettings = {
  firstName: "Nazir",
  lastName: "Elmurodov",
  email: "nazir@shopflow.uz",
  phone: "+998 90 123 45 67",
  role: "Admin",
  avatar: "NE",
  timezone: "Asia/Tashkent (UTC+5)",
  language: "O'zbek",
};

// ─── Store ────────────────────────────────────────────────────────────────────
export interface StoreSettings {
  name: string;
  description: string;
  address: string;
  city: string;
  currency: string;
  language: string;
  logo: string;
  workingHours: string;
  minOrderAmount: number;
  deliveryFee: number;
  freeDeliveryFrom: number;
}

export const initialStore: StoreSettings = {
  name: "ShopFlow",
  description: "Zamonaviy onlayn do'kon — texnika, kiyim, kosmetika va boshqalar",
  address: "Yakkasaroy tumani, Shota Rustaveli ko'chasi 12",
  city: "Toshkent",
  currency: "UZS",
  language: "O'zbek",
  logo: "SF",
  workingHours: "09:00 – 21:00",
  minOrderAmount: 50000,
  deliveryFee: 25000,
  freeDeliveryFrom: 500000,
};

// ─── Notifications ────────────────────────────────────────────────────────────
export interface NotificationGroup {
  id: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
  sms: boolean;
}

export const initialNotifications: NotificationGroup[] = [
  {
    id: "new_order",
    label: "Yangi buyurtma",
    description: "Yangi buyurtma qabul qilinganda xabar berish",
    email: true,
    push: true,
    sms: false,
  },
  {
    id: "order_status",
    label: "Buyurtma holati",
    description: "Buyurtma holati o'zgarganda xabar berish",
    email: true,
    push: true,
    sms: true,
  },
  {
    id: "low_stock",
    label: "Kam qolgan mahsulot",
    description: "Mahsulot miqdori kamaysa ogohlantirish",
    email: true,
    push: false,
    sms: false,
  },
  {
    id: "new_customer",
    label: "Yangi mijoz",
    description: "Yangi mijoz ro'yxatdan o'tganda",
    email: false,
    push: true,
    sms: false,
  },
  {
    id: "review",
    label: "Yangi sharh",
    description: "Mijoz mahsulotga sharh qoldirganda",
    email: true,
    push: true,
    sms: false,
  },
  {
    id: "payment",
    label: "To'lov tasdiqi",
    description: "To'lov muvaffaqiyatli bo'lganda",
    email: true,
    push: true,
    sms: true,
  },
  {
    id: "marketing",
    label: "Marketing kampaniyalar",
    description: "Kampaniya holati va natijalari haqida",
    email: true,
    push: false,
    sms: false,
  },
];

// ─── Integrations ─────────────────────────────────────────────────────────────
export type IntegrationStatus = "connected" | "disconnected" | "error";

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: IntegrationStatus;
  connectedAt?: string;
  color: string;
}

export const initialIntegrations: Integration[] = [
  {
    id: "int-1",
    name: "Telegram Bot",
    description: "Buyurtmalar va bildirishnomalar uchun Telegram bot",
    icon: "Send",
    status: "connected",
    connectedAt: "2026-03-15",
    color: "#0088cc",
  },
  {
    id: "int-2",
    name: "Click",
    description: "Click orqali onlayn to'lovlarni qabul qilish",
    icon: "CreditCard",
    status: "connected",
    connectedAt: "2026-02-20",
    color: "#00b5ad",
  },
  {
    id: "int-3",
    name: "Payme",
    description: "Payme to'lov tizimi integratsiyasi",
    icon: "Wallet",
    status: "connected",
    connectedAt: "2026-02-20",
    color: "#00CCCC",
  },
  {
    id: "int-4",
    name: "Google Analytics",
    description: "Veb-sayt trafiki va foydalanuvchi xulq-atvori",
    icon: "BarChart3",
    status: "connected",
    connectedAt: "2026-01-10",
    color: "#F9AB00",
  },
  {
    id: "int-5",
    name: "Instagram",
    description: "Instagram do'kon va reklama integratsiyasi",
    icon: "Instagram",
    status: "error",
    connectedAt: "2026-04-01",
    color: "#E1306C",
  },
  {
    id: "int-6",
    name: "Uzum Market",
    description: "Uzum marketplace bilan sinxronlash",
    icon: "ShoppingBag",
    status: "disconnected",
    color: "#7C3AED",
  },
  {
    id: "int-7",
    name: "1C Buxgalteriya",
    description: "Hisobchilik tizimi bilan sinxronlash",
    icon: "Calculator",
    status: "disconnected",
    color: "#FCD34D",
  },
];

// ─── Security ─────────────────────────────────────────────────────────────────
export interface LoginHistory {
  id: string;
  device: string;
  location: string;
  ip: string;
  date: string;
  status: "success" | "failed";
}

export const loginHistory: LoginHistory[] = [
  { id: "lh-1", device: "Chrome — macOS", location: "Toshkent, UZ", ip: "192.168.1.45", date: "2026-05-04 23:15", status: "success" },
  { id: "lh-2", device: "Safari — iPhone", location: "Toshkent, UZ", ip: "10.0.0.12", date: "2026-05-04 14:30", status: "success" },
  { id: "lh-3", device: "Firefox — Windows", location: "Samarqand, UZ", ip: "172.16.0.88", date: "2026-05-03 09:45", status: "failed" },
  { id: "lh-4", device: "Chrome — macOS", location: "Toshkent, UZ", ip: "192.168.1.45", date: "2026-05-02 18:20", status: "success" },
  { id: "lh-5", device: "Edge — Windows", location: "Buxoro, UZ", ip: "192.168.2.100", date: "2026-05-01 11:00", status: "success" },
];

export interface SecuritySettings {
  twoFactorEnabled: boolean;
  twoFactorMethod: "sms" | "app" | "none";
  lastPasswordChange: string;
  sessionTimeout: number; // daqiqada
}

export const initialSecurity: SecuritySettings = {
  twoFactorEnabled: true,
  twoFactorMethod: "sms",
  lastPasswordChange: "2026-04-15",
  sessionTimeout: 30,
};

// ─── API Keys ─────────────────────────────────────────────────────────────────
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string;
  permissions: string[];
  active: boolean;
}

export const initialApiKeys: ApiKey[] = [
  {
    id: "ak-1",
    name: "Asosiy API kalit",
    key: "sk_live_SF2026x8k9m2p4q7r1t3v5w8y0z",
    createdAt: "2026-01-15",
    lastUsed: "2026-05-04 22:30",
    permissions: ["orders:read", "orders:write", "products:read", "products:write", "customers:read"],
    active: true,
  },
  {
    id: "ak-2",
    name: "Webhook kalit",
    key: "sk_live_WH2026a3b5c7d9e1f3g5h7i9j1k",
    createdAt: "2026-02-20",
    lastUsed: "2026-05-04 21:15",
    permissions: ["webhooks:read", "webhooks:write"],
    active: true,
  },
  {
    id: "ak-3",
    name: "Test kalit",
    key: "sk_test_TS2026l2m4n6o8p0q2r4s6t8u0v",
    createdAt: "2026-03-10",
    lastUsed: "2026-04-28 10:00",
    permissions: ["orders:read", "products:read"],
    active: false,
  },
];
