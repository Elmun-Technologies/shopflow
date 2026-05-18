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

export const blockDefinitions: BlockDefinition[] = [];

export const templates: Template[] = [];

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
