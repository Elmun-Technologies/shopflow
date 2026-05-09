import { useMemo, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import type { Category, Product } from "../lib/api";
import ProductCard from "../components/ProductCard";

interface Props {
  shop: { id: string; name: string; currency: string } | null;
  categories: Category[];
  products: Product[];
  cart: Map<string, number>;
  onProduct: (id: string) => void;
  onCategory: (id: string) => void;
  onShowAllFeatured: () => void;
  onAddCart: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onToggleFavorite: (id: string) => void;
  onSearchSubmit: (query: string) => void;
}

export default function HomePage({
  shop, categories, products, cart, onProduct, onCategory, onShowAllFeatured,
  onAddCart, onSetQty, onToggleFavorite, onSearchSubmit,
}: Props) {
  const [search, setSearch] = useState("");

  const featured = useMemo(() => products.filter((p) => p.featured), [products]);
  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      if (!p.categoryId) continue;
      const list = map.get(p.categoryId) ?? [];
      list.push(p);
      map.set(p.categoryId, list);
    }
    return map;
  }, [products]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) onSearchSubmit(search);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Search */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-30">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mahsulotlar va toifalarni qidirish"
            className="w-full bg-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:bg-gray-50 focus:ring-2 focus:ring-violet-200"
          />
        </form>
      </div>

      <div className="px-4 py-4 space-y-5 pb-2">
        {/* Categories */}
        {categories.length > 0 && (
          <div className="bg-white rounded-2xl p-3 border border-gray-100">
            <div className="grid grid-cols-4 gap-3">
              {categories.slice(0, 8).map((c) => (
                <button
                  key={c.id}
                  onClick={() => onCategory(c.id)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center text-2xl shadow-sm overflow-hidden">
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{c.emoji ?? "📦"}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-700 text-center line-clamp-2">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Featured / Popular */}
        {featured.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <span className="text-xl">🛍</span>
                <span className="text-gray-900">Mashhur</span>
              </h2>
              {featured.length > 3 && (
                <button onClick={onShowAllFeatured} className="text-xs text-violet-600 font-medium flex items-center gap-1 bg-violet-50 px-3 py-1.5 rounded-full">
                  {featured.length} yana <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto -mx-4 px-4 no-scrollbar">
              {featured.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  variant="horizontal"
                  currency={shop?.currency}
                  onClick={() => onProduct(p.id)}
                  onToggleFavorite={() => onToggleFavorite(p.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Categories with products (banner + grid) */}
        {categories.map((c) => {
          const list = productsByCategory.get(c.id) ?? [];
          if (list.length === 0) return null;
          return (
            <div key={c.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
              <button
                onClick={() => onCategory(c.id)}
                className="w-full p-5 bg-gradient-to-r from-teal-700 to-teal-800 flex items-center justify-between text-white"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{c.emoji ?? "📦"}</span>
                  <span className="text-2xl font-bold uppercase tracking-wide">{c.name}</span>
                </div>
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="p-3">
                <h3 className="text-base font-bold text-gray-900 mb-3">{c.name}</h3>
                <div className="flex gap-3 overflow-x-auto -mx-3 px-3 no-scrollbar">
                  {list.slice(0, 6).map((p) => (
                    <div key={p.id} className="shrink-0 w-[150px]">
                      <ProductCard
                        product={p}
                        currency={shop?.currency}
                        inCart={cart.get(p.id) ?? 0}
                        onClick={() => onProduct(p.id)}
                        onToggleFavorite={() => onToggleFavorite(p.id)}
                        onAdd={() => onAddCart(p.id)}
                        onSetQty={(q) => onSetQty(p.id, q)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
