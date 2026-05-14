import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, type StorefrontProduct, type StorefrontCategory } from "../api.ts";
import { formatMoney } from "../format.ts";

export function CatalogPage() {
  const { slug } = useParams();

  const products = useQuery({
    queryKey: ["miniapp", "products", slug],
    queryFn: () => api.get<StorefrontProduct[]>("/storefront/products").then((r) => r.data),
  });
  const cats = useQuery({
    queryKey: ["miniapp", "cats", slug],
    queryFn: () => api.get<StorefrontCategory[]>("/storefront/categories").then((r) => r.data),
  });

  return (
    <div className="p-4 pb-24">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Katalog</h1>
        <Link to={`/${slug}/cart`} className="text-sm text-emerald-600">
          Savatcha →
        </Link>
      </header>

      {cats.data && cats.data.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {cats.data.map((c) => (
            <span key={c.id} className="rounded-full bg-neutral-100 px-3 py-1 text-sm">
              {c.name}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {products.isLoading && <p className="col-span-2 text-center text-neutral-500">Yuklanmoqda…</p>}
        {products.data?.map((p) => (
          <Link
            key={p.id}
            to={`/${slug}/p/${p.slug}`}
            className="rounded-xl border border-neutral-200 bg-white p-3 hover:shadow"
          >
            {p.image && <img src={p.image} alt={p.name} className="mb-2 aspect-square w-full rounded-lg object-cover" />}
            <div className="text-sm font-medium leading-tight">{p.name}</div>
            <div className="mt-1 text-emerald-700 font-semibold">
              {formatMoney(p.salePriceKopecks ?? p.priceKopecks)}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              {p.stockTotal > 0 ? `${p.stockTotal} ${p.unit}` : "Tugagan"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
