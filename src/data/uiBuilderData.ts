// Block settings are dynamic per block type. We use `any` here intentionally
// because each block type has different settings (count, title, color, etc.),
// and a strict union would require duplicating each block's settings shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface UIBlock {
  id: string;
  type: BlockType;
  title: string;
  enabled: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: Record<string, any>;
}

export type BlockType =
  | "hero_banner"
  | "new_products"
  | "discounts"
  | "trending"
  | "bestsellers"
  | "preorder"
  | "category_products"
  | "flash_sale"
  | "product_of_day"
  | "recommended"
  | "popular_categories"
  | "categories_grid"
  | "categories_2x2"
  | "banner"
  | "stories"
  | "announcement"
  | "search"
  | "header"
  | "footer";

export interface BlockDefinition {
  type: BlockType;
  category: "products" | "navigation" | "media" | "system";
  label: string;
  description: string;
  icon: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultSettings: Record<string, any>;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  blocks: UIBlock[];
  previewColor: string;
}

export interface BrandSettings {
  name: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  borderRadius: string;
  productCardStyle: "compact" | "standard" | "large";
  categoryStyle: "list" | "grid" | "circle";
  socialLinks: { platform: string; url: string }[];
  phone: string;
  email: string;
  address: string;
}

export const blockDefinitions: BlockDefinition[] = [
  {
    type: "hero_banner",
    category: "media",
    label: "Banner",
    description: "Navigatsiyali banner",
    icon: "Image",
    defaultSettings: { title: "Yangi kolleksiya", subtitle: "20% chegirma", buttonText: "Ko'rish", bgColor: "#10b981" },
  },
  {
    type: "new_products",
    category: "products",
    label: "Yangi mahsulotlar",
    description: "Yangi mahsulotlar to'ri",
    icon: "Sparkles",
    defaultSettings: { count: 4, title: "Yangi kelganlar", showBadge: true },
  },
  {
    type: "discounts",
    category: "products",
    label: "Chegirmalar",
    description: "Chegirmadagi mahsulotlar",
    icon: "Percent",
    defaultSettings: { count: 4, title: "Chegirmalar", showTimer: false },
  },
  {
    type: "trending",
    category: "products",
    label: "Trendlar",
    description: "Ommabop mahsulotlar",
    icon: "TrendingUp",
    defaultSettings: { count: 4, title: "Trenddagi mahsulotlar" },
  },
  {
    type: "bestsellers",
    category: "products",
    label: "Bestseller",
    description: "Eng ko'p sotiladigan mahsulotlar",
    icon: "Crown",
    defaultSettings: { count: 4, title: "Bestsellerlar" },
  },
  {
    type: "preorder",
    category: "products",
    label: "Oldindan buyurtma",
    description: "Oldindan buyurtma mahsulotlari",
    icon: "Calendar",
    defaultSettings: { count: 4, title: "Oldindan buyurtma" },
  },
  {
    type: "category_products",
    category: "products",
    label: "Kategoriya mahsulotlari",
    description: "Kategoriya mahsulotlari",
    icon: "Grid3X3",
    defaultSettings: { category: "Telefonlar", count: 4, title: "Telefonlar" },
  },
  {
    type: "flash_sale",
    category: "products",
    label: "Tezkor chegirma",
    description: "Ortga hisoblash taymeri bilan chegirmali mahsulotlar",
    icon: "Zap",
    defaultSettings: { count: 4, title: "Tezkor chegirma", endTime: "2024-12-31T23:59" },
  },
  {
    type: "product_of_day",
    category: "products",
    label: "Kun mahsuloti",
    description: "Taymer, chegirma va mavjudlik shkalasi bilan bitta mahsulot",
    icon: "Sun",
    defaultSettings: { title: "Kun mahsuloti", showStockBar: true },
  },
  {
    type: "recommended",
    category: "products",
    label: "Siz uchun",
    description: "Ko'rilgan mahsulotlarga asoslangan shaxsiy tavsiyalar",
    icon: "Heart",
    defaultSettings: { count: 4, title: "Siz uchun tavsiyalar" },
  },
  {
    type: "popular_categories",
    category: "navigation",
    label: "Ommabop kategoriyalar",
    description: "Rasmli tanlangan kategoriyalar",
    icon: "LayoutGrid",
    defaultSettings: { count: 6, title: "Ommabop kategoriyalar" },
  },
  {
    type: "categories_grid",
    category: "navigation",
    label: "Kategoriyalar",
    description: "Barcha mahsulot kategoriyalari",
    icon: "List",
    defaultSettings: { title: "Kategoriyalar" },
  },
  {
    type: "categories_2x2",
    category: "navigation",
    label: "Kategoriyalar to'ri",
    description: "Rasmli tanlangan kategoriyalar 2×2 to'ri",
    icon: "LayoutTemplate",
    defaultSettings: { count: 4, title: "Kategoriyalar" },
  },
  {
    type: "stories",
    category: "media",
    label: "Shoppable Stories",
    description: "Mahsulotli sotish hikoyalari",
    icon: "Play",
    defaultSettings: { title: "Hikoyalar" },
  },
  {
    type: "announcement",
    category: "media",
    label: "E'lon",
    description: "Matnli e'lon bilan harakatlanuvchi qator",
    icon: "Megaphone",
    defaultSettings: { text: "Bepul yetkazib berish 500,000 so'mdan boshlab!", bgColor: "#f59e0b" },
  },
  {
    type: "search",
    category: "system",
    label: "Qidiruv",
    description: "Mahsulot qidiruv paneli",
    icon: "Search",
    defaultSettings: { placeholder: "Qidirish..." },
  },
];

