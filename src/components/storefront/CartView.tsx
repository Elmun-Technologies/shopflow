import { memo, useState, useMemo } from "react";
import {
  ArrowLeft, Package, ShoppingCart,
  Minus, Plus, Trash2, Tag, ChevronRight,
  Truck, CheckCircle2, X,
} from "lucide-react";
import { useT } from "../../i18n";
import { haptic } from "./storefront-theme";

interface CartItem {
  productId: string;
  qty: number;
  name: string;
  price: number;
  oldPrice: number | null;
  imageUrl: string | null;
}

// Telegram WebApp signed initData — backend customer-scoped so'rovlarni
// shu string orqali tasdiqlaydi (tgUserId yolg'iz yetarli emas).
function tgInitData(): string {
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ?? "";
}

function fmt(price: number, currency: string): string {
  if (currency === "UZS") return price.toLocaleString("uz-UZ") + " so'm";
  if (currency === "USD") return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2 });
  return price.toLocaleString() + " " + currency;
}

// Yetkazib berish bo'sag'asi — 500 000 so'm dan yuqori bepul
const FREE_DELIVERY_THRESHOLD = 500_000;
const DELIVERY_PRICE = 25_000;

interface CartViewProps {
  cart: CartItem[];
  cartTotal: number;
  cartCount: number;
  currency: string;
  primaryColor: string;
  storeSlug: string;
  tgUserId?: number;
  onBack: () => void;
  onCheckout: (promoCodeId?: string, promoDiscount?: number) => void;
  onUpdateQty: (productId: string, delta: number) => void;
}

