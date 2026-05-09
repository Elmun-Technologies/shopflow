import { ChevronLeft, Heart, Star, Minus, Plus, ShoppingBag } from "lucide-react";
import type { Product } from "../lib/api";
import { fmtMoney } from "../lib/format";

interface Props {
  product: Product | null;
  inCart: number;
  currency: string;
  onAdd: () => void;
  onSetQty: (q: number) => void;
  onToggleFavorite: () => void;
  onBack: () => void;
}

export default function NewProductPage({ product, inCart, currency, onAdd, onSetQty, onToggleFavorite, onBack }: Props) {
  if (!product) {
    return <div className="p-6 text-center text-gray-500 text-sm bg-gray-50 min-h-screen">Mahsulot topilmadi</div>;
  }
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discount = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0;
  const stockOk = product.stock > 0;

  return (
    <div className="bg-gray-50 min-h-screen pb-32">
      <div className="bg-white">
        <div className="relative">
          <div className="aspect-square bg-gray-50 overflow-hidden">
            {product.images[0] ? (
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain p-4" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl text-gray-200">📦</div>
            )}
          </div>
          <button onClick={onBack} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center">
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button onClick={onToggleFavorite} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center">
            <Heart className={`w-5 h-5 ${product.isFavorite ? "fill-red-500 text-red-500" : "text-gray-700"}`} />
          </button>
          {hasDiscount && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              -{discount}% chegirma
            </div>
          )}
        </div>
      </div>

      <div className="bg-white mt-2 px-5 py-5 space-y-3">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-semibold text-gray-900">{product.rating.toFixed(1)}</span>
          <span className="text-xs text-gray-400">
            {product.reviewCount > 0 ? `(${product.reviewCount} sharh)` : "(Sharhlar yo'q)"}
          </span>
        </div>

        <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>

        <div className="flex items-baseline gap-3">
          {hasDiscount && (
            <p className="text-sm text-gray-400 line-through">{fmtMoney(product.compareAtPrice!, currency)}</p>
          )}
          <p className="text-2xl font-bold text-gray-900">{fmtMoney(product.price, currency)}</p>
        </div>

        {!stockOk && <p className="text-sm text-red-500">Hozirda mavjud emas</p>}
        {stockOk && product.stock <= 5 && <p className="text-sm text-amber-500">Atigi {product.stock} ta qoldi</p>}
      </div>

      {product.description && (
        <div className="bg-white mt-2 px-5 py-5">
          <p className="text-xs uppercase text-gray-400 mb-2 tracking-wide">Tavsifi</p>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{product.description}</p>
        </div>
      )}

      <div className="fixed bottom-[68px] left-0 right-0 bg-white border-t border-gray-100 p-3 z-30">
        <div className="max-w-md mx-auto">
          {inCart > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 bg-violet-50 rounded-xl p-2 flex-1 justify-between">
                <button onClick={() => onSetQty(inCart - 1)} className="w-9 h-9 rounded-lg bg-white shadow-sm flex items-center justify-center text-violet-600">
                  <Minus className="w-4 h-4" />
                </button>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500">Savatda</p>
                  <p className="text-sm font-bold text-violet-600">{inCart} dona</p>
                </div>
                <button
                  onClick={() => onSetQty(Math.min(inCart + 1, product.stock))}
                  disabled={inCart >= product.stock}
                  className="w-9 h-9 rounded-lg bg-violet-600 disabled:bg-gray-300 flex items-center justify-center text-white"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onAdd}
              disabled={!stockOk}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              {stockOk ? "Sotib olish" : "Mavjud emas"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
