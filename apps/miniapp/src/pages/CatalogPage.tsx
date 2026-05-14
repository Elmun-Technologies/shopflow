import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, type StorefrontProduct, type StorefrontCategory } from "../api.ts";
import { useCart } from "../cart.ts";
import { formatMoney } from "../format.ts";

export function CatalogPage() {
  const { slug } = useParams();
  const cart = useCart();
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const products = useQuery({
    queryKey: ["miniapp", "products", slug, selectedCat, query],
    queryFn: () =>
      api
        .get<StorefrontProduct[]>("/storefront/products", {
          params: {
            categoryId: selectedCat ?? undefined,
            search: query || undefined,
          },
        })
        .then((r) => r.data),
  });
  const cats = useQuery({
    queryKey: ["miniapp", "cats", slug],
    queryFn: () => api.get<StorefrontCategory[]>("/storefront/categories").then((r) => r.data),
  });

  const cartCount = cart.lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="p-4 pb-28">
      <header className="mb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Katalog</h1>
          <Link to={`/${slug}/my-orders`} className="text-xs text-emerald-700 underline">
            Buyurtmalarim
          </Link>
        </div>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Qidirish…"
        className="mb-3 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
      />

      {cats.data && cats.data.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setSelectedCat(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-sm transition ${
              !selectedCat
                ? "bg-emerald-600 text-white"
                : "bg-neutral-100 text-neutral-700"
            }`}
          >
            Hammasi
          </button>
          {cats.data.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCat(c.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm transition ${
                selectedCat === c.id
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-100 text-neutral-700"
              }`}
              style={selectedCat !== c.id && c.color ? { borderLeft: `3px solid ${c.color}` } : undefined}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {products.isLoading && <p className="col-span-2 text-center text-neutral-500">Yuklanmoqda…</p>}
        {products.data?.length === 0 && (
          <p className="col-span-2 text-center text-neutral-500 py-8">
            Mahsulot topilmadi
          </p>
        )}
        {products.data?.map((p) => (
          <Link
            key={p.id}
            to={`/${slug}/p/${p.slug}`}
            className="rounded-xl border border-neutral-200 bg-white p-3 hover:shadow active:scale-[0.99] transition"
          >
            {p.image && (
              <img src={p.image} alt={p.name} className="mb-2 aspect-square w-full rounded-lg object-cover" />
            )}
            <div className="text-sm font-medium leading-tight line-clamp-2">{p.name}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-emerald-700 font-semibold">
                {formatMoney(p.salePriceKopecks ?? p.priceKopecks)}
              </span>
              {p.salePriceKopecks && p.salePriceKopecks < p.priceKopecks && (
                <span className="text-xs text-neutral-400 line-through">
                  {formatMoney(p.priceKopecks)}
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              {p.stockTotal > 0 ? `${Math.round(p.stockTotal)} ${p.unit}` : "Tugagan"}
            </div>
          </Link>
        ))}
      </div>

      {cartCount > 0 && (
        <Link
          to={`/${slug}/cart`}
          className="fixed bottom-4 left-4 right-4 rounded-xl bg-emerald-600 py-3 text-center text-white font-semibold shadow-lg"
        >
          Savatcha · {cartCount} dona
        </Link>
      )}
    </div>
  );
}
