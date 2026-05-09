import { useMemo, useState } from "react";
import { ShoppingCart, Search, Receipt } from "lucide-react";
import { fmtMoney } from "../lib/format";
import type { Category, Product } from "../lib/api";

interface Props {
  shop: { id: string; name: string; currency: string } | null;
  categories: Category[];
  products: Product[];
  cartCount: number;
  onProduct: (id: string) => void;
  onCart: () => void;
  onOrders: () => void;
}

export default function CatalogPage({ shop, categories, products, cartCount, onProduct, onCart, onOrders }: Props) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  return (
    <div>
      <div className="px-4 pt-4 pb-3 sticky top-0 bg-slate-950/95 backdrop-blur z-10 border-b border-slate-900">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold">{shop?.name ?? "Do'kon"}</h1>
          <div className="flex items-center gap-2">
            <button onClick={onOrders} className="p-2 rounded-lg bg-slate-900 text-slate-300" title="Buyurtmalarim">
              <Receipt className="w-5 h-5" />
            </button>
            <button onClick={onCart} className="relative p-2 rounded-lg bg-slate-900 text-slate-300">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold">{cartCount}</span>
              )}
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mahsulot izlash..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pt-3 -mx-4 px-4 no-scrollbar">
            <button
              onClick={() => setActiveCat(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${activeCat === null ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400"}`}
            >Hammasi</button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${activeCat === c.id ? "bg-emerald-600 text-white" : "bg-slate-900 text-slate-400"}`}
              >{c.name}</button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        {filtered.length === 0 ? (
          <p className="text-center text-slate-500 text-sm py-12">Mahsulot topilmadi</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => onProduct(p.id)}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-left hover:border-emerald-500/40 active:scale-[0.98] transition-transform"
              >
                <div className="aspect-square bg-slate-800 overflow-hidden">
                  {p.images[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 text-3xl">📦</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium line-clamp-2">{p.name}</p>
                  <p className="text-emerald-400 font-semibold mt-1.5 text-sm">{fmtMoney(p.price, shop?.currency)}</p>
                  {p.stock <= 5 && p.stock > 0 && <p className="text-[10px] text-amber-400 mt-0.5">Atigi {p.stock} ta qoldi</p>}
                  {p.stock === 0 && <p className="text-[10px] text-red-400 mt-0.5">Mavjud emas</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
