export interface CustomerOrder {
  id: string;
  product: string;
  category: string;
  quantity: number;
  price: number;
  total: number;
  status: "completed" | "processing" | "cancelled" | "refunded";
  date: string;
  platform: CustomerPlatform;
}

export interface CustomerActivity {
  id: string;
  type: "order" | "login" | "view" | "review" | "referral" | "bonus" | "ban" | "unban";
  description: string;
  date: string;
  value?: number;
}

export type CustomerPlatform =
  | "telegram_bot"
  | "website"
  | "catalog_site"
  | "instagram"
  | "telegram"
  | "facebook"
  | "whatsapp"
  | "marketplace"
  | "offline"
  | "referral";

export type CustomerStatus = "active" | "vip" | "new" | "banned" | "inactive";

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  avatar: string;
  region: string;
  city: string;
  address: string;
  status: CustomerStatus;
  platform: CustomerPlatform;
  bonusPoints: number;
  totalSpent: number;
  totalOrders: number;
  avgOrderValue: number;
  firstOrderDate: string;
  lastOrderDate: string;
  registeredAt: string;
  notes: string;
  tags: string[];
  orders: CustomerOrder[];
  activities: CustomerActivity[];
  referralCode?: string;
  referredBy?: string;
  birthday?: string;
  gender?: "male" | "female";
}

export const platformLabels: Record<CustomerPlatform, string> = {
  telegram_bot: "Telegram Bot",
  website: "Veb-sayt",
  catalog_site: "Katalog",
  instagram: "Instagram",
  telegram: "Telegram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  marketplace: "Marketplace",
  offline: "Ofline",
  referral: "Referral",
};

export const statusLabels: Record<CustomerStatus, string> = {
  active: "Faol",
  vip: "VIP",
  new: "Yangi",
  banned: "Ban",
  inactive: "Nofaol",
};

export const statusConfig: Record<CustomerStatus, { color: string; bg: string; icon: string }> = {
  active: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: "CheckCircle" },
  vip: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: "Crown" },
  new: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: "Sparkles" },
  banned: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: "Ban" },
  inactive: { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/20", icon: "MinusCircle" },
};

export const regionStats = [
  { region: "Toshkent", count: 342, spent: 456000000 },
  { region: "Samarqand", count: 89, spent: 98000000 },
  { region: "Farg'ona", count: 67, spent: 72000000 },
  { region: "Andijon", count: 54, spent: 58000000 },
  { region: "Namangan", count: 43, spent: 45000000 },
  { region: "Buxoro", count: 38, spent: 41000000 },
  { region: "Qarshi", count: 31, spent: 34000000 },
  { region: "Nukus", count: 22, spent: 28000000 },
  { region: "Xiva", count: 18, spent: 21000000 },
  { region: "Guliston", count: 15, spent: 18000000 },
];

export const platformStats = [
  { platform: "telegram_bot" as CustomerPlatform, count: 234, percent: 31 },
  { platform: "website" as CustomerPlatform, count: 178, percent: 24 },
  { platform: "catalog_site" as CustomerPlatform, count: 98, percent: 13 },
  { platform: "instagram" as CustomerPlatform, count: 87, percent: 12 },
  { platform: "telegram" as CustomerPlatform, count: 56, percent: 7 },
  { platform: "whatsapp" as CustomerPlatform, count: 34, percent: 5 },
  { platform: "facebook" as CustomerPlatform, count: 28, percent: 4 },
  { platform: "marketplace" as CustomerPlatform, count: 21, percent: 3 },
  { platform: "offline" as CustomerPlatform, count: 7, percent: 1 },
];

