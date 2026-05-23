import { memo } from "react";
import { ArrowLeft, Package, ShoppingCart, Minus, Plus } from "lucide-react";
import { useT } from "../../i18n";

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
  cart,
  cartTotal,
  cartCount,
  currency,
  primaryColor,
  onBack,
  onCheckout,
  onUpdateQty,
}: CartViewProps) {
  const { t } = useT();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-slate-800">
        <button onClick={onBack} className="p-2 rounded-xl text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold text-white">{t("cart.title")}</h2>
        <span className="ml-1 text-xs text-slate-400">{t("cart.items", { count: cartCount })}</span>
      </div>

      {cart.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4">
            <ShoppingCart className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-white font-medium mb-1">{t("cart.empty.title")}</p>
          <p className="text-sm text-slate-400">{t("cart.addMore")}</p>
          <button
            onClick={onBack}
            className="mt-4 px-6 py-2.5 rounded-2xl text-sm font-medium text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {t("cart.shopNow")}
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.map((item) => (
              <div key={item.productId} className="bg-slate-900 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <Package className="w-7 h-7 text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: primaryColor }}>
                    {formatPrice(item.price, currency)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onUpdateQty(item.productId, -1)}
                    className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 active:scale-90 transition-transform"
                    aria-label="Kamaytrish"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-semibold text-white w-5 text-center">{item.qty}</span>
                  <button
                    onClick={() => onUpdateQty(item.productId, 1)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                    style={{ backgroundColor: primaryColor }}
                    aria-label="Oshirish"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-400">{t("cart.totalItems", { count: cartCount })}</span>
              <span className="text-lg font-bold text-white">{formatPrice(cartTotal, currency)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98]"
              style={{ backgroundColor: primaryColor }}
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
