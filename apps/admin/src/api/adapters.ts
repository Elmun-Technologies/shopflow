/**
 * API → legacy mock format adapters.
 *
 * The legacy data shapes in `src/data/*.ts` use UZS-as-number (price=10000),
 * lowercase statuses ("active") and a flat `stock` field. The API uses
 * kopecks (priceKopecks=1000000), uppercase enums ("ACTIVE") and a
 * `stockTotal` field. These adapters bridge the two without rewriting the
 * pages — once mocks are fully removed, the adapters go too.
 */
import type {
  Product as LegacyProduct,
} from "../data/productsData";
import type {
  Order as LegacyOrder,
} from "../data/ordersData";
import type {
  Customer as LegacyCustomer,
} from "../data/customersData";

interface ApiProduct {
  id: string;
  name: string;
  slug?: string;
  sku: string;
  categoryId?: string | null;
  category?: { name: string } | null;
  priceKopecks: number;
  costPriceKopecks: number;
  salePriceKopecks?: number | null;
  stockTotal: number;
  minStock: number;
  maxStock: number;
  unit: string;
  barcode?: string | null;
  ikpu?: string | null;
  ikpuName?: string | null;
  vatPercent: number;
  status: "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK" | "DISCONTINUED";
  image?: string | null;
  createdAt: string;
  updatedAt: string;
  description?: string | null;
  weight?: number | null;
  dimensions?: string | null;
  sold?: number;
  returns?: number;
}

export function adaptProduct(p: ApiProduct): LegacyProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    categoryId: p.categoryId ?? "",
    category: p.category?.name ?? "—",
    price: Math.round(p.priceKopecks / 100),
    costPrice: Math.round(p.costPriceKopecks / 100),
    salePrice: p.salePriceKopecks ? Math.round(p.salePriceKopecks / 100) : undefined,
    stock: p.stockTotal,
    minStock: p.minStock,
    maxStock: p.maxStock,
    unit: p.unit,
    barcode: p.barcode ?? "",
    ikpu: p.ikpu ?? "",
    ikpuName: p.ikpuName ?? "",
    vatPercent: p.vatPercent,
    warehouse: "—",
    warehouseId: "",
    status: p.status.toLowerCase() as LegacyProduct["status"],
    rating: 0,
    sold: p.sold ?? 0,
    returns: p.returns ?? 0,
    image: p.image ?? "",
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    description: p.description ?? "",
    supplier: "",
    weight: p.weight ?? 0,
    dimensions: p.dimensions ?? "",
  };
}

interface ApiOrder {
  id: string;
  number: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  itemsCount: number;
  totalKopecks: number;
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "CANCELLED";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  shippingMethod?: string | null;
  shippingAddress?: string | null;
  createdAt: string;
  items?: Array<{ productName: string }>;
}

export function adaptOrder(o: ApiOrder): LegacyOrder {
  const statusMap = {
    PENDING: "pending",
    PROCESSING: "processing",
    SHIPPED: "shipped",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  } as const;
  const payMap = { PENDING: "pending", PAID: "paid", FAILED: "failed", REFUNDED: "refunded" } as const;
  return {
    id: `#${o.number}`,
    customer: o.customerName,
    email: o.customerEmail ?? "",
    avatar: initials(o.customerName),
    product: o.items?.[0]?.productName ?? "—",
    items: o.itemsCount,
    amount: Math.round(o.totalKopecks / 100),
    status: statusMap[o.status],
    payment: payMap[o.paymentStatus],
    date: o.createdAt.slice(0, 10),
    shipping: o.shippingMethod ?? "Standard",
    address: o.shippingAddress ?? "",
    phone: o.customerPhone ?? "",
  };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

interface ApiCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tags?: string[];
  notes?: string | null;
  totalOrders: number;
  totalSpentKopecks?: bigint | string | number;
  createdAt: string;
  updatedAt: string;
}

export function adaptCustomer(c: ApiCustomer): LegacyCustomer {
  const [firstName, ...rest] = c.name.split(/\s+/);
  const lastName = rest.join(" ");
  const spent = Number(c.totalSpentKopecks ?? 0) / 100;
  return {
    id: c.id,
    firstName: firstName ?? c.name,
    lastName,
    phone: c.phone ?? "",
    email: c.email ?? "",
    avatar: initials(c.name),
    region: "—",
    city: "—",
    address: c.address ?? "",
    status: "active",
    platform: "website",
    bonusPoints: 0,
    totalSpent: spent,
    totalOrders: c.totalOrders,
    avgOrderValue: c.totalOrders > 0 ? Math.round(spent / c.totalOrders) : 0,
    firstOrderDate: c.createdAt.slice(0, 10),
    lastOrderDate: c.updatedAt.slice(0, 10),
    registeredAt: c.createdAt.slice(0, 10),
    notes: c.notes ?? "",
    tags: c.tags ?? [],
    orders: [],
    activities: [],
  };
}
