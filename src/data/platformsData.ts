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

export const platformProducts: PlatformProduct[] = [
  { id: "p1", name: "iPhone 15 Pro Max", price: 14500000, oldPrice: 15200000, image: "phone", category: "Telefonlar", rating: 4.9, reviews: 128, inStock: true, badge: "Chegirma" },
  { id: "p2", name: "Samsung Galaxy S24", price: 13200000, image: "phone", category: "Telefonlar", rating: 4.7, reviews: 89, inStock: true },
  { id: "p3", name: "MacBook Air M3", price: 18500000, oldPrice: 19500000, image: "laptop", category: "Noutbuklar", rating: 4.8, reviews: 56, inStock: true, badge: "Top" },
  { id: "p4", name: "AirPods Pro 2", price: 3200000, image: "headphones", category: "Aksessuarlar", rating: 4.6, reviews: 234, inStock: true },
  { id: "p5", name: "Erkaklar ko'ylagi", price: 285000, oldPrice: 350000, image: "shirt", category: "Kiyim", rating: 4.3, reviews: 45, inStock: true, badge: "-20%" },
  { id: "p6", name: "Ayollar kiyimi", price: 420000, image: "dress", category: "Kiyim", rating: 4.5, reviews: 67, inStock: true },
  { id: "p7", name: "Nestle Sut 1L", price: 18500, image: "milk", category: "Oziq-ovqat", rating: 4.6, reviews: 412, inStock: true },
  { id: "p8", name: "LG Xolodilnik", price: 8900000, oldPrice: 9900000, image: "fridge", category: "Maishiy", rating: 4.7, reviews: 23, inStock: true, badge: "Aksiya" },
  { id: "p9", name: "Nike Pegasus 40", price: 1850000, image: "shoes", category: "Sport", rating: 4.6, reviews: 78, inStock: true },
  { id: "p10", name: "Harry Potter to'plami", price: 450000, oldPrice: 520000, image: "book", category: "Kitoblar", rating: 4.9, reviews: 156, inStock: true, badge: "Chegirma" },
  { id: "p11", name: "Lego City", price: 890000, image: "toy", category: "O'yinchoqlar", rating: 4.8, reviews: 89, inStock: true },
  { id: "p12", name: "Artel Konditsioner", price: 4200000, image: "ac", category: "Maishiy", rating: 4.2, reviews: 34, inStock: true },
];

export const platformOrders: PlatformOrder[] = [
  { id: "TGB-001", customer: "Azizbek K.", phone: "+998901234567", items: [{ name: "iPhone 15 Pro Max", qty: 1, price: 14500000 }], total: 14500000, status: "delivered", date: "2024-12-15", platform: "telegram", paymentMethod: "Click", address: "Toshkent, Yakkasaroy" },
  { id: "TGB-002", customer: "Nodira A.", phone: "+998912345678", items: [{ name: "Ayollar kiyimi", qty: 2, price: 420000 }, { name: "AirPods Pro 2", qty: 1, price: 3200000 }], total: 4040000, status: "processing", date: "2024-12-15", platform: "telegram", paymentMethod: "Payme" },
  { id: "WEB-001", customer: "Jasurbek T.", phone: "+998933456789", items: [{ name: "MacBook Air M3", qty: 1, price: 18500000 }], total: 18500000, status: "shipped", date: "2024-12-14", platform: "website", paymentMethod: "Karta", address: "Samarqand" },
  { id: "WEB-002", customer: "Gulnora S.", phone: "+998944567890", items: [{ name: "Erkaklar ko'ylagi", qty: 3, price: 285000 }, { name: "Nestle Sut 1L", qty: 12, price: 18500 }], total: 1077000, status: "new", date: "2024-12-15", platform: "website", paymentMethod: "Naqd" },
  { id: "QR-001", customer: "Bekzod M.", phone: "+998955678901", items: [{ name: "LG Xolodilnik", qty: 1, price: 8900000 }], total: 8900000, status: "delivered", date: "2024-12-13", platform: "qr_catalog", paymentMethod: "Uzum" },
  { id: "QR-002", customer: "Dilnoza R.", phone: "+998976789012", items: [{ name: "Lego City", qty: 2, price: 890000 }], total: 1780000, status: "processing", date: "2024-12-14", platform: "qr_catalog", paymentMethod: "Click" },
  { id: "TGB-003", customer: "Sherzod A.", phone: "+998987890123", items: [{ name: "Nike Pegasus 40", qty: 1, price: 1850000 }], total: 1850000, status: "cancelled", date: "2024-12-12", platform: "telegram", paymentMethod: "Payme" },
  { id: "WEB-003", customer: "Zarina U.", phone: "+998998901234", items: [{ name: "Harry Potter to'plami", qty: 1, price: 450000 }, { name: "Nestle Sut 1L", qty: 6, price: 18500 }], total: 561000, status: "delivered", date: "2024-12-11", platform: "website", paymentMethod: "Karta" },
];

