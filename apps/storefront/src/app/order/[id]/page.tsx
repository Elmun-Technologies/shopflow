import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface OrderItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  priceKopecks: number;
}

interface Order {
  id: string;
  number: string;
  customerName: string;
  customerPhone: string | null;
  shippingAddress: string | null;
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "CANCELLED";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  totalKopecks: number;
  itemsCount: number;
  items?: OrderItem[];
  createdAt: string;
}

const STATUS_TEXT: Record<Order["status"], { label: string; cls: string }> = {
  PENDING: { label: "Qabul qilindi", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  PROCESSING: { label: "Ishlab chiqilmoqda", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  SHIPPED: { label: "Jo'natildi", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  COMPLETED: { label: "Yetkazildi", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Bekor qilindi", cls: "bg-red-50 text-red-700 border-red-200" },
};

const PAYMENT_TEXT: Record<Order["paymentStatus"], string> = {
  PENDING: "To'lov kutilmoqda",
  PAID: "To'langan",
  FAILED: "To'lov muvaffaqiyatsiz",
  REFUNDED: "Pul qaytarilgan",
};

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchOrder(host: string, id: string): Promise<Order | null> {
  try {
    const res = await fetch(`${API_URL}/api/storefront/orders/${id}`, {
      headers: { host },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Order;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: `Buyurtma ${id.slice(0, 8)}` };
}

export default async function OrderPage({ params }: Props) {
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("host") ?? "";
  const { id } = await params;
  const order = await fetchOrder(host, id);
  if (!order) notFound();

  const status = STATUS_TEXT[order.status];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <section className="text-center mb-8">
        <div className="text-6xl mb-2">🎉</div>
        <h1 className="text-2xl font-bold text-neutral-900">Rahmat, buyurtmangiz qabul qilindi!</h1>
        <p className="mt-2 text-neutral-500">
          Buyurtma raqami: <span className="font-mono text-neutral-800">{order.number}</span>
        </p>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-neutral-700">Holat</span>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${status.cls}`}>
            {status.label}
          </span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-neutral-700">To'lov</span>
          <span className="text-sm text-neutral-600">{PAYMENT_TEXT[order.paymentStatus]}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Sana</span>
          <span className="text-sm text-neutral-600">
            {new Date(order.createdAt).toLocaleString("uz-UZ")}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 mb-4">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Aloqa</h2>
        <dl className="text-sm">
          <Row label="Mijoz" value={order.customerName} />
          {order.customerPhone && <Row label="Telefon" value={order.customerPhone} />}
          {order.shippingAddress && <Row label="Manzil" value={order.shippingAddress} />}
        </dl>
      </section>

      {order.items && order.items.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-neutral-900 mb-3">Mahsulotlar</h2>
          <ul className="space-y-2">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between text-sm">
                <span className="text-neutral-700">
                  {i.productName} <span className="text-neutral-400">×{i.quantity}</span>
                </span>
                <span className="text-neutral-900 font-medium">
                  {formatMoney(i.priceKopecks * i.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-neutral-100 pt-3 text-base font-semibold">
            <span>Jami</span>
            <span>{formatMoney(order.totalKopecks)}</span>
          </div>
        </section>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/catalog"
          className="inline-block rounded-lg bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white"
        >
          Katalogga qaytish
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-900 text-right">{value}</dd>
    </div>
  );
}
