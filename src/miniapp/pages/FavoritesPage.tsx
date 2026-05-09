import { Heart } from "lucide-react";
import type { Product } from "../lib/api";
import ProductCard from "../components/ProductCard";

interface Props {
  products: Product[];
  cart: Map<string, number>;
  currency: string;
  onProduct: (id: string) => void;
  onAddCart: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onToggleFavorite: (id: string) => void;
}

export default function FavoritesPage({ products, cart, currency, onProduct, onAddCart, onSetQty, onToggleFavorite }: Props) {
  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-30">
        <h1 className="text-lg font-bold text-gray-900">Sevimlilar</h1>
        <p className="text-xs text-gray-500 mt-0.5">{products.length} ta mahsulot</p>
      </div>

      {products.length === 0 ? (
        <div className="px-4 pt-20 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-pink-50 flex items-center justify-center mb-4">
            <Heart className="w-10 h-10 text-pink-300" />
          </div>
          <p className="text-gray-900 font-semibold">Sevimlilar bo'sh</p>
          <p className="text-gray-500 text-sm mt-1 max-w-xs mx-auto">Mahsulotlar yonidagi yurak ikonkasini bosib, ularni shu yerga qo'shing</p>
        </div>
      ) : (
        <div className="px-4 pt-4">
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={{ ...p, isFavorite: true }}
                currency={currency}
                inCart={cart.get(p.id) ?? 0}
                onClick={() => onProduct(p.id)}
                onToggleFavorite={() => onToggleFavorite(p.id)}
                onAdd={() => onAddCart(p.id)}
                onSetQty={(q) => onSetQty(p.id, q)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