export const templates: Template[] = [
  {
    id: "vitamins",
    name: "Vitaminlar va BADlar",
    description: "Ishonchga asoslangan: banner, ommabop kategoriyalar, bestseller, kategoriya tanlovlari va kun mahsuloti",
    category: "Salomatlik",
    previewColor: "#10b981",
    blocks: [
      { id: "b1", type: "hero_banner", title: "Banner", enabled: true, settings: { title: "Sog'lom hayot", subtitle: "Vitaminlar 15% chegirma", buttonText: "Ko'rish" } },
      { id: "b2", type: "popular_categories", title: "Ommabop kategoriyalar", enabled: true, settings: { count: 6, title: "Kategoriyalar" } },
      { id: "b3", type: "bestsellers", title: "Bestseller", enabled: true, settings: { count: 4, title: "Eng ko'p sotiladigan" } },
      { id: "b4", type: "category_products", title: "Kategoriya mahsulotlari", enabled: true, settings: { category: "Vitaminlar", count: 4, title: "Vitaminlar" } },
      { id: "b5", type: "product_of_day", title: "Kun mahsuloti", enabled: true, settings: { title: "Kun mahsuloti" } },
      { id: "b6", type: "discounts", title: "Chegirmalar", enabled: true, settings: { count: 4, title: "Chegirmalar" } },
      { id: "b7", type: "new_products", title: "Yangi mahsulotlar", enabled: true, settings: { count: 4, title: "Yangi kelganlar" } },
      { id: "b8", type: "recommended", title: "Siz uchun", enabled: true, settings: { count: 4, title: "Siz uchun" } },
      { id: "b9", type: "announcement", title: "E'lon", enabled: true, settings: { text: "Bepul yetkazib berish!" } },
    ],
  },
  {
    id: "books",
    name: "Kitoblar",
    description: "Kashfiyotlarga asoslangan: slaydli banner, kategoriyalar, trendlar, janr tanlovlari va oldindan buyurtma",
    category: "Kitoblar",
    previewColor: "#8b5cf6",
    blocks: [
      { id: "b1", type: "hero_banner", title: "Banner", enabled: true, settings: { title: "Yangi kitoblar", subtitle: "Har hafta yangilanadi" } },
      { id: "b2", type: "categories_grid", title: "Kategoriyalar", enabled: true, settings: { title: "Janrlar" } },
      { id: "b3", type: "trending", title: "Trendlar", enabled: true, settings: { count: 4, title: "Trenddagi kitoblar" } },
      { id: "b4", type: "category_products", title: "Kategoriya mahsulotlari", enabled: true, settings: { category: "Badiiy", count: 4, title: "Badiiy adabiyot" } },
      { id: "b5", type: "preorder", title: "Oldindan buyurtma", enabled: true, settings: { count: 4, title: "Tezda chiqadi" } },
      { id: "b6", type: "bestsellers", title: "Bestseller", enabled: true, settings: { count: 4, title: "Bestsellerlar" } },
      { id: "b7", type: "discounts", title: "Chegirmalar", enabled: true, settings: { count: 4, title: "Chegirmali kitoblar" } },
      { id: "b8", type: "stories", title: "Shoppable Stories", enabled: true, settings: { title: "Mashhur mualliflar" } },
      { id: "b9", type: "recommended", title: "Siz uchun", enabled: true, settings: { count: 4, title: "Sizga mos" } },
      { id: "b10", type: "announcement", title: "E'lon", enabled: true, settings: { text: "Kitob xarid qiling, 2-chisini 50% chegirma oling!" } },
    ],
  },
  {
    id: "clothing",
    name: "Kiyimlar",
    description: "Vizual uslub FOMO bilan: hikoyalar, trendlar, kolleksiya tanlovlari, tezkor chegirma va kategoriya to'ri",
    category: "Moda",
    previewColor: "#ec4899",
    blocks: [
      { id: "b1", type: "stories", title: "Shoppable Stories", enabled: true, settings: { title: "Kolleksiyalar" } },
      { id: "b2", type: "hero_banner", title: "Banner", enabled: true, settings: { title: "Yozgi kolleksiya", subtitle: "30% gacha chegirma" } },
      { id: "b3", type: "trending", title: "Trendlar", enabled: true, settings: { count: 4, title: "Trenddagi kiyimlar" } },
      { id: "b4", type: "categories_2x2", title: "Kategoriyalar to'ri", enabled: true, settings: { count: 4, title: "Kategoriyalar" } },
      { id: "b5", type: "flash_sale", title: "Tezkor chegirma", enabled: true, settings: { count: 4, title: "24 soatgacha!" } },
      { id: "b6", type: "new_products", title: "Yangi mahsulotlar", enabled: true, settings: { count: 4, title: "Yangi kelganlar" } },
      { id: "b7", type: "bestsellers", title: "Bestseller", enabled: true, settings: { count: 4, title: "Eng ko'p sotiladigan" } },
      { id: "b8", type: "product_of_day", title: "Kun mahsuloti", enabled: true, settings: { title: "Kun mahsuloti" } },
      { id: "b9", type: "recommended", title: "Siz uchun", enabled: true, settings: { count: 4, title: "Siz uchun" } },
      { id: "b10", type: "announcement", title: "E'lon", enabled: true, settings: { text: "Bepul almashtirish 14 kun ichida!" } },
    ],
  },
  {
    id: "electronics",
    name: "Elektronika",
    description: "Chegirmalarga asoslangan: tezkor chegirma, texnika tanlovlari, bestseller, kun mahsuloti va kategoriya to'ri",
    category: "Texnika",
    previewColor: "#3b82f6",
    blocks: [
      { id: "b1", type: "flash_sale", title: "Tezkor chegirma", enabled: true, settings: { count: 4, title: "Flesh-sel!" } },
      { id: "b2", type: "hero_banner", title: "Banner", enabled: true, settings: { title: "iPhone 15 Pro", subtitle: "Maxsus narx!" } },
      { id: "b3", type: "categories_2x2", title: "Kategoriyalar to'ri", enabled: true, settings: { count: 4, title: "Kategoriyalar" } },
      { id: "b4", type: "bestsellers", title: "Bestseller", enabled: true, settings: { count: 4, title: "Top texnika" } },
      { id: "b5", type: "product_of_day", title: "Kun mahsuloti", enabled: true, settings: { title: "Kun mahsuloti" } },
      { id: "b6", type: "category_products", title: "Kategoriya mahsulotlari", enabled: true, settings: { category: "Telefonlar", count: 4, title: "Smartfonlar" } },
      { id: "b7", type: "new_products", title: "Yangi mahsulotlar", enabled: true, settings: { count: 4, title: "Yangi modellar" } },
      { id: "b8", type: "discounts", title: "Chegirmalar", enabled: true, settings: { count: 4, title: "Aksiyalar" } },
      { id: "b9", type: "trending", title: "Trendlar", enabled: true, settings: { count: 4, title: "Trenddagi" } },
      { id: "b10", type: "recommended", title: "Siz uchun", enabled: true, settings: { count: 4, title: "Siz uchun" } },
      { id: "b11", type: "popular_categories", title: "Ommabop kategoriyalar", enabled: true, settings: { count: 6, title: "Kategoriyalar" } },
      { id: "b12", type: "announcement", title: "E'lon", enabled: true, settings: { text: "1 yillik kafolat barcha mahsulotlarga!" } },
    ],
  },
  {
    id: "cosmetics",
    name: "Kosmetika",
    description: "Zamonaviy va ilhomlantiruvchi: hikoyalar, parvarish tanlovlari, trendlar, kun mahsuloti va tezkor chegirma",
    category: "Go'zallik",
    previewColor: "#f472b6",
    blocks: [
      { id: "b1", type: "stories", title: "Shoppable Stories", enabled: true, settings: { title: "Go'zallik sirlari" } },
      { id: "b2", type: "hero_banner", title: "Banner", enabled: true, settings: { title: "Yangi brendlar", subtitle: "Premium kosmetika" } },
      { id: "b3", type: "popular_categories", title: "Ommabop kategoriyalar", enabled: true, settings: { count: 6, title: "Kategoriyalar" } },
      { id: "b4", type: "trending", title: "Trendlar", enabled: true, settings: { count: 4, title: "Trenddagi" } },
      { id: "b5", type: "product_of_day", title: "Kun mahsuloti", enabled: true, settings: { title: "Kun mahsuloti" } },
      { id: "b6", type: "flash_sale", title: "Tezkor chegirma", enabled: true, settings: { count: 4, title: "Flesh-sel!" } },
      { id: "b7", type: "bestsellers", title: "Bestseller", enabled: true, settings: { count: 4, title: "Top mahsulotlar" } },
      { id: "b8", type: "new_products", title: "Yangi mahsulotlar", enabled: true, settings: { count: 4, title: "Yangi kelganlar" } },
      { id: "b9", type: "category_products", title: "Kategoriya mahsulotlari", enabled: true, settings: { category: "Parvarish", count: 4, title: "Parvarish" } },
      { id: "b10", type: "recommended", title: "Siz uchun", enabled: true, settings: { count: 4, title: "Siz uchun" } },
    ],
  },
];

export const defaultBrandSettings: BrandSettings = {
  name: "ShopFlow",
  logo: "SF",
  primaryColor: "#10b981",
  secondaryColor: "#1e293b",
  accentColor: "#f59e0b",
  fontFamily: "Inter",
  borderRadius: "12",
  productCardStyle: "standard",
  categoryStyle: "grid",
  socialLinks: [
    { platform: "Instagram", url: "https://instagram.com/shopflow" },
    { platform: "Telegram", url: "https://t.me/shopflow" },
    { platform: "Facebook", url: "https://facebook.com/shopflow" },
  ],
  phone: "+998 90 123 45 67",
  email: "info@shopflow.uz",
  address: "Toshkent, Yakkasaroy",
};

export const categoryColors: Record<string, string> = {
  Telefonlar: "#3b82f6",
  Noutbuklar: "#8b5cf6",
  Kiyim: "#ec4899",
  "Oziq-ovqat": "#f59e0b",
  Maishiy: "#10b981",
  Sport: "#ef4444",
  Kitoblar: "#06b6d4",
  "O'yinchoqlar": "#f97316",
  Aksessuarlar: "#64748b",
  Vitaminlar: "#84cc16",
  Parvarish: "#d946ef",
  Badiiy: "#6366f1",
};
