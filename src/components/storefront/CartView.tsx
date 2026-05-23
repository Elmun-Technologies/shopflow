import { memo } from "react";
import { ArrowLeft, Package, ShoppingCart, Minus, Plus, Trash2 } from "lucide-react";
import { useT } from "../../i18n";
import { haptic } from "./storefront-theme";

interface CartItem {
  productId: string;
  qty: number;
  name: string;
  price: number;
  imageUrl: string | null;
}

function formatPrice(price: number, currency: string): string {
  if (currency === "UZS") return price.toLocaleString("uz-UZ") + " so'm";
  if (currency === "USD") return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2 });
  return price.toLocaleString() + " " + currency;
}

interface CartViewProps {
  cart: CartItem[];
  cartTotal: number;
  cartCount: number;
  currency: string;
  primaryColor: string;
  onBack: () => void;
  onCheckout: () => void;
  onUpdateQty: (productId: string, delta: number) => void;
}

function CartViewInner({
  cart, cartTotal, cartCount, currency, primaryColor,
  onBack, onCheckout, onUpdateQty,
}: CartViewProps) {
  const { t } = useT();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d14" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pb-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center active:scale-90 transition-transform"
          style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: "#1e1e2a",
            color: "#94a3b8",
          }}
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
        <div>
          <h2 className="text-base font-bold" style={{ color: "#f4f4f8" }}>
            {t("cart.title")}
          </h2>
          {cartCount > 0 && (
            <p className="text-xs" style={{ color: "#52526a" }}>
              {cartCount} ta mahsulot
            </p>
          )}
        </div>
      </div>

      {cart.length === 0 ? (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div
            className="flex items-center justify-center mb-5"
            style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: "#1e1e2a" }}
          >
            <ShoppingCart className="w-8 h-8" style={{ color: "#3a3a50" }} />
          </div>
          <p className="text-base font-semibold mb-2" style={{ color: "#f4f4f8" }}>
            {t("cart.empty.title")}
          </p>
          <p className="text-sm text-center mb-6" style={{ color: "#52526a" }}>
            {t("cart.addMore")}
          </p>
          <button
            onClick={onBack}
            className="px-7 py-3 rounded-2xl text-sm font-semibold active:scale-[0.97] transition-transform"
            style={{ backgroundColor: primaryColor, color: "#fff" }}
          >
            {t("cart.shopNow")}
          </button>
        </div>
      ) : (
        <>
          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {cart.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 p-3 rounded-2xl"
                style={{
                  backgroundColor: "#16161f",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Thumbnail */}
                <div
                  className="flex-shrink-0 overflow-hidden"
                  style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: "#1e1e2a" }}
                >
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6" style={{ color: "#3a3a50" }} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#f4f4f8" }}>
                    {item.name}
                  </p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: primaryColor }}>
                    {formatPrice(item.price, currency)}
                  </p>
                </div>

                {/* Qty controls */}
                <div
                  className="flex items-center gap-2 flex-shrink-0 rounded-xl px-1 py-1"
                  style={{ backgroundColor: "#0d0d14" }}
                >
                  <button
                    onClick={() => { haptic.soft(); onUpdateQty(item.productId, -1); }}
                    className="flex items-center justify-center active:scale-90 transition-transform"
                    style={{
                      width: 28, height: 28, borderRadius: 9,
                      backgroundColor: item.qty === 1 ? "#2a1a1a" : "#1e1e2a",
                      color: item.qty === 1 ? "#ef4444" : "#94a3b8",
                    }}
                    aria-label="Kamaytirish"
                  >
                    {item.qty === 1
                      ? <Trash2 className="w-3 h-3" />
                      : <Minus className="w-3 h-3" strokeWidth={2.5} />
                    }
                  </button>
                  <span className="text-sm font-bold w-5 text-center" style={{ color: "#f4f4f8" }}>
                    {item.qty}
                  </span>
                  <button
                    onClick={() => { haptic.light(); onUpdateQty(item.productId, 1); }}
                    className="flex items-center justify-center active:scale-90 transition-transform"
                    style={{
                      width: 28, height: 28, borderRadius: 9,
                      backgroundColor: primaryColor,
                      color: "#fff",
                    }}
                    aria-label="Oshirish"
                  >
                    <Plus className="w-3 h-3" strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary + button */}
          <div
            className="px-4 pb-4"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            {/* Divider with summary */}
            <div
              className="p-4 rounded-2xl mb-3"
              style={{
                backgroundColor: "#16161f",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm" style={{ color: "#52526a" }}>Mahsulotlar ({cartCount} ta)</span>
                <span className="text-sm font-medium" style={{ color: "#94a3b8" }}>
                  {formatPrice(cartTotal, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: "#f4f4f8" }}>Jami to'lov</span>
                <span className="text-base font-bold" style={{ color: primaryColor }}>
                  {formatPrice(cartTotal, currency)}
                </span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor, color: "#fff" }}
            >
              {t("cart.placeOrder")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export const CartView = memo(CartViewInner);
