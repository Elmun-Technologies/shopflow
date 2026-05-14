export type OrderChannel = "ADMIN" | "TELEGRAM" | "WEBSITE" | "MINIAPP";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type PaymentProvider = "CLICK" | "PAYME" | "CASH" | "MANUAL";

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  sku: string;
  quantity: number;
  /** Price per unit in kopecks. */
  priceKopecks: number;
  vatPercent: number;
}

export interface Order {
  id: string;
  tenantId: string;
  moyskladId?: string | null;

  number: string;
  channel: OrderChannel;

  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;

  status: OrderStatus;
  paymentStatus: PaymentStatus;

  warehouseId?: string | null;

  itemsCount: number;
  /** Total in kopecks. */
  totalKopecks: number;
  currency: string;

  shippingMethod?: string | null;
  shippingAddress?: string | null;
  shippingCost?: number;

  notes?: string | null;

  items?: OrderItem[];

  /** Optimistic concurrency token. */
  version: number;
  syncedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amountKopecks: number;
  currency: string;
  externalId?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface CreateOrderRequest {
  channel: OrderChannel;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  warehouseId?: string;
  shippingMethod?: string;
  shippingAddress?: string;
  notes?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
}
