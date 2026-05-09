import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Category, Product } from "../lib/api";
import ProductCard from "../components/ProductCard";

interface Props {
  shop: { currency: string } | null;
  categories: Category[];
  products: Product[];
  cart: Map<string, number>;
  initialCategoryId?: string | null;
  initialQuery?: string;
  onProduct: (id: string) => void;
  onAddCart: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onToggleFavorite: (id: string) => void;
}

export default function NewCatalogPage({
  shop, categories, products, cart, initialCategoryId, initialQuery,
  onProduct, onAddCart, onSetQty, onToggleFavorite,
}: Props) {
  const [activeCat, setActiveCat] = useState<string | null>(initialCategoryId ?? null);
  const [search, setSearch] = useState(initialQuery ?? "");

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (activeCat && p.categoryId !== activeCat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, activeCat, search]);

  const activeCategory = categories.find((c) => c.id === activeCat);

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qidirish..."
              className="w-full bg-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
            />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
          <button
            onClick={() => setActiveCat(null)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium ${activeCat === null ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700"}`}
          >
            Hammasi
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium flex items-center gap-1.5 ${activeCat === c.id ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              {c.emoji && <span>{c.emoji}</span>}
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {activeCategory && (
        <div className="m-4 rounded-2xl overflow-hidden bg-gradient-to-r from-teal-700 to-teal-800 p-5 text-white flex items-center gap-3">
          <span className="text-4xl">{activeCategory.emoji ?? "📦"}</span>
          <div>
            <h1 className="text-2xl font-bold uppercase">{activeCategory.name}</h1>
            <p className="text-sm opacity-80">{filtered.length} ta mahsulot</p>
          </div>
        </div>
      )}

      <div className="px-4 pt-1">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-sm">Mahsulot topilmadi</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                currency={shop?.currency}
                inCart={cart.get(p.id) ?? 0}
                onClick={() => onProduct(p.id)}
                onToggleFavorite={() => onToggleFavorite(p.id)}
                onAdd={() => onAddCart(p.id)}
                onSetQty={(q) => onSetQty(p.id, q)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
