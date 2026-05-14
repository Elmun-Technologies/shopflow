export type WarehouseStatus = "active" | "maintenance" | "full";

export interface Warehouse {
  id: string;
  tenantId: string;
  moyskladId?: string | null;
  name: string;
  location?: string | null;
  manager?: string | null;
  capacity?: number | null;
  used?: number | null;
  productsCount: number;
  status: WarehouseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Stock {
  id: string;
  tenantId: string;
  productId: string;
  variantId?: string | null;
  warehouseId: string;
  quantity: number;
  reserved: number;
  inTransit: number;
  updatedAt: string;
}
