import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, type StorefrontOrder } from "../api.ts";
import { formatMoney } from "../format.ts";

const STATUS_TEXT: Record<StorefrontOrder["status"], { label: string; color: string }> = {
  PENDING: { label: "Qabul qilindi", color: "text-amber-600 bg-amber-50" },
  PROCESSING: { label: "Ishlab chiqilmoqda", color: "text-blue-600 bg-blue-50" },
  SHIPPED: { label: "Jo'natildi", color: "text-violet-600 bg-violet-50" },
  COMPLETED: { label: "Yetkazildi", color: "text-emerald-600 bg-emerald-50" },
  CANCELLED: { label: "Bekor qilindi", color: "text-red-600 bg-red-50" },
};

export function MyOrdersPage() {
  const { slug } = useParams();
  const orders = useQuery({
    queryKey: ["miniapp", "myOrders"],
    queryFn: () => api.get<StorefrontOrder[]>("/storefront/orders").then((r) => r.data),
  });

  return (
    <div className="p-4 pb-24">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Buyurtmalarim</h1>
      </header>

      {orders.isLoading && <p className="text-center text-neutral-500">Yuklanmoqda…</p>}
      {orders.isError && (
        <p className="text-center text-red-600 text-sm">Tarixni yuklab bo'lmadi</p>
      )}

      {orders.data && orders.data.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
          Hozircha buyurtmalaringiz yo'q
        </div>
      )}

      <ul className="space-y-2">
        {orders.data?.map((o) => {
          const status = STATUS_TEXT[o.status];
          return (
            <li key={o.id}>
              <Link
                to={`/${slug}/order/${o.id}`}
                className="block rounded-xl border border-neutral-200 bg-white p-4 hover:shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-sm text-neutral-500">{o.number}</div>
                    <div className="mt-1 text-base font-semibold text-neutral-900">
                      {formatMoney(o.totalKopecks)}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {o.itemsCount} dona · {new Date(o.createdAt).toLocaleDateString("uz-UZ")}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