export const platformStats: PlatformStat[] = [
  { platform: "telegram", visitors: 2340, orders: 156, revenue: 487500000, conversionRate: 6.7, avgOrderValue: 3125000, activeUsers: 456, newUsers: 78, bounceRate: 23 },
  { platform: "website", visitors: 4560, orders: 289, revenue: 892000000, conversionRate: 6.3, avgOrderValue: 3086000, activeUsers: 1234, newUsers: 156, bounceRate: 31 },
  { platform: "qr_catalog", visitors: 890, orders: 67, revenue: 156000000, conversionRate: 7.5, avgOrderValue: 2328000, activeUsers: 123, newUsers: 34, bounceRate: 18 },
];

export const telegramSettings: PlatformSetting[] = [
  { key: "bot_active", label: "Bot faol", value: true, type: "toggle" },
  { key: "webapp_active", label: "Web App faol", value: true, type: "toggle" },
  { key: "auto_reply", label: "Avto javob", value: true, type: "toggle" },
  { key: "welcome_message", label: "Salomlashish xabari", value: "Assalomu alaykum! ShopFlow botiga xush kelibsiz.", type: "text" },
  { key: "min_order", label: "Minimal buyurtma", value: 50000, type: "number" },
  { key: "delivery_cost", label: "Yetkazib berish narxi", value: 30000, type: "number" },
  { key: "free_delivery_from", label: "Bepul yetkazib berish", value: 500000, type: "number" },
  { key: "payment_methods", label: "To'lov usullari", value: "Click, Payme, Uzum, Naqd", type: "text" },
];

export const websiteSettings: PlatformSetting[] = [
  { key: "site_active", label: "Sayt faol", value: true, type: "toggle" },
  { key: "registration", label: "Ro'yxatdan o'tish", value: true, type: "toggle" },
  { key: "guest_checkout", label: "Mehmon sifatida sotib olish", value: true, type: "toggle" },
  { key: "reviews", label: "Sharhlar yoqilgan", value: true, type: "toggle" },
  { key: "wishlist", label: "Sevimlilar ro'yxati", value: true, type: "toggle" },
  { key: "theme", label: "Mavzu", value: "dark", type: "select", options: ["dark", "light", "auto"] },
  { key: "currency", label: "Valyuta", value: "UZS", type: "select", options: ["UZS", "USD", "RUB"] },
];

export const qrSettings: PlatformSetting[] = [
  { key: "qr_active", label: "QR katalog faol", value: true, type: "toggle" },
  { key: "quick_order", label: "Tezkor buyurtma", value: true, type: "toggle" },
  { key: "show_prices", label: "Narxlar ko'rsatilsin", value: true, type: "toggle" },
  { key: "show_stock", label: "Zaxira ko'rsatilsin", value: true, type: "toggle" },
  { key: "whatsapp_order", label: "WhatsApp orqali buyurtma", value: true, type: "toggle" },
];

export const platformDailyStats = [
  { day: "Dush", telegram: 12, website: 23, qr: 4 },
  { day: "Sesh", telegram: 18, website: 31, qr: 6 },
  { day: "Chor", telegram: 15, website: 28, qr: 5 },
  { day: "Pay", telegram: 22, website: 35, qr: 8 },
  { day: "Juma", telegram: 28, website: 42, qr: 9 },
  { day: "Shan", telegram: 35, website: 48, qr: 12 },
  { day: "Yak", telegram: 20, website: 25, qr: 7 },
];

export const platformRevenueDaily = [
  { day: "Dush", telegram: 45000000, website: 89000000, qr: 12000000 },
  { day: "Sesh", telegram: 62000000, website: 112000000, qr: 18000000 },
  { day: "Chor", telegram: 54000000, website: 98000000, qr: 15000000 },
  { day: "Pay", telegram: 78000000, website: 135000000, qr: 22000000 },
  { day: "Juma", telegram: 95000000, website: 168000000, qr: 28000000 },
  { day: "Shan", telegram: 112000000, website: 195000000, qr: 35000000 },
  { day: "Yak", telegram: 68000000, website: 102000000, qr: 19000000 },
];