export const customers: Customer[] = [
  {
    id: "CUS-10001",
    firstName: "Azizbek",
    lastName: "Karimov",
    phone: "+998 90 123 45 67",
    email: "aziz.karimov@gmail.com",
    avatar: "AK",
    region: "Toshkent",
    city: "Yakkasaroy",
    address: "Shota Rustaveli ko'chasi, 45-uy, 12-xonadon",
    status: "vip",
    platform: "telegram_bot",
    bonusPoints: 12500,
    totalSpent: 48750000,
    totalOrders: 24,
    avgOrderValue: 2031250,
    firstOrderDate: "2023-03-15",
    lastOrderDate: "2024-12-14",
    registeredAt: "2023-03-10",
    notes: "Doimiy mijoz. Katta hajmli buyurtmalar. Tez orada yana bog'lanadi.",
    tags: ["vip", "doimiy", "yirik"],
    referralCode: "AZIZ15",
    birthday: "1988-05-12",
    gender: "male",
    orders: [
      { id: "ORD-7501", product: "iPhone 15 Pro Max 256GB", category: "Elektronika", quantity: 2, price: 14500000, total: 29000000, status: "completed", date: "2024-12-14", platform: "telegram_bot" },
      { id: "ORD-7423", product: "MacBook Air M3 15\"", category: "Elektronika", quantity: 1, price: 18500000, total: 18500000, status: "completed", date: "2024-11-28", platform: "telegram_bot" },
      { id: "ORD-7356", product: "AirPods Pro 2", category: "Elektronika", quantity: 3, price: 3200000, total: 9600000, status: "completed", date: "2024-11-10", platform: "website" },
      { id: "ORD-7289", product: "Samsung Galaxy S24 Ultra", category: "Elektronika", quantity: 1, price: 13200000, total: 13200000, status: "completed", date: "2024-10-22", platform: "telegram_bot" },
      { id: "ORD-7102", product: "iPad Pro 12.9\"", category: "Elektronika", quantity: 1, price: 15800000, total: 15800000, status: "completed", date: "2024-09-15", platform: "telegram_bot" },
    ],
    activities: [
      { id: "ACT-001", type: "order", description: "Buyurtma #ORD-7501 - iPhone 15 Pro Max", date: "2024-12-14 10:30", value: 29000000 },
      { id: "ACT-002", type: "bonus", description: "Bonus ballar yechib olindi - 5000 ball", date: "2024-12-14 10:35", value: 5000 },
      { id: "ACT-003", type: "login", description: "Telegram bot orqali tizimga kirdi", date: "2024-12-13 18:45" },
      { id: "ACT-004", type: "view", description: "MacBook Air sahifasini ko'rdi", date: "2024-12-13 18:50" },
      { id: "ACT-005", type: "order", description: "Buyurtma #ORD-7423 - MacBook Air M3", date: "2024-11-28 14:20", value: 18500000 },
      { id: "ACT-006", type: "referral", description: "Referral orqali yangi mijoz: Bekzod Mirzaev", date: "2024-11-20 09:15" },
    ],
  },
  {
    id: "CUS-10002",
    firstName: "Nodira",
    lastName: "Azimova",
    phone: "+998 91 234 56 78",
    email: "nodira.azimova@gmail.com",
    avatar: "NA",
    region: "Toshkent",
    city: "Mirzo-Ulug'bek",
    address: "Mustaqillik shoh ko'chasi, 102-uy",
    status: "active",
    platform: "website",
    bonusPoints: 4200,
    totalSpent: 21500000,
    totalOrders: 12,
    avgOrderValue: 1791667,
    firstOrderDate: "2024-01-20",
    lastOrderDate: "2024-12-13",
    registeredAt: "2024-01-15",
    notes: "Kiyim-kechak bo'limining doimiy mijozi. Har oy buyurtma beradi.",
    tags: ["doimiy", "kiyim"],
    birthday: "1995-08-23",
    gender: "female",
    orders: [
      { id: "ORD-7512", product: "Ayollar yengil kiyimi", category: "Kiyim-kechak", quantity: 3, price: 420000, total: 1260000, status: "completed", date: "2024-12-13", platform: "website" },
      { id: "ORD-7445", product: "Ko'ylak va yubka to'plami", category: "Kiyim-kechak", quantity: 2, price: 680000, total: 1360000, status: "completed", date: "2024-11-30", platform: "website" },
      { id: "ORD-7389", product: "Kozok ko'ylagi", category: "Kiyim-kechak", quantity: 4, price: 285000, total: 1140000, status: "completed", date: "2024-11-15", platform: "catalog_site" },
      { id: "ORD-7201", product: "Sport kiyimlari", category: "Sport", quantity: 2, price: 450000, total: 900000, status: "completed", date: "2024-10-05", platform: "website" },
    ],
    activities: [
      { id: "ACT-010", type: "order", description: "Buyurtma #ORD-7512 - Ayollar yengil kiyimi", date: "2024-12-13 16:00", value: 1260000 },
      { id: "ACT-011", type: "review", description: "5 yulduzli baho qoldirdi - Ayollar yengil kiyimi", date: "2024-12-13 16:30" },
      { id: "ACT-012", type: "login", description: "Veb-sayt orqali tizimga kirdi", date: "2024-12-12 20:10" },
    ],
  },
  {
    id: "CUS-10003",
    firstName: "Jasurbek",
    lastName: "Toshmatov",
    phone: "+998 93 345 67 89",
    email: "jasur.toshmatov@mail.ru",
    avatar: "JT",
    region: "Samarqand",
    city: "Samarqand",
    address: "Registon ko'chasi, 18-uy",
    status: "active",
    platform: "telegram",
    bonusPoints: 1800,
    totalSpent: 12800000,
    totalOrders: 8,
    avgOrderValue: 1600000,
    firstOrderDate: "2024-05-10",
    lastOrderDate: "2024-12-12",
    registeredAt: "2024-05-05",
    notes: "Sport anjomlari bo'yicha doimiy mijoz. Maktab va sport zallar uchun optom buyurtma beradi.",
    tags: ["optom", "sport", "ta'lim"],
    gender: "male",
    orders: [
      { id: "ORD-7508", product: "Dumbbell Set 20kg", category: "Sport", quantity: 5, price: 520000, total: 2600000, status: "completed", date: "2024-12-12", platform: "telegram" },
      { id: "ORD-7434", product: "Nike Air Zoom Pegasus 40", category: "Sport", quantity: 3, price: 1850000, total: 5550000, status: "completed", date: "2024-11-25", platform: "telegram" },
      { id: "ORD-7312", product: "Yoga Mat Premium", category: "Sport", quantity: 10, price: 180000, total: 1800000, status: "completed", date: "2024-10-18", platform: "telegram" },
    ],
    activities: [
      { id: "ACT-020", type: "order", description: "Buyurtma #ORD-7508 - Dumbbell Set 20kg x5", date: "2024-12-12 11:00", value: 2600000 },
      { id: "ACT-021", type: "login", description: "Telegram orqali tizimga kirdi", date: "2024-12-11 09:30" },
    ],
  },
  {
    id: "CUS-10004",
    firstName: "Gulnora",
    lastName: "Saidova",
    phone: "+998 94 456 78 90",
    email: "gulnora.saidova@yandex.ru",
    avatar: "GS",
    region: "Farg'ona",
    city: "Farg'ona",
    address: "Marg'ilon ko'chasi, 77-uy",
    status: "new",
    platform: "instagram",
    bonusPoints: 0,
    totalSpent: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    firstOrderDate: "",
    lastOrderDate: "",
    registeredAt: "2024-12-15",
    notes: "Instagram reklama orqali ro'yxatdan o'tdi. Hali buyurtma bermagan.",
    tags: ["yangi", "instagram"],
    gender: "female",
    orders: [],
    activities: [
      { id: "ACT-030", type: "login", description: "Instagram orqali ro'yxatdan o'tdi", date: "2024-12-15 07:30" },
      { id: "ACT-031", type: "view", description: "Kiyim-kechak kategoriyasini ko'rdi", date: "2024-12-15 07:35" },
    ],
  },
  {
    id: "CUS-10005",
    firstName: "Bekzod",
    lastName: "Mirzaev",
    phone: "+998 95 567 89 01",
    email: "bekzod.mirzaev@outlook.com",
    avatar: "BM",
    region: "Toshkent",
    city: "Chilonzor",
    address: "Bunyodkor ko'chasi, 154-uy, 45-xonadon",
    status: "vip",
    platform: "referral",
    bonusPoints: 8900,
    totalSpent: 67800000,
    totalOrders: 18,
    avgOrderValue: 3766667,
    firstOrderDate: "2024-02-01",
    lastOrderDate: "2024-12-10",
    registeredAt: "2024-02-01",
    notes: "Azizbek Karimov referral orqali kelgan. Ofis jihozlari bo'yicha yirik mijoz.",
    tags: ["vip", "yirik", "referral"],
    referredBy: "CUS-10001",
    referralCode: "BEKZOD20",
    birthday: "1985-11-03",
    gender: "male",
    orders: [
      { id: "ORD-7498", product: "MacBook Air M3 15\"", category: "Elektronika", quantity: 5, price: 18500000, total: 92500000, status: "completed", date: "2024-12-10", platform: "telegram_bot" },
      { id: "ORD-7401", product: "HP LaserJet Printer", category: "Elektronika", quantity: 3, price: 2800000, total: 8400000, status: "completed", date: "2024-11-15", platform: "telegram_bot" },
      { id: "ORD-7323", product: "Dell Monitor 27\"", category: "Elektronika", quantity: 5, price: 4200000, total: 21000000, status: "completed", date: "2024-10-28", platform: "telegram_bot" },
    ],
    activities: [
      { id: "ACT-040", type: "order", description: "Buyurtma #ORD-7498 - MacBook Air M3 x5", date: "2024-12-10 17:00", value: 92500000 },
      { id: "ACT-041", type: "bonus", description: "Referral bonus: 2000 ball", date: "2024-12-10 17:05", value: 2000 },
      { id: "ACT-042", type: "login", description: "Telegram bot orqali tizimga kirdi", date: "2024-12-09 14:20" },
    ],
  },
  {
    id: "CUS-10006",
    firstName: "Dilnoza",
    lastName: "Rahimova",
    phone: "+998 97 678 90 12",
    email: "dilnoza.r@icloud.com",
    avatar: "DR",
    region: "Andijon",
    city: "Andijon",
    address: "Babur ko'chasi, 33-uy",
    status: "active",
    platform: "facebook",
    bonusPoints: 2100,
    totalSpent: 15600000,
    totalOrders: 10,
    avgOrderValue: 1560000,
    firstOrderDate: "2024-06-15",
    lastOrderDate: "2024-12-14",
    registeredAt: "2024-06-10",
    notes: "Bolalar o'yinchoqlari va kitoblar bo'yicha doimiy mijoz.",
    tags: ["doimiy", "bolalar"],
    gender: "female",
    orders: [
      { id: "ORD-7515", product: "Lego City Police Station", category: "O'yinchoqlar", quantity: 2, price: 890000, total: 1780000, status: "completed", date: "2024-12-14", platform: "facebook" },
      { id: "ORD-7456", product: "Harry Potter to'plami", category: "Kitoblar", quantity: 3, price: 450000, total: 1350000, status: "completed", date: "2024-12-01", platform: "website" },
      { id: "ORD-7387", product: "Barbie Dreamhouse", category: "O'yinchoqlar", quantity: 1, price: 1200000, total: 1200000, status: "completed", date: "2024-11-20", platform: "facebook" },
    ],
    activities: [
      { id: "ACT-050", type: "order", description: "Buyurtma #ORD-7515 - Lego City x2", date: "2024-12-14 12:00", value: 1780000 },
      { id: "ACT-051", type: "review", description: "4 yulduzli baho qoldirdi", date: "2024-12-14 12:30" },
    ],
  },
  {
    id: "CUS-10007",
    firstName: "Sherzod",
    lastName: "Aliyev",
    phone: "+998 98 789 01 23",
    email: "sherzod.aliev@bk.ru",
    avatar: "SA",
    region: "Namangan",
    city: "Namangan",
    address: "Islom Karimov ko'chasi, 91-uy",
    status: "banned",
    platform: "whatsapp",
    bonusPoints: 0,
    totalSpent: 3200000,
    totalOrders: 2,
    avgOrderValue: 1600000,
    firstOrderDate: "2024-08-10",
    lastOrderDate: "2024-09-05",
    registeredAt: "2024-08-05",
    notes: "Buyurtmani qabul qilib, to'lamay qo'ygan. 2 marta qayta buyurtma bergan va yana to'lamagan.",
    tags: ["ban", "qarzdor"],
    gender: "male",
    orders: [
      { id: "ORD-7234", product: "Samsung Galaxy A54", category: "Elektronika", quantity: 1, price: 4200000, total: 4200000, status: "cancelled", date: "2024-09-05", platform: "whatsapp" },
      { id: "ORD-7156", product: "Xiaomi Redmi Note 13", category: "Elektronika", quantity: 1, price: 3200000, total: 3200000, status: "cancelled", date: "2024-08-15", platform: "whatsapp" },
    ],
    activities: [
      { id: "ACT-060", type: "ban", description: "Mijoz ban qilindi - to'lamaslik sababli", date: "2024-09-10 10:00" },
      { id: "ACT-061", type: "order", description: "Buyurtma #ORD-7234 - Bekor qilindi", date: "2024-09-05 14:00" },
    ],
  },
  {
    id: "CUS-10008",
    firstName: "Zarina",
    lastName: "Umarova",
    phone: "+998 99 890 12 34",
    email: "zarina.umarova@gmail.com",
    avatar: "ZU",
    region: "Qarshi",
    city: "Qarshi",
    address: "Navoiy ko'chasi, 56-uy",
    status: "new",
    platform: "catalog_site",
    bonusPoints: 500,
    totalSpent: 1800000,
    totalOrders: 1,
    avgOrderValue: 1800000,
    firstOrderDate: "2024-12-15",
    lastOrderDate: "2024-12-15",
    registeredAt: "2024-12-15",
    notes: "Katalog sayt orqali birinchi buyurtma. Yetkazib berish kutilmoqda.",
    tags: ["yangi", "katalog"],
    gender: "female",
    orders: [
      { id: "ORD-7525", product: "Erkaklar kozok ko'ylagi", category: "Kiyim-kechak", quantity: 4, price: 285000, total: 1140000, status: "processing", date: "2024-12-15", platform: "catalog_site" },
      { id: "ORD-7525-2", product: "Ayollar yengil kiyimi", category: "Kiyim-kechak", quantity: 2, price: 330000, total: 660000, status: "processing", date: "2024-12-15", platform: "catalog_site" },
    ],
    activities: [
      { id: "ACT-070", type: "order", description: "Birinchi buyurtma #ORD-7525", date: "2024-12-15 08:30", value: 1800000 },
      { id: "ACT-071", type: "login", description: "Katalog sayt orqali ro'yxatdan o'tdi", date: "2024-12-15 08:15" },
    ],
  },
  {
    id: "CUS-10009",
    firstName: "Otabek",
    lastName: "Xolmatov",
    phone: "+998 90 901 23 45",
    email: "otabek.xolmatov@mail.ru",
    avatar: "OX",
    region: "Buxoro",
    city: "Buxoro",
    address: "Abdulla Qodiriy ko'chasi, 22-uy",
    status: "active",
    platform: "marketplace",
    bonusPoints: 3400,
    totalSpent: 24500000,
    totalOrders: 14,
    avgOrderValue: 1750000,
    firstOrderDate: "2024-04-01",
    lastOrderDate: "2024-12-11",
    registeredAt: "2024-03-25",
    notes: "Uzum Marketplace orqali doimiy buyurtma beradi. Maishiy texnika yoqtiradi.",
    tags: ["doimiy", "marketplace", "texnika"],
    gender: "male",
    orders: [
      { id: "ORD-7518", product: "Artel Air Conditioner 12", category: "Maishiy texnika", quantity: 2, price: 4200000, total: 8400000, status: "completed", date: "2024-12-11", platform: "marketplace" },
      { id: "ORD-7445", product: "LG Inverter Xolodilnik", category: "Maishiy texnika", quantity: 1, price: 8900000, total: 8900000, status: "completed", date: "2024-11-22", platform: "marketplace" },
      { id: "ORD-7367", product: "Artel Mikroto'lqinli pech", category: "Maishiy texnika", quantity: 1, price: 1800000, total: 1800000, status: "completed", date: "2024-10-30", platform: "marketplace" },
    ],
    activities: [
      { id: "ACT-080", type: "order", description: "Buyurtma #ORD-7518 - Artel AC x2", date: "2024-12-11 09:00", value: 8400000 },
      { id: "ACT-081", type: "review", description: "5 yulduzli baho - Artel AC", date: "2024-12-12 10:00" },
    ],
  },
  {
    id: "CUS-10010",
    firstName: "Madina",
    lastName: "Tursunova",
    phone: "+998 91 012 34 56",
    email: "madina.tursunova@yahoo.com",
    avatar: "MT",
    region: "Toshkent",
    city: "Yunusobod",
    address: "Amir Temur ko'chasi, 200-uy, 8-xonadon",
    status: "inactive",
    platform: "telegram_bot",
    bonusPoints: 600,
    totalSpent: 4500000,
    totalOrders: 3,
    avgOrderValue: 1500000,
    firstOrderDate: "2024-07-10",
    lastOrderDate: "2024-09-20",
    registeredAt: "2024-07-05",
    notes: "3 oy davomida faol emas. Yangi chegirmalar haqida xabar yuborish kerak.",
    tags: ["nofaol", "qayta_aktivlash"],
    gender: "female",
    orders: [
      { id: "ORD-7312", product: "Nestle Sut 1L", category: "Oziq-ovqat", quantity: 24, price: 18500, total: 444000, status: "completed", date: "2024-09-20", platform: "telegram_bot" },
      { id: "ORD-7256", product: "Coca-Cola 1.5L", category: "Oziq-ovqat", quantity: 12, price: 12000, total: 144000, status: "completed", date: "2024-08-15", platform: "telegram_bot" },
    ],
    activities: [
      { id: "ACT-090", type: "order", description: "Buyurtma #ORD-7312", date: "2024-09-20 11:00", value: 444000 },
      { id: "ACT-091", type: "login", description: "Tizimga kirdi", date: "2024-09-20 10:45" },
    ],
  },
  {
    id: "CUS-10011",
    firstName: "Kamoliddin",
    lastName: "Ismoilov",
    phone: "+998 93 123 45 67",
    email: "kamoliddin.ismoilov@gmail.com",
    avatar: "KI",
    region: "Samarqand",
    city: "Kattaqo'rg'on",
    address: "Alisher Navoiy ko'chasi, 8-uy",
    status: "active",
    platform: "website",
    bonusPoints: 5600,
    totalSpent: 31200000,
    totalOrders: 16,
    avgOrderValue: 1950000,
    firstOrderDate: "2024-02-20",
    lastOrderDate: "2024-12-09",
    registeredAt: "2024-02-15",
    notes: "Ta'lim markazi uchun optom buyurtmalar. Har doim vaqtida to'laydi.",
    tags: ["doimiy", "optom", "ta'lim"],
    gender: "male",
    orders: [
      { id: "ORD-7510", product: "Samsung Galaxy Tab S9", category: "Elektronika", quantity: 5, price: 6800000, total: 34000000, status: "completed", date: "2024-12-09", platform: "website" },
      { id: "ORD-7421", product: "Logitech Mouse Wireless", category: "Elektronika", quantity: 10, price: 280000, total: 2800000, status: "completed", date: "2024-11-18", platform: "website" },
    ],
    activities: [
      { id: "ACT-100", type: "order", description: "Buyurtma #ORD-7510 - Galaxy Tab S9 x5", date: "2024-12-09 13:00", value: 34000000 },
      { id: "ACT-101", type: "bonus", description: "Loyalty bonus: 1500 ball", date: "2024-12-09 13:05", value: 1500 },
    ],
  },
  {
    id: "CUS-10012",
    firstName: "Nilufar",
    lastName: "Xasanova",
    phone: "+998 94 234 56 78",
    email: "nilufar.xasanova@mail.ru",
    avatar: "NX",
    region: "Toshkent",
    city: "Shayxontohur",
    address: "Chorsu bozori, 45-do'kon",
    status: "active",
    platform: "offline",
    bonusPoints: 1200,
    totalSpent: 8900000,
    totalOrders: 7,
    avgOrderValue: 1271429,
    firstOrderDate: "2024-09-01",
    lastOrderDate: "2024-12-15",
    registeredAt: "2024-09-01",
    notes: "Ofline do'kondan kelgan mijoz. Keyin onlayn ham buyurtma berdi.",
    tags: ["offline", "do'kon"],
    gender: "female",
    orders: [
      { id: "ORD-7524", product: "Oziq-ovqat to'plami", category: "Oziq-ovqat", quantity: 1, price: 450000, total: 450000, status: "completed", date: "2024-12-15", platform: "offline" },
      { id: "ORD-7489", product: "Maishiy texnika to'plami", category: "Maishiy texnika", quantity: 1, price: 3200000, total: 3200000, status: "completed", date: "2024-12-01", platform: "telegram_bot" },
    ],
    activities: [
      { id: "ACT-110", type: "order", description: "Ofline buyurtma #ORD-7524", date: "2024-12-15 15:00", value: 450000 },
    ],
  },
];