function CartViewInner({
  cart, cartTotal: _cartTotal, cartCount, currency, primaryColor,
  storeSlug, tgUserId,
  onBack, onCheckout, onUpdateQty,
}: CartViewProps) {
  useT();

  // Tanlangan mahsulotlar (checkbox)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(cart.map(i => i.productId))
  );
  // Promo kod
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount: number; promoCodeId: string } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);

  const allSelected = cart.length > 0 && cart.every(i => selected.has(i.productId));

  const toggleAll = () => {
    haptic.light();
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(cart.map(i => i.productId)));
  };

  const toggleItem = (id: string) => {
    haptic.soft();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const API_BASE = typeof window !== "undefined"
    ? (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "/api"
    : "/api";

  // Faqat tanlangan tovarlar hisobiga
  const selectedItems = cart.filter(i => selected.has(i.productId));
  const selectedSubtotal = selectedItems.reduce((s, i) => s + i.price * i.qty, 0);
  const selectedCount = selectedItems.reduce((s, i) => s + i.qty, 0);

  // Chegirma (eski narx - yangi narx)
  const savingsTotal = useMemo(() =>
    selectedItems.reduce((s, i) => {
      if (i.oldPrice && i.oldPrice > i.price) return s + (i.oldPrice - i.price) * i.qty;
      return s;
    }, 0),
    [selectedItems]
  );

  // Promo kod chegirmasi
  const promoDiscount = promoApplied?.discount ?? 0;

  // Yetkazib berish
  const isFreeDelivery = selectedSubtotal >= FREE_DELIVERY_THRESHOLD;
  const deliveryCost = isFreeDelivery ? 0 : DELIVERY_PRICE;
  const progressToFree = Math.min((selectedSubtotal / FREE_DELIVERY_THRESHOLD) * 100, 100);

  const grandTotal = selectedSubtotal - promoDiscount + deliveryCost;

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await fetch(`${API_BASE}/storefront/${storeSlug}/promo/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, total: selectedSubtotal, tgUserId, initData: tgInitData() }),
      });
      const body = await res.json().catch(() => ({})) as { discount?: number; promoCodeId?: string; error?: string };
      if (!res.ok || !body.discount) {
        setPromoError(body.error ?? "Noto'g'ri promo kod");
        haptic.error();
      } else {
        setPromoApplied({ code, discount: body.discount, promoCodeId: body.promoCodeId! });
        setPromoError(null);
        setPromoOpen(false);
        setPromoInput("");
        haptic.success();
      }
    } catch {
      setPromoError("Tarmoq xatosi — qaytadan urinib ko'ring");
      haptic.error();
    } finally {
      setPromoLoading(false);
    }
  };

  // Bo'sh savat
  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d14" }}>
        <div
          className="flex items-center gap-3 px-4 pb-4"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <button
            onClick={onBack}
            className="flex items-center justify-center active:scale-90 transition-transform"
            style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#1e1e2a", color: "#94a3b8" }}
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <h2 className="text-base font-bold" style={{ color: "#f4f4f8" }}>Savat</h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div
            className="flex items-center justify-center mb-5"
            style={{ width: 80, height: 80, borderRadius: 26, backgroundColor: "#16161f", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <ShoppingCart className="w-9 h-9" style={{ color: "#3a3a50" }} />
          </div>
          <p className="text-lg font-bold mb-2" style={{ color: "#f4f4f8" }}>Savat bo'sh</p>
          <p className="text-sm text-center mb-8 leading-relaxed" style={{ color: "#52526a" }}>
            Mahsulotlarni savatga qo'shing va buyurtma bering
          </p>
          <button
            onClick={onBack}
            className="px-8 py-3.5 rounded-2xl text-sm font-bold active:scale-[0.97] transition-transform"
            style={{ backgroundColor: primaryColor, color: "#fff" }}
          >
            Xarid qilishni boshlash
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d14" }}>

      {/* ─── Header ─── */}
      <div
        className="sticky top-0 z-20 px-4 pb-3"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          backgroundColor: "rgba(13,13,20,0.97)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center justify-center active:scale-90 transition-transform"
              style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: "#1e1e2a", color: "#94a3b8" }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base font-bold" style={{ color: "#f4f4f8" }}>
                Savat
              </h2>
              <p className="text-[11px]" style={{ color: "#52526a" }}>
                {cartCount} ta mahsulot
              </p>
            </div>
          </div>

          {/* Hammasini tanlash */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
            style={{ backgroundColor: "#1e1e2a" }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 18, height: 18, borderRadius: 6,
                backgroundColor: allSelected ? primaryColor : "transparent",
                border: allSelected ? "none" : "1.5px solid rgba(255,255,255,0.2)",
              }}
            >
              {allSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
            </div>
            <span className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>
              {allSelected ? "Bekor qilish" : "Hammasini tanlash"}
            </span>
          </button>
        </div>
      </div>

      {/* ─── Items ─── */}
      <div className="flex-1 overflow-y-auto">
        {/* Bepul yetkazish progressi */}
        {!isFreeDelivery && selectedSubtotal > 0 && (
          <div className="px-4 pt-3 pb-1">
            <div
              className="px-4 py-3 rounded-2xl"
              style={{ backgroundColor: "#16161f", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4" style={{ color: "#38bdf8" }} />
                <span className="text-xs font-medium" style={{ color: "#94a3b8" }}>
                  Bepul yetkazish uchun yana{" "}
                  <span className="font-bold" style={{ color: "#f4f4f8" }}>
                    {fmt(FREE_DELIVERY_THRESHOLD - selectedSubtotal, currency)}
                  </span>
                  {" "}kerak
                </span>
              </div>
              <div className="relative h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#2a2a38" }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressToFree}%`, backgroundColor: "#38bdf8" }}
                />
              </div>
            </div>
          </div>
        )}

        {isFreeDelivery && (
          <div className="px-4 pt-3 pb-1">
            <div
              className="px-4 py-2.5 rounded-2xl flex items-center gap-2"
              style={{ backgroundColor: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)" }}
            >
              <Truck className="w-4 h-4" style={{ color: "#38bdf8" }} />
              <span className="text-xs font-semibold" style={{ color: "#7dd3fc" }}>
                Tabriklaymiz! Bepul yetkazish faollashdi
              </span>
            </div>
          </div>
        )}

        <div className="px-4 pt-3 pb-4 space-y-3">
          {cart.map((item) => {
            const isSelected = selected.has(item.productId);
            const lineTotal = item.price * item.qty;
            const oldLineTotal = item.oldPrice ? item.oldPrice * item.qty : null;
            const savedPerItem = item.oldPrice && item.oldPrice > item.price
              ? Math.round(((item.oldPrice - item.price) / item.oldPrice) * 100)
              : 0;

            return (
              <div
                key={item.productId}
                className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: "#16161f",
                  border: isSelected
                    ? `1px solid ${primaryColor}30`
                    : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="p-3">
                  <div className="flex gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(item.productId)}
                      className="flex-shrink-0 mt-1 active:scale-90 transition-transform"
                      aria-label={isSelected ? "Tanlovdan olib tashlash" : "Tanlash"}
                    >
                      <div
                        className="flex items-center justify-center"
                        style={{
                          width: 20, height: 20, borderRadius: 6,
                          backgroundColor: isSelected ? primaryColor : "transparent",
                          border: isSelected ? "none" : "1.5px solid rgba(255,255,255,0.2)",
                        }}
                      >
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                    </button>

                    {/* Image */}
                    <div
                      className="flex-shrink-0 overflow-hidden"
                      style={{ width: 80, height: 80, borderRadius: 14, backgroundColor: "#1e1e2a" }}
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
                          <Package className="w-7 h-7" style={{ color: "#3a3a50" }} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium leading-snug line-clamp-2 mb-1.5"
                        style={{ color: "#f4f4f8" }}
                      >
                        {item.name}
                      </p>

                      {/* Prices */}
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-base font-bold" style={{ color: primaryColor }}>
                          {fmt(lineTotal, currency)}
                        </span>
                        {oldLineTotal && oldLineTotal > lineTotal && (
                          <span className="text-xs line-through" style={{ color: "#3a3a50" }}>
                            {fmt(oldLineTotal, currency)}
                          </span>
                        )}
                      </div>

                      {/* Unit price */}
                      <p className="text-[11px] mt-0.5" style={{ color: "#52526a" }}>
                        {fmt(item.price, currency)} / dona
                      </p>

                      {/* Discount badge */}
                      {savedPerItem > 0 && (
                        <span
                          className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                          style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171" }}
                        >
                          -{savedPerItem}% chegirma
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom row: qty controls + delete */}
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    {/* Qty stepper */}
                    <div
                      className="flex items-center gap-1 rounded-xl"
                      style={{ backgroundColor: "#0d0d14", padding: "3px" }}
                    >
                      <button
                        onClick={() => { haptic.soft(); onUpdateQty(item.productId, -1); }}
                        className="flex items-center justify-center active:scale-90 transition-transform"
                        style={{
                          width: 32, height: 32, borderRadius: 9,
                          backgroundColor: item.qty === 1 ? "rgba(239,68,68,0.12)" : "#1e1e2a",
                          color: item.qty === 1 ? "#f87171" : "#94a3b8",
                        }}
                        aria-label="Kamaytirish"
                      >
                        {item.qty === 1
                          ? <Trash2 className="w-3.5 h-3.5" />
                          : <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                        }
                      </button>
                      <span
                        className="text-sm font-bold text-center"
                        style={{ minWidth: 36, color: "#f4f4f8" }}
                      >
                        {item.qty} dona
                      </span>
                      <button
                        onClick={() => { haptic.light(); onUpdateQty(item.productId, 1); }}
                        className="flex items-center justify-center active:scale-90 transition-transform"
                        style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: primaryColor, color: "#fff" }}
                        aria-label="Oshirish"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                    </div>

                    {/* Total per line */}
                    <div className="text-right">
                      <p className="text-xs" style={{ color: "#52526a" }}>Jami</p>
                      <p className="text-sm font-bold" style={{ color: "#f4f4f8" }}>
                        {fmt(lineTotal, currency)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Promo kod ─── */}
        <div className="px-4 pb-4">
          {promoApplied ? (
            <div
              className="flex items-center justify-between px-4 py-3 rounded-2xl"
              style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
            >
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" style={{ color: "#34d399" }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "#34d399" }}>
                    {promoApplied?.code} — chegirma qo'llanildi
                  </p>
                  <p className="text-[11px]" style={{ color: "#52526a" }}>
                    -{fmt(promoDiscount, currency)} tejaysiz
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setPromoApplied(null); haptic.light(); }}
                style={{ color: "#52526a" }}
                aria-label="Promo kodni o'chirish"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : promoOpen ? (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: "#16161f", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2 p-3">
                <Tag className="w-4 h-4 flex-shrink-0" style={{ color: "#52526a" }} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Promo kodni kiriting"
                  value={promoInput}
                  onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") applyPromo(); }}
                  className="flex-1 bg-transparent text-sm font-mono outline-none"
                  style={{ color: "#f4f4f8" }}
                />
                <button
                  onClick={applyPromo}
                  disabled={promoLoading}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-transform flex items-center gap-1.5 disabled:opacity-70"
                  style={{ backgroundColor: primaryColor, color: "#fff" }}
                >
                  {promoLoading && <span className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin" />}
                  Qo'llash
                </button>
                <button onClick={() => { setPromoOpen(false); setPromoError(null); }} style={{ color: "#52526a" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              {promoError && (
                <p className="px-4 pb-3 text-xs" style={{ color: "#f87171" }}>{promoError}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => { setPromoOpen(true); haptic.light(); }}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
              style={{ backgroundColor: "#16161f", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-2.5">
                <Tag className="w-4 h-4" style={{ color: "#52526a" }} />
                <span className="text-sm font-medium" style={{ color: "#94a3b8" }}>
                  Promo kod bormi?
                </span>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "#3a3a50" }} />
            </button>
          )}
        </div>

        {/* ─── Order summary ─── */}
        <div className="px-4 pb-6">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: "#16161f", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#3a3a50" }}>
                Buyurtma xulosasi
              </p>
            </div>

            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "#52526a" }}>
                  Mahsulotlar ({selectedCount} ta)
                </span>
                <span className="text-sm font-medium" style={{ color: "#94a3b8" }}>
                  {fmt(selectedSubtotal, currency)}
                </span>
              </div>

              {savingsTotal > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#52526a" }}>Chegirma</span>
                  <span className="text-sm font-semibold" style={{ color: "#34d399" }}>
                    -{fmt(savingsTotal, currency)}
                  </span>
                </div>
              )}

              {promoDiscount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#52526a" }}>Promo ({promoApplied?.code})</span>
                  <span className="text-sm font-semibold" style={{ color: "#34d399" }}>
                    -{fmt(promoDiscount, currency)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "#52526a" }}>Yetkazib berish</span>
                {isFreeDelivery ? (
                  <span className="text-sm font-semibold" style={{ color: "#34d399" }}>Bepul</span>
                ) : (
                  <span className="text-sm font-medium" style={{ color: "#94a3b8" }}>
                    {fmt(deliveryCost, currency)}
                  </span>
                )}
              </div>

              <div
                className="flex items-center justify-between pt-2.5 mt-1"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="text-base font-bold" style={{ color: "#f4f4f8" }}>Jami to'lov</span>
                <span className="text-xl font-bold" style={{ color: primaryColor }}>
                  {fmt(grandTotal, currency)}
                </span>
              </div>

              {savingsTotal + promoDiscount > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ backgroundColor: "rgba(52,211,153,0.08)" }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#34d399" }} />
                  <span className="text-xs" style={{ color: "#34d399" }}>
                    Siz <b>{fmt(savingsTotal + promoDiscount, currency)}</b> tejadingiz!
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sticky Checkout Button ─── */}
      <div
        className="px-4 pt-3"
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          backgroundColor: "rgba(13,13,20,0.97)",
          backdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {selectedCount === 0 ? (
          <button
            disabled
            className="w-full py-4 rounded-2xl font-bold text-base text-center"
            style={{ backgroundColor: "#1e1e2a", color: "#3a3a50" }}
          >
            Mahsulot tanlang
          </button>
        ) : (
          <button
            onClick={() => { haptic.light(); onCheckout(promoApplied?.promoCodeId, promoApplied?.discount); }}
            className="w-full py-4 rounded-2xl font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-between px-5"
            style={{ backgroundColor: primaryColor, color: "#fff" }}
          >
            <span
              className="flex items-center justify-center text-xs font-bold rounded-xl"
              style={{ minWidth: 28, height: 28, backgroundColor: "rgba(255,255,255,0.2)", padding: "0 8px" }}
            >
              {selectedCount}
            </span>
            <span className="font-bold">Buyurtma berish</span>
            <span className="font-bold">{fmt(grandTotal, currency)}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export const CartView = memo(CartViewInner);
