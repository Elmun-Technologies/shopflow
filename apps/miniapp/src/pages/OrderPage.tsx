import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import { api, type StorefrontOrder } from "../api.ts";
import { formatMoney } from "../format.ts";

interface PaymentLinks {
  clickUrl?: string;
  paymeUrl?: string;
}

const STATUS_TEXT: Record<StorefrontOrder["status"], { label: string; color: string }> = {
  PENDING: { label: "Qabul qilindi", color: "text-amber-600 bg-amber-50" },
  PROCESSING: { label: "Ishlab chiqilmoqda", color: "text-blue-600 bg-blue-50" },
  SHIPPED: { label: "Jo'natildi", color: "text-violet-600 bg-violet-50" },
  COMPLETED: { label: "Yetkazildi", color: "text-emerald-600 bg-emerald-50" },
  CANCELLED: { label: "Bekor qilindi", color: "text-red-600 bg-red-50" },
};

const PAYMENT_TEXT: Record<StorefrontOrder["paymentStatus"], string> = {
  PENDING: "To'lov kutilmoqda",
  PAID: "To'langan",
  FAILED: "Muvaffaqiyatsiz",
  REFUNDED: "Qaytarilgan",
};

export function OrderPage() {
  const { slug, orderId } = useParams();
  const order = useQuery({
    queryKey: ["miniapp", "order", orderId],
    queryFn: () => api.get<StorefrontOrder>(`/storefront/orders/${orderId}`).then((r) => r.data),
    refetchInterval: 15_000,
    enabled: !!orderId,
  });
  const payment = useQuery({
    queryKey: ["miniapp", "payment-links", orderId],
    queryFn: () =>
      api.get<PaymentLinks>(`/integrations/payments/links/${orderId}`).then((r) => r.data),
    enabled: !!orderId && order.data?.paymentStatus === "PENDING",
  });

  if (order.isLoading) return <div className="p-6">Yuklanmoqda…</div>;
  if (!order.data) return <div className="p-6">Buyurtma topilmadi</div>;
  const o = order.data;
  const status = STATUS_TEXT[o.status];
  const showPayment = o.paymentStatus === "PENDING" && (payment.data?.clickUrl || payment.data?.paymeUrl);

  return (
    <div className="p-4 pb-24">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold">🎉 Rahmat!</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Buyurtma raqami: <span className="font-mono text-neutral-700">{o.number}</span>
        </p>
      </header>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-neutral-700">Holat</span>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${status.color}`}>{status.label}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">To'lov</span>
          <span className="text-sm text-neutral-600">{PAYMENT_TEXT[o.paymentStatus]}</span>
        </div>
      </div>

      <section className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">Mahsulotlar</h2>
        <ul className="space-y-2">
          {o.items?.map((i) => (
            <li key={i.id} className="flex justify-between text-sm">
              <span className="text-neutral-700">
                {i.productName} <span className="text-neutral-400">×{i.quantity}</span>
              </span>
              <span className="text-neutral-900 font-medium">{formatMoney(i.priceKopecks * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-neutral-100 pt-3 text-base font-semibold">
          <span>Jami</span>
          <span>{formatMoney(o.totalKopecks)}</span>
        </div>
      </section>

      {showPayment && (
        <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-sm font-semibold text-emerald-900 mb-3">To'lov usulini tanlang</h2>
          <div className="space-y-2">
            {payment.data?.clickUrl && (
              <button
                type="button"
                onClick={() => WebApp.openLink(payment.data!.clickUrl!)}
                className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 py-3 text-sm font-semibold text-white"
              >
                Click orqali to'lash
              </button>
            )}
            {payment.data?.paymeUrl && (
              <button
                type="button"
                onClick={() => WebApp.openLink(payment.data!.paymeUrl!)}
                className="w-full rounded-lg bg-cyan-700 hover:bg-cyan-600 py-3 text-sm font-semibold text-white"
              >
                Payme orqali to'lash
              </button>
            )}
          </div>
        </section>
      )}

      <p className="mt-6 text-center text-xs text-neutral-500">
        Buyurtmangiz tayyor bo'lishi yoki holati o'zganishi haqida bot orqali xabar olasiz.
      </p>

      <Link
        to={`/${slug}`}
        className="fixed bottom-4 left-4 right-4 rounded-xl bg-emerald-600 py-3 text-center text-white font-semibold"
      >
        Katalogga qaytish
      </Link>
    </div>
  );
}