export const customerStats = {
  total: customers.length,
  active: customers.filter((c) => c.status === "active").length,
  vip: customers.filter((c) => c.status === "vip").length,
  new: customers.filter((c) => c.status === "new").length,
  banned: customers.filter((c) => c.status === "banned").length,
  inactive: customers.filter((c) => c.status === "inactive").length,
  totalSpent: customers.reduce((s, c) => s + c.totalSpent, 0),
  totalOrders: customers.reduce((s, c) => s + c.totalOrders, 0),
  avgLifetime: 245,
};

// ─── Segments (Segmentlar) ───────────────────────────────────────────────────
export type SegmentType = "automatic" | "manual" | "smart";
export type SegmentConditionOperator = "equals" | "not_equals" | "greater_than" | "less_than" | "between" | "contains" | "in_list";

export interface SegmentCondition {
  id: string;
  field: "status" | "totalSpent" | "totalOrders" | "bonusPoints" | "platform" | "region" | "lastOrderDate" | "registeredAt";
  operator: SegmentConditionOperator;
  value: string | number | string[];
  value2?: string | number;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  type: SegmentType;
  conditions: SegmentCondition[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  active: boolean;
  createdBy: string;
  tags: string[];
}

export const segmentTypeLabels: Record<SegmentType, string> = {
  automatic: "Tizimli",
  manual: "Qo'lda",
  smart: "Aqlli",
};

export const segmentConditionFields: Record<string, string> = {
  status: "Holati",
  totalSpent: "Jami xarid",
  totalOrders: "Buyurtmalar soni",
  bonusPoints: "Bonus balllar",
  platform: "Platform",
  region: "Mintaqa",
  lastOrderDate: "Oxirgi buyurtma",
  registeredAt: "Ro'yxatdan o'tish",
};

export const initialSegments: CustomerSegment[] = [
  {
    id: "SEG-001",
    name: "Kamida bir marta xarid qilgan",
    description: "Hech bo'lmaganda bir marta buyurtma berilgan faqat faol mijozlar",
    type: "automatic",
    conditions: [
      { id: "cond-1", field: "totalOrders", operator: "greater_than", value: 0 },
      { id: "cond-2", field: "status", operator: "equals", value: "active" },
    ],
    memberCount: 456,
    createdAt: "2024-03-15",
    updatedAt: "2025-05-08",
    active: true,
    createdBy: "Admin",
    tags: ["faol", "doimiy"],
  },
  {
    id: "SEG-002",
    name: "Qayta xarid qilmaydigan mijozlar",
    description: "6 oydan ko'p vaqt xarid qilmaydigan mustakmalakin mijozlar",
    type: "smart",
    conditions: [
      { id: "cond-3", field: "lastOrderDate", operator: "less_than", value: "2024-11-08" },
      { id: "cond-4", field: "status", operator: "not_equals", value: "banned" },
    ],
    memberCount: 123,
    createdAt: "2024-05-20",
    updatedAt: "2025-05-08",
    active: true,
    createdBy: "Admin",
    tags: ["nofaol", "qayta-tajolapchi"],
  },
  {
    id: "SEG-003",
    name: "VIP mijozlar",
    description: "Yuqori xarid qiluvchi va daromadli mijozlar",
    type: "automatic",
    conditions: [
      { id: "cond-5", field: "status", operator: "equals", value: "vip" },
    ],
    memberCount: 78,
    createdAt: "2024-02-10",
    updatedAt: "2025-05-06",
    active: true,
    createdBy: "Admin",
    tags: ["vip", "premium", "yirik"],
  },
  {
    id: "SEG-004",
    name: "Telegram Bot foydalanuvchilari",
    description: "Telegram botida ro'yxatdan o'tgan barcha mijozlar",
    type: "automatic",
    conditions: [
      { id: "cond-6", field: "platform", operator: "equals", value: "telegram_bot" },
    ],
    memberCount: 234,
    createdAt: "2024-04-05",
    updatedAt: "2025-05-01",
    active: true,
    createdBy: "Admin",
    tags: ["telegram", "bot"],
  },
  {
    id: "SEG-005",
    name: "Yangi mijozlar (oxirgi 30 kun)",
    description: "Oxirgi 30 kun ichida ro'yxatdan o'tgan yangi mijozlar",
    type: "smart",
    conditions: [
      { id: "cond-7", field: "registeredAt", operator: "greater_than", value: "2025-04-08" },
    ],
    memberCount: 42,
    createdAt: "2024-06-12",
    updatedAt: "2025-05-08",
    active: true,
    createdBy: "Admin",
    tags: ["yangi", "onboarding"],
  },
  {
    id: "SEG-006",
    name: "100,000,000 so'mdan ortiq sarflagan",
    description: "Jami xarid qiymati 100 million so'mdan ortiq mijozlar",
    type: "automatic",
    conditions: [
      { id: "cond-8", field: "totalSpent", operator: "greater_than", value: 100000000 },
    ],
    memberCount: 67,
    createdAt: "2024-01-25",
    updatedAt: "2025-05-07",
    active: true,
    createdBy: "Admin",
    tags: ["premium", "daromad"],
  },
  {
    id: "SEG-007",
    name: "Toshkent va Samarqand",
    description: "Toshkent va Samarqand mintaqalarining mijozlari",
    type: "manual",
    conditions: [
      { id: "cond-9", field: "region", operator: "in_list", value: ["Toshkent", "Samarqand"] },
    ],
    memberCount: 431,
    createdAt: "2024-03-30",
    updatedAt: "2025-04-28",
    active: true,
    createdBy: "Admin",
    tags: ["mintaqa", "shahar"],
  },
  {
    id: "SEG-008",
    name: "Ishlamayotgan segment",
    description: "Test segmenti",
    type: "manual",
    conditions: [],
    memberCount: 0,
    createdAt: "2025-04-15",
    updatedAt: "2025-04-15",
    active: false,
    createdBy: "Admin",
    tags: ["test"],
  },
];
