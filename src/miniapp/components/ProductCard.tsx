import { Heart, Star, ShoppingBag, Plus, Minus } from "lucide-react";
import type { Product } from "../lib/api";
import { fmtMoney } from "../lib/format";

interface Props {
  product: Product;
  inCart?: number;
  variant?: "grid" | "horizontal";
  onClick?: () => void;
  onToggleFavorite?: () => void;
  onAdd?: () => void;
  onSetQty?: (qty: number) => void;
  currency?: string;
}

export default function ProductCard({
  product,
  inCart = 0,
  variant = "grid",
  onClick,
  onToggleFavorite,
  onAdd,
  onSetQty,
  currency = "UZS",
}: Props) {
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discount = hasDiscount
    ? Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)
    : 0;

  if (variant === "horizontal") {
    return (
      <div
        className="shrink-0 w-[180px] bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
      >
        <div onClick={onClick} className="relative cursor-pointer">
          <div className="aspect-square bg-gray-50 overflow-hidden">
            {product.images[0] ? (
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain p-2" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📦</div>
            )}
          </div>
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center"
            >
              <Heart className={`w-4 h-4 ${product.isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
            </button>
          )}
          {hasDiscount && (
            <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              -{discount}%
            </div>
          )}
        </div>
        <div className="p-3">
          {hasDiscount && (
            <p className="text-[11px] text-gray-400 line-through">{fmtMoney(product.compareAtPrice!, currency)}</p>
          )}
          <p className="text-sm font-bold text-gray-900">{fmtMoney(product.price, currency)}</p>
          <p className="text-xs text-gray-600 line-clamp-2 mt-1 min-h-[32px]">{product.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col">
      <div onClick={onClick} className="relative cursor-pointer">
        <div className="aspect-square bg-gray-50 overflow-hidden">
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-contain p-2" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📦</div>
          )}
        </div>
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur shadow flex items-center justify-center"
          >
            <Heart className={`w-4 h-4 ${product.isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
          </button>
        )}
        {hasDiscount && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            -{discount}%
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="bg-gray-800 text-white text-xs px-3 py-1 rounded-full">Mavjud emas</span>
          </div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-baseline gap-2 mb-1">
          {hasDiscount && (
            <p className="text-xs text-gray-400 line-through">{fmtMoney(product.compareAtPrice!, currency)}</p>
          )}
          {hasDiscount && (
            <p className="text-xs font-semibold text-red-500">-{discount}%</p>
          )}
        </div>
        <p className="text-sm font-bold text-gray-900 mb-1">{fmtMoney(product.price, currency)}</p>
        <p className="text-xs text-gray-700 line-clamp-2 mb-2 flex-1 min-h-[32px]">{product.name}</p>
        <div className="flex items-center gap-1 mb-2">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs font-medium text-gray-700">{product.rating.toFixed(1)}</span>
          <span className="text-[10px] text-gray-400">
            {product.reviewCount > 0 ? `(${product.reviewCount})` : "(Sharhlar yo'q)"}
          </span>
        </div>
        {inCart > 0 && onSetQty ? (
          <div className="flex items-center justify-between bg-violet-50 rounded-lg p-1">
            <button
              onClick={(e) => { e.stopPropagation(); onSetQty(inCart - 1); }}
              className="w-7 h-7 rounded-md bg-white shadow-sm flex items-center justify-center text-violet-600"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-sm font-bold text-violet-600">{inCart}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onSetQty(Math.min(inCart + 1, product.stock)); }}
              disabled={inCart >= product.stock}
              className="w-7 h-7 rounded-md bg-white shadow-sm flex items-center justify-center text-violet-600 disabled:opacity-40"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd?.(); }}
            disabled={product.stock === 0}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Sotib olish
          </button>
        )}
      </div>
    </div>
  );
}
