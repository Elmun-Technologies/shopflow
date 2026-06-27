/** Settings moduli — lokal demo ma'lumotlari */

// ─── Settings Tabs ────────────────────────────────────────────────────────────
export type SettingsTab = "profile" | "store" | "team" | "notifications" | "integrations" | "api";

export const settingsTabLabels: Record<SettingsTab, string> = {
  profile: "Profil",
  store: "Do'kon",
  team: "Jamoa",
  notifications: "Bildirishnomalar",
  integrations: "Integratsiyalar",
  api: "API",
};

export const settingsTabIcons: Record<SettingsTab, string> = {
  profile: "User",
  store: "Store",
  team: "Users",
  notifications: "Bell",
  integrations: "Puzzle",
  api: "Key",
};

export const settingsTabOrder: SettingsTab[] = ["profile", "store", "team", "notifications", "integrations", "api"];

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

export const initialNotifications: NotificationGroup[] = [];

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

export const initialIntegrations: Integration[] = [];

// ─── Security ─────────────────────────────────────────────────────────────────
export interface LoginHistory {
  id: string;
  device: string;
  location: string;
  ip: string;
  date: string;
  status: "success" | "failed";
}

export const loginHistory: LoginHistory[] = [];

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

export const initialApiKeys: ApiKey[] = [];
