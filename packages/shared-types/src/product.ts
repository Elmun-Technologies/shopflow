export type ProductStatus = "active" | "inactive" | "out_of_stock" | "discontinued";

export interface IkpuCode {
  code: string;
  name: string;
  category: string;
  vatPercent: number;
  productsCount?: number;
}

export interface ProductPrice {
  priceTypeId: string;
  priceTypeName: string;
  /** Stored in kopecks (smallest currency unit). */
  value: number;
  currency: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  moyskladId?: string | null;
  sku: string;
  barcode?: string | null;
  characteristics: Record<string, string>;
  priceOverride?: number | null;
  stock?: number;
}

export interface Product {
  id: string;
  tenantId: string;
  moyskladId?: string | null;
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  category: string;

  /** Default price in kopecks. */
  price: number;
  costPrice: number;
  salePrice?: number | null;
  prices?: ProductPrice[];

  stock: number;
  minStock: number;
  maxStock: number;

  unit: string;
  barcode?: string | null;
  ikpu?: string | null;
  ikpuName?: string | null;
  vatPercent: number;

  warehouse?: string | null;
  warehouseId?: string | null;

  status: ProductStatus;
  archived: boolean;

  rating: number;
  sold: number;
  returns: number;

  image?: string | null;
  images?: string[];
  description?: string | null;
  supplier?: string | null;
  weight?: number | null;
  dimensions?: string | null;

  /** Optimistic concurrency token mirroring MoySklad `updated`. */
  version: number;
  syncedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  category: string;
  price: number;
  salePrice?: number | null;
  stock: number;
  unit: string;
  image?: string | null;
  status: ProductStatus;
}
