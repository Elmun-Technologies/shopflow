import { memo } from "react";
import { Package, Heart, Plus, Minus, ShoppingCart } from "lucide-react";
import { haptic } from "./storefront-theme";

type SaleBadgeColor = "RED" | "ORANGE" | "EMERALD" | "PURPLE" | "BLUE";
const BADGE_STYLES: Record<SaleBadgeColor, { bg: string; text: string }> = {
  RED:     { bg: "#ef4444", text: "#fff" },
  ORANGE:  { bg: "#f97316", text: "#fff" },
  EMERALD: { bg: "#10b981", text: "#fff" },
  PURPLE:  { bg: "#8b5cf6", text: "#fff" },
  BLUE:    { bg: "#3b82f6", text: "#fff" },
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
  avgRating?: number;
  weeklyBuyers?: number;
  onSelect: () => void;
  onToggleFav: () => void;
  onAddToCart: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
}

function ProductCardInner({
  productId: _id,
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
  avgRating,
  weeklyBuyers,
  onSelect,
  onToggleFav,
  onAddToCart,
  onIncrease,
  onDecrease,
}: ProductCardProps) {
  const outOfStock = stock <= 0;
  const lowStock = !outOfStock && stock > 0 && stock <= 5;
  const currencyLabel = currency === "UZS" ? "so'm" : currency;
  const inCart = qty > 0;

  return (
    <div
      className="relative flex flex-col overflow-hidden cursor-pointer"
      style={{
        backgroundColor: "#16161f",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.07)",
      }}
      onClick={onSelect}
    >
      {/* Image area */}
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "4/3", backgroundColor: "#1e1e2a" }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10" style={{ color: "#3a3a50" }} />
          </div>
        )}

        {/* Dimmer when out of stock */}
        {outOfStock && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
          >
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                color: "#94a3b8",
                backdropFilter: "blur(8px)",
              }}
            >
              Tugagan
            </span>
          </div>
        )}

        {/* Top-left badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {discountPct > 0 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#ef4444", color: "#fff" }}
            >
              -{discountPct}%
            </span>
          )}
          {liveCampaign && campaignLabel && campaignBadgeColor && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: BADGE_STYLES[campaignBadgeColor].bg,
                color: BADGE_STYLES[campaignBadgeColor].text,
              }}
            >
              {campaignLabel}
            </span>
          )}
        </div>

        {/* Heart button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            haptic.light();
            onToggleFav();
          }}
          aria-label={isFav ? "Sevimlilardan o'chirish" : "Sevimlilarga qo'shish"}
          className="absolute top-2 right-2 z-10 flex items-center justify-center"
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
            border: isFav ? "1px solid rgba(251,113,133,0.4)" : "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Heart
            className="w-3.5 h-3.5 transition-all"
            fill={isFav ? "#fb7185" : "none"}
            stroke={isFav ? "#fb7185" : "rgba(255,255,255,0.9)"}
            strokeWidth={2}
          />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1 p-3 flex-1">
        {/* Price row */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-bold" style={{ color: "#f4f4f8" }}>
            {price.toLocaleString("uz-UZ")}
            <span className="text-[10px] font-normal ml-0.5" style={{ color: "#6b6b80" }}>
              {currencyLabel}
            </span>
          </span>
          {oldPrice != null && oldPrice > price && (
            <span className="text-[10px] line-through" style={{ color: "#4a4a5e" }}>
              {oldPrice.toLocaleString("uz-UZ")}
            </span>
          )}
        </div>

        {/* Name */}
        <p
          className="text-[11px] leading-snug line-clamp-2 flex-1"
          style={{ color: "#8a8a9e", minHeight: 28 }}
        >
          {name}
        </p>

        {/* Meta row — rating or low stock */}
        {lowStock ? (
          <p className="text-[10px] font-medium" style={{ color: "#f59e0b" }}>
            {stock} ta qoldi
          </p>
        ) : (avgRating && avgRating > 0) ? (
          <div className="flex items-center gap-1">
            <span style={{ color: "#f59e0b", fontSize: 10 }}>★</span>
            <span className="text-[10px] font-medium" style={{ color: "#6b6b80" }}>
              {avgRating.toFixed(1)}
            </span>
            {weeklyBuyers && weeklyBuyers > 0 ? (
              <span className="text-[10px]" style={{ color: "#4a4a5e" }}>
                · {weeklyBuyers} ta buyurtma
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Cart controls */}
        {outOfStock ? (
          <div
            className="mt-1 w-full py-2 rounded-xl flex items-center justify-center text-xs font-medium"
            style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "#4a4a5e" }}
          >
            Sotildi
          </div>
        ) : inCart ? (
          <div
            className="mt-1 flex items-center justify-between rounded-xl px-1 py-1"
            style={{ backgroundColor: primaryColor + "1a", border: `1px solid ${primaryColor}33` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); haptic.soft(); onDecrease(); }}
              className="flex items-center justify-center active:scale-90 transition-transform"
              style={{
                width: 28, height: 28, borderRadius: 10,
                backgroundColor: primaryColor + "30",
                color: primaryColor,
              }}
              aria-label="Kamaytirish"
            >
              <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
            <span className="text-xs font-bold" style={{ color: primaryColor }}>
              {qty} dona
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); haptic.light(); onIncrease(); }}
              className="flex items-center justify-center active:scale-90 transition-transform"
              style={{
                width: 28, height: 28, borderRadius: 10,
                backgroundColor: primaryColor,
                color: "#fff",
              }}
              aria-label="Oshirish"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); haptic.light(); onAddToCart(); }}
            className="mt-1 w-full py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold active:scale-[0.97] transition-transform"
            style={{ backgroundColor: primaryColor + "18", color: primaryColor }}
          >
            <ShoppingCart className="w-3.5 h-3.5" strokeWidth={2} />
            Qo'shish
          </button>
        )}
      </div>
    </div>
  );
}

export const ProductCard = memo(ProductCardInner);
