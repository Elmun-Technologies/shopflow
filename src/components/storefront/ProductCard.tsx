import { memo } from "react";
import { Package, Heart, Plus, CheckCircle2 } from "lucide-react";

type SaleBadgeColor = "RED" | "ORANGE" | "EMERALD" | "PURPLE" | "BLUE";
const SALE_BADGE_STYLES: Record<SaleBadgeColor, string> = {
  RED: "bg-rose-500 text-white",
  ORANGE: "bg-orange-500 text-white",
  EMERALD: "bg-emerald-500 text-white",
  PURPLE: "bg-purple-500 text-white",
  BLUE: "bg-blue-500 text-white",
};

interface ProductCardProps {
  productId: string;
  name: string;
  price: number;
  oldPrice: number | null;
  imageUrl: string | null;
  stock: number;
  featured: boolean;
  currency: string;
  primaryColor: string;
  isFav: boolean;
  qty: number;
  discountPct: number;
  liveCampaign: boolean;
  campaignLabel?: string;
  campaignBadgeColor?: SaleBadgeColor;
  onSelect: () => void;
  onToggleFav: () => void;
  onAddToCart: () => void;
}

function ProductCardInner({
  productId: _productId,
  name,
  price,
  oldPrice,
  imageUrl,
  stock,
  currency,
  primaryColor,
  isFav,
  qty,
  discountPct,
  liveCampaign,
  campaignLabel,
  campaignBadgeColor,
  onSelect,
  onToggleFav,
  onAddToCart,
}: ProductCardProps) {
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock > 0 && stock <= 5;
  const currencyLabel = currency === "UZS" ? "so'm" : currency;

  return (
    <div
      className={`bg-slate-900 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform relative${outOfStock ? " opacity-70" : ""}`}
      onClick={onSelect}
    >
      {/* Top-left badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {discountPct > 0 && (
          <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
            -{discountPct}%
          </span>
        )}
        {liveCampaign && campaignLabel && campaignBadgeColor && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${SALE_BADGE_STYLES[campaignBadgeColor]}`}>
            {campaignLabel}
          </span>
        )}
      </div>

      {/* Heart */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        aria-label={isFav ? "Sevimlilardan o'chirish" : "Sevimlilarga qo'shish"}
        className="absolute top-1.5 right-1.5 z-10 w-7 h-7 rounded-full bg-black/40 backdrop-blur flex items-center justify-center active:scale-90 transition-transform"
      >
        <Heart
          className={`w-3.5 h-3.5 transition-colors ${isFav ? "text-rose-400 fill-rose-400" : "text-white"}`}
          strokeWidth={2}
        />
      </button>

      {/* Image */}
      <div className="aspect-square bg-slate-800 flex items-center justify-center overflow-hidden relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <Package className="w-10 h-10 text-slate-600" />
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white text-xs font-bold px-3 py-1 bg-slate-800/80 rounded-md border border-slate-700">
              Tugagan
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-sm font-bold text-white">
            {price.toLocaleString("uz-UZ")}
            <span className="text-[10px] font-normal text-slate-400 ml-0.5">{currencyLabel}</span>
          </span>
          {oldPrice != null && oldPrice > price && (
            <span className="text-[10px] text-slate-500 line-through">
              {oldPrice.toLocaleString("uz-UZ")}
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight mb-2 min-h-[28px]">{name}</p>

        {lowStock && (
          <p className="text-[10px] text-amber-300 mb-1 leading-tight">
            Faqat {stock} ta qoldi
          </p>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); if (!outOfStock) onAddToCart(); }}
          disabled={outOfStock}
          className="w-full py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{ backgroundColor: outOfStock ? "#475569" : qty > 0 ? "#10b981" : primaryColor }}
        >
          {outOfStock ? (
            "Tugagan"
          ) : qty > 0 ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Savatda · {qty} dona
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              Savatga
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export const ProductCard = memo(ProductCardInner);
