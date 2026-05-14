import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.ts";
import { formatMoney } from "../format.ts";
import { useCart } from "../cart.ts";

export function ProductPage() {
  const { slug, productSlug } = useParams();
  const nav = useNavigate();
  const { add } = useCart();

  const product = useQuery({
    queryKey: ["miniapp", "product", productSlug],
    queryFn: () => api.get(`/storefront/products/${productSlug}`).then((r) => r.data),
  });

  if (product.isLoading) return <div className="p-4">Yuklanmoqda…</div>;
  if (!product.data) return <div className="p-4">Topilmadi</div>;
  const p = product.data;

  return (
    <div className="pb-32">
      {p.image && <img src={p.image} alt={p.name} className="aspect-square w-full object-cover" />}
      <div className="p-4">
        <h1 className="text-xl font-semibold">{p.name}</h1>
        <div className="mt-1 text-2xl font-bold text-emerald-700">
          {formatMoney(p.salePriceKopecks ?? p.priceKopecks)}
        </div>
        {p.description && <p className="mt-3 text-sm text-neutral-700 whitespace-pre-line">{p.description}</p>}
      </div>
      <button
        type="button"
        className="fixed bottom-4 left-4 right-4 rounded-xl bg-emerald-600 py-3 text-white font-semibold"
        onClick={() => {
          add({
            productId: p.id,
            name: p.name,
            priceKopecks: p.salePriceKopecks ?? p.priceKopecks,
            quantity: 1,
          });
          nav(`/${slug}/cart`);
        }}
      >
        Savatga qo'shish
      </button>
    </div>
  );
}
