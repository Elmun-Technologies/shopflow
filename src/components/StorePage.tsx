// Telegram Mini App (Web App) — mijozlarga ko'rsatiladigan ommaviy do'kon sahifasi.
// Auth talab qilinmaydi. /api/storefront/:slug orqali ma'lumot olinadi.

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import {
  ShoppingCart, Search, Package, ChevronRight, Minus, Plus,
  X, CheckCircle2, Loader2, ArrowLeft, Phone, MapPin, User,
  Tag,
} from "lucide-react";
import { BottomNav, type StoreTab } from "./storefront/BottomNav";
import { applyTelegramTheme, haptic } from "./storefront/storefront-theme";
import { ProductGridSkeleton } from "./storefront/Skeleton";
import { ToastProvider, useToast } from "./storefront/Toast";

// Profile sahifasi katta — faqat foydalanuvchi ochsa yuklaymiz
const ProfilePage = lazy(() => import("./storefront/ProfilePage").then((m) => ({ default: m.ProfilePage })));

// Telegram Web App types
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        themeParams?: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
        MainButton?: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
          offClick: (fn: () => void) => void;
          setText: (text: string) => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive: boolean) => void;
          hideProgress: () => void;
        };
        HapticFeedback?: {
          impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          notificationOccurred: (type: "error" | "success" | "warning") => void;
        };
        BackButton?: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (fn: () => void) => void;
          offClick: (fn: () => void) => void;
        };
      };
    };
  }
}

type StoreProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: string | number;
  oldPrice: string | number | null;
  currency: string;
  stock: number;
  imageUrl: string | null;
  images: string[];
  featured: boolean;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
};

type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
};

type StoreBlock = {
  id: string;
  type: string;
  title: string;
  enabled: boolean;
  settings: Record<string, unknown>;
};

type StoreBrand = {
  name?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  phone?: string;
  email?: string;
  address?: string;
};

type StorefrontData = {
  tenant: { id: string; name: string; slug: string; currency: string };
  layout: StoreBlock[];
  brand: StoreBrand;
  products: StoreProduct[];
  categories: StoreCategory[];
};

type CartItem = {
  productId: string;
  qty: number;
  name: string;
  price: number;
  imageUrl: string | null;
};

type CheckoutForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

type StoreView = "home" | "catalog" | "promotions" | "profile" | "category" | "cart" | "checkout" | "success";

const TAB_VIEWS: Record<StoreTab, StoreView> = {
  home: "home",
  catalog: "catalog",
  cart: "cart",
  promotions: "promotions",
  profile: "profile",
};

function viewToTab(v: StoreView): StoreTab | null {
  if (v === "home") return "home";
  if (v === "catalog" || v === "category") return "catalog";
  if (v === "cart") return "cart";
  if (v === "promotions") return "promotions";
  if (v === "profile") return "profile";
  return null;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function fetchStorefront(slug: string): Promise<StorefrontData> {
  const res = await fetch(`${API_BASE}/storefront/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Server xatosi" }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function submitCheckout(
  slug: string,
  payload: {
    customer: CheckoutForm;
    items: { productId: string; qty: number }[];
    telegram?: { userId?: number; username?: string; firstName?: string; lastName?: string };
  }
): Promise<{ id: string; code: string; total: number; currency: string }> {
  const res = await fetch(`${API_BASE}/storefront/${encodeURIComponent(slug)}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Server xatosi" }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

function formatPrice(price: string | number, currency: string): string {
  const n = Number(price);
  if (currency === "UZS") return n.toLocaleString("uz-UZ") + " so'm";
  if (currency === "USD") return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });
  return n.toLocaleString() + " " + currency;
}

export default function StorePage(props: { slug: string }) {
  return (
    <ToastProvider>
      <StoreInner {...props} />
    </ToastProvider>
  );
}

function StoreInner({ slug }: { slug: string }) {
  const [data, setData] = useState<StorefrontData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<StoreView>("home");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [form, setForm] = useState<CheckoutForm>({ name: "", phone: "", email: "", address: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<{ code: string; total: number; currency: string } | null>(null);
  const toast = useToast();

  // Telegram WebApp — darhol ready() chaqirish (yuklanish ekranini yashirish uchun)
  const twa = window.Telegram?.WebApp;
  useEffect(() => {
    try {
      twa?.ready();
      twa?.expand();
    } catch {
      // Telegram WebApp mavjud bo'lmagan muhitda xatolikni e'tiborsiz qoldiramiz
    }

    // Pre-fill name from Telegram
    const tgUser = twa?.initDataUnsafe?.user;
    if (tgUser) {
      const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ");
      setForm((prev) => ({ ...prev, name: prev.name || fullName }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primaryColor = data?.brand?.primaryColor || "#10b981";

  // Telegram theme'ni va brand color'ni CSS variable'lariga joylab qo'yamiz
  useEffect(() => {
    applyTelegramTheme(data?.brand?.primaryColor);
  }, [data?.brand?.primaryColor]);

  useEffect(() => {
    fetchStorefront(slug)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  // Telegram BackButton management — faqat checkout/success/category'da ko'rsatiladi
  // (asosiy 5 tab uchun BottomNav o'zi navigatsiya qiladi)
  useEffect(() => {
    const bb = twa?.BackButton;
    if (!bb) return;
    const isMainTab = viewToTab(view) !== null;
    if (!isMainTab) {
      bb.show();
      const handler = () => {
        if (view === "checkout") { setView("cart"); return; }
        if (view === "success") { setView("home"); return; }
        setView("home");
      };
      bb.onClick(handler);
      return () => bb.offClick(handler);
    } else {
      bb.hide();
    }
  }, [view, twa]);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const addToCart = useCallback((product: StoreProduct) => {
    haptic.light();
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      toast.show(`${product.name} savatga qo'shildi`, "success");
      return [...prev, {
        productId: product.id,
        qty: 1,
        name: product.name,
        price: Number(product.price),
        imageUrl: product.imageUrl,
      }];
    });
  }, [toast]);

  const updateQty = useCallback((productId: string, delta: number) => {
    haptic.soft();
    setCart((prev) => {
      const item = prev.find((i) => i.productId === productId);
      if (!item) return prev;
      const newQty = item.qty + delta;
      if (newQty <= 0) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) => i.productId === productId ? { ...i, qty: newQty } : i);
    });
  }, []);

  const cartQty = useCallback((productId: string) => {
    return cart.find((i) => i.productId === productId)?.qty ?? 0;
  }, [cart]);

  const handleCheckout = useCallback(async () => {
    if (!data) return;
    if (!form.name.trim() || !form.phone.trim()) {
      setSubmitError("Ism va telefon raqam kiritish shart");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const tgUser = twa?.initDataUnsafe?.user;
      const result = await submitCheckout(slug, {
        customer: form,
        items: cart.map((i) => ({ productId: i.productId, qty: i.qty })),
        telegram: tgUser ? {
          userId: tgUser.id,
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
        } : undefined,
      });
      setOrderResult(result);
      setCart([]);
      setView("success");
      twa?.HapticFeedback?.notificationOccurred("success");
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Xato yuz berdi");
      twa?.HapticFeedback?.notificationOccurred("error");
    } finally {
      setSubmitting(false);
    }
  }, [data, form, cart, slug, twa]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    let prods = data.products;
    if (selectedCategoryId) prods = prods.filter((p) => p.categoryId === selectedCategoryId);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      prods = prods.filter((p) => p.name.toLowerCase().includes(q));
    }
    return prods;
  }, [data, selectedCategoryId, searchQuery]);

  // ---- LOADING ----
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        {/* Header skeleton */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-slate-800 rounded-full w-1/2 animate-pulse" />
            <div className="h-2.5 bg-slate-800 rounded-full w-1/3 animate-pulse" />
          </div>
        </div>
        {/* Category chips skeleton */}
        <div className="px-3 py-2 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 bg-slate-800 rounded-lg animate-pulse flex-shrink-0" style={{ width: 60 + (i % 3) * 20 }} />
          ))}
        </div>
        {/* Product grid skeleton */}
        <div className="p-3">
          <ProductGridSkeleton count={6} />
        </div>
      </div>
    );
  }

  // ---- ERROR ----
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-white font-semibold mb-1">Do'kon topilmadi</p>
          <p className="text-sm text-slate-400">{error || "Noma'lum xato"}</p>
        </div>
      </div>
    );
  }

  const { brand, products, categories, layout } = data;
  void layout;
  const featuredProducts = products.filter((p) => p.featured) ?? [];
  const promotionProducts = featuredProducts.length > 0 ? featuredProducts : products;
  const currentTab = viewToTab(view);
  const tgUserRaw = twa?.initDataUnsafe?.user;
  const telegramUser = tgUserRaw
    ? { userId: tgUserRaw.id, username: tgUserRaw.username, firstName: tgUserRaw.first_name, lastName: tgUserRaw.last_name }
    : undefined;

  // ---- SUCCESS ----
  if (view === "success" && orderResult) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-xs w-full">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: primaryColor + "20" }}>
            <CheckCircle2 className="w-10 h-10" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Buyurtma qabul qilindi!</h2>
          <div className="bg-slate-900 rounded-2xl p-4 mb-6">
            <p className="text-xs text-slate-400 mb-1">Buyurtma raqami</p>
            <p className="text-lg font-bold text-white">{orderResult.code}</p>
            <div className="mt-3 pt-3 border-t border-slate-800">
              <p className="text-xs text-slate-400 mb-0.5">Jami summa</p>
              <p className="text-base font-semibold" style={{ color: primaryColor }}>
                {formatPrice(orderResult.total, orderResult.currency)}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-6">Tez orada operatorimiz siz bilan bog'lanadi.</p>
          <button
            onClick={() => { setView("home"); setOrderResult(null); }}
            className="w-full py-3 rounded-2xl font-semibold text-white transition-all active:scale-[0.98]"
            style={{ backgroundColor: primaryColor }}
          >
            Bosh sahifaga
          </button>
        </div>
      </div>
    );
  }

  // ---- CHECKOUT ----
  if (view === "checkout") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-slate-800">
          <button onClick={() => setView("cart")} className="p-2 rounded-xl text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-white">Buyurtma rasmiylashtirish</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Order summary */}
          <div className="bg-slate-900 rounded-2xl p-4">
            <h3 className="text-xs font-medium text-slate-400 mb-3">Buyurtma tarkibi</h3>
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <span className="text-sm text-white">{item.name} <span className="text-slate-500">×{item.qty}</span></span>
                <span className="text-sm font-medium" style={{ color: primaryColor }}>
                  {formatPrice(item.price * item.qty, data.tenant.currency)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 mt-1">
              <span className="text-sm font-semibold text-white">Jami</span>
              <span className="text-base font-bold" style={{ color: primaryColor }}>
                {formatPrice(cartTotal, data.tenant.currency)}
              </span>
            </div>
          </div>

          {/* Customer form */}
          <div className="bg-slate-900 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-medium text-slate-400 mb-1">Ma'lumotlaringiz</h3>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Ism *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="To'liq ismingiz"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Telefon *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="tel"
                  placeholder="+998 90 123 45 67"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Manzil</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Yetkazib berish manzili"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Izoh</label>
              <textarea
                placeholder="Qo'shimcha izoh (ixtiyoriy)"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
          </div>

          {submitError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-sm text-red-400">{submitError}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <button
            onClick={handleCheckout}
            disabled={submitting || !form.name.trim() || !form.phone.trim()}
            className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {submitting ? "Yuborilmoqda..." : `Buyurtma berish · ${formatPrice(cartTotal, data.tenant.currency)}`}
          </button>
        </div>
      </div>
    );
  }

  // ---- CART ----
  if (view === "cart") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-slate-800">
          <button onClick={() => setView("home")} className="p-2 rounded-xl text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-white">Savat</h2>
          <span className="ml-1 text-xs text-slate-400">{cartCount} ta</span>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-white font-medium mb-1">Savat bo'sh</p>
            <p className="text-sm text-slate-400">Mahsulot qo'shing</p>
            <button
              onClick={() => setView("home")}
              className="mt-4 px-6 py-2.5 rounded-2xl text-sm font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Xarid qilish
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div key={item.productId} className="bg-slate-900 rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-16 h-16 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-7 h-7 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.name}</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: primaryColor }}>
                      {formatPrice(item.price, data.tenant.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => updateQty(item.productId, -1)}
                      className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 active:scale-90 transition-transform"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-semibold text-white w-5 text-center">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.productId, 1)}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">Jami ({cartCount} mahsulot)</span>
                <span className="text-lg font-bold text-white">{formatPrice(cartTotal, data.tenant.currency)}</span>
              </div>
              <button
                onClick={() => setView("checkout")}
                className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98]"
                style={{ backgroundColor: primaryColor }}
              >
                Buyurtma berish
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ---- PRODUCT DETAIL ----
  const renderProductDetail = () => {
    if (!selectedProduct) return null;
    const qty = cartQty(selectedProduct.id);
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
        <div className="px-4 pt-4 pb-2 flex items-center gap-3">
          <button onClick={() => setSelectedProduct(null)} className="p-2 rounded-xl text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="w-full aspect-square bg-slate-900 flex items-center justify-center overflow-hidden">
            {selectedProduct.imageUrl ? (
              <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-20 h-20 text-slate-600" />
            )}
          </div>
          <div className="p-4">
            <h2 className="text-xl font-bold text-white mb-2">{selectedProduct.name}</h2>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                {formatPrice(selectedProduct.price, data.tenant.currency)}
              </span>
              {selectedProduct.oldPrice != null && Number(selectedProduct.oldPrice) > 0 && (
                <span className="text-base text-slate-500 line-through">
                  {formatPrice(selectedProduct.oldPrice, data.tenant.currency)}
                </span>
              )}
            </div>
            {selectedProduct.description && (
              <p className="text-sm text-slate-400 leading-relaxed">{selectedProduct.description}</p>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          {qty === 0 ? (
            <button
              onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
              className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98]"
              style={{ backgroundColor: primaryColor }}
            >
              Savatga qo'shish
            </button>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateQty(selectedProduct.id, -1)}
                  className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-white active:scale-90 transition-transform"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-xl font-bold text-white w-8 text-center">{qty}</span>
                <button
                  onClick={() => updateQty(selectedProduct.id, 1)}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-transform"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="flex-1 ml-3 py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98]"
                style={{ backgroundColor: primaryColor }}
              >
                Savatga o'tish
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---- HOME ----
  const renderProductCard = (product: StoreProduct) => {
    const qty = cartQty(product.id);
    return (
      <div
        key={product.id}
        className="bg-slate-900 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
        onClick={() => setSelectedProduct(product)}
      >
        <div className="aspect-square bg-slate-800 flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="w-10 h-10 text-slate-600" />
          )}
        </div>
        <div className="p-2.5">
          <p className="text-xs text-white font-medium line-clamp-2 leading-tight mb-1.5">{product.name}</p>
          <div className="flex items-center justify-between gap-1">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: primaryColor }}>
                {formatPrice(product.price, data.tenant.currency)}
              </p>
              {product.oldPrice != null && Number(product.oldPrice) > 0 && (
                <p className="text-[10px] text-slate-500 line-through">
                  {formatPrice(product.oldPrice, data.tenant.currency)}
                </p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); addToCart(product); }}
              className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-white active:scale-90 transition-transform"
              style={{ backgroundColor: qty > 0 ? "#10b981" : primaryColor }}
            >
              {qty > 0 ? <span className="text-[10px] font-bold">{qty}</span> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render blocks from layout, or fall back to plain products grid
  // ---- PROFILE ----
  if (view === "profile") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
              </div>
            }
          >
            <ProfilePage
              storeSlug={slug}
              tenantName={data.tenant.name}
              telegramUser={telegramUser}
              operatorTelegram={brand?.phone || undefined}
              apiBase={API_BASE}
            />
          </Suspense>
        </div>
        <BottomNav active="profile" cartCount={cartCount} primaryColor={primaryColor} onChange={(t) => setView(TAB_VIEWS[t])} />
      </div>
    );
  }

  // ---- PROMOTIONS ----
  if (view === "promotions") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="sticky top-0 bg-slate-950 border-b border-slate-800 z-30 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Tag className="w-5 h-5" style={{ color: primaryColor }} />
            Maxsus takliflar
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto pb-24 p-3">
          {promotionProducts.length === 0 ? (
            <div className="py-16 text-center">
              <Tag className="w-12 h-12 mx-auto text-slate-700 mb-3" />
              <p className="text-sm text-slate-400">Hozircha takliflar yo'q</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {promotionProducts.map(renderProductCard)}
            </div>
          )}
        </div>
        <BottomNav active="promotions" cartCount={cartCount} primaryColor={primaryColor} onChange={(t) => setView(TAB_VIEWS[t])} />
        {selectedProduct && renderProductDetail()}
      </div>
    );
  }

  // ---- CATALOG ----
  if (view === "catalog") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="sticky top-0 bg-slate-950 border-b border-slate-800 z-30 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <h2 className="text-base font-semibold text-white">Katalog</h2>
        </div>
        {categories.length > 0 && (
          <div className="bg-slate-950 border-b border-slate-800 px-3 py-2 overflow-x-auto whitespace-nowrap flex gap-2">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                !selectedCategoryId ? "text-white" : "bg-slate-800 text-slate-400"
              }`}
              style={!selectedCategoryId ? { backgroundColor: primaryColor } : {}}
            >
              Barchasi
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  selectedCategoryId === cat.id ? "text-white" : "bg-slate-800 text-slate-400"
                }`}
                style={selectedCategoryId === cat.id ? { backgroundColor: primaryColor } : {}}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto pb-24 p-3">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-12 h-12 mx-auto text-slate-700 mb-3" />
              <p className="text-sm text-slate-400">Bu bo'limda mahsulot yo'q</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">{filteredProducts.map(renderProductCard)}</div>
          )}
        </div>
        <BottomNav active="catalog" cartCount={cartCount} primaryColor={primaryColor} onChange={(t) => setView(TAB_VIEWS[t])} />
        {selectedProduct && renderProductDetail()}
      </div>
    );
  }

  const renderHomeContent = () => {
    const enabledBlocks = layout.filter((b) => b.enabled);

    // If no layout blocks saved, show default products view
    if (enabledBlocks.length === 0) {
      return (
        <div className="p-4">
          {selectedCategoryId === null && categories.length > 0 && (
            <h2 className="text-sm font-semibold text-white mb-3">Barcha mahsulotlar</h2>
          )}
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map(renderProductCard)}
          </div>
          {filteredProducts.length === 0 && (
            <div className="py-12 text-center">
              <Package className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Mahsulotlar topilmadi</p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4 p-4">
        {enabledBlocks.map((block) => {
          const s = block.settings as Record<string, unknown>;
          switch (block.type) {
            case "hero_banner":
              return (
                <div
                  key={block.id}
                  className="w-full rounded-2xl overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${(s.bgColor as string) || primaryColor}, ${brand.secondaryColor || "#6366f1"})` }}
                >
                  <div className="p-5">
                    <h2 className="text-lg font-bold text-white">{String(s.title ?? "")}</h2>
                    {!!s.subtitle && <p className="text-xs text-white/80 mt-1">{String(s.subtitle)}</p>}
                    {!!s.buttonText && (
                      <button className="mt-3 px-4 py-2 bg-white text-slate-900 text-xs font-semibold rounded-xl">
                        {String(s.buttonText)}
                      </button>
                    )}
                  </div>
                </div>
              );

            case "announcement":
              return (
                <div
                  key={block.id}
                  className="py-2.5 px-4 rounded-xl text-center"
                  style={{ backgroundColor: (s.bgColor as string) || "#f59e0b" }}
                >
                  <p className="text-xs text-white font-medium">{String(s.text ?? "")}</p>
                </div>
              );

            case "search":
              return (
                <div key={block.id} className="bg-slate-800 rounded-2xl px-3 py-3 flex items-center gap-2" onClick={() => setShowSearch(true)}>
                  <Search className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-500">{(s.placeholder as string) || "Mahsulot qidirish..."}</span>
                </div>
              );

            case "popular_categories": {
              const count = (s.count as number) || 6;
              const cats = categories.slice(0, count);
              // Kategoriya yo'q bo'lsa skeleton ko'rsat
              const catItems = cats.length > 0
                ? cats
                : Array.from({ length: count }, (_, i) => ({ id: `ph-${i}`, name: `Kategoriya ${i + 1}`, slug: "", parentId: null, createdAt: "" }));
              return (
                <div key={block.id}>
                  <h3 className="text-sm font-semibold text-white mb-3">{block.title}</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {catItems.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => cats.length > 0 && setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
                        className={`rounded-2xl p-3 text-center transition-colors ${selectedCategoryId === cat.id ? "ring-2" : "bg-slate-900"} ${cats.length === 0 ? "opacity-40 cursor-default" : ""}`}
                        style={selectedCategoryId === cat.id ? { backgroundColor: primaryColor + "20" } : {}}
                      >
                        <div className="w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1.5" style={{ backgroundColor: primaryColor + "25" }}>
                          <span className="text-base">{cat.name[0]}</span>
                        </div>
                        <p className="text-[11px] text-white">{cat.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            case "new_products":
            case "discounts":
            case "trending":
            case "bestsellers":
            case "recommended":
            case "category_products": {
              const count = (s.count as number) || 4;
              const catName = s.category as string | undefined;
              let blockProds = catName
                ? products.filter((p) => p.category?.name === catName)
                : products;
              blockProds = blockProds.slice(0, count);
              // Mahsulot yo'q bo'lsa skeleton placeholder ko'rsat
              const showSkeleton = blockProds.length === 0;
              const skeletonCount = Math.min(count, 4);
              return (
                <div key={block.id}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-white">{block.title}</h3>
                    {!showSkeleton && (
                      <button className="text-xs flex items-center gap-0.5" style={{ color: primaryColor }}>
                        Barchasi <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {showSkeleton
                      ? Array.from({ length: skeletonCount }, (_, i) => (
                          <div key={i} className="bg-slate-900 rounded-2xl overflow-hidden opacity-50">
                            <div className="aspect-square bg-slate-800 flex items-center justify-center">
                              <Package className="w-10 h-10 text-slate-700" />
                            </div>
                            <div className="p-2.5 space-y-1.5">
                              <div className="h-2.5 bg-slate-800 rounded-full w-3/4" />
                              <div className="h-2.5 bg-slate-800 rounded-full w-1/2" />
                            </div>
                          </div>
                        ))
                      : blockProds.map(renderProductCard)
                    }
                  </div>
                </div>
              );
            }

            default:
              return null;
          }
        })}

        {/* If category is selected or search query, show filtered products */}
        {(selectedCategoryId || searchQuery) && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              {selectedCategoryId
                ? categories.find((c) => c.id === selectedCategoryId)?.name || "Mahsulotlar"
                : `"${searchQuery}" qidiruv natijalari`}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map(renderProductCard)}
            </div>
            {filteredProducts.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-400">Mahsulotlar topilmadi</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur border-b border-slate-800/50 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {brand.logo ? (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>
              {brand.logo}
            </div>
          ) : null}
          <span className="text-sm font-semibold text-white">{brand.name || data.tenant.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSearch(!showSearch)} className="p-2 rounded-xl text-slate-400 hover:text-white">
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => setView("cart")}
            className="relative p-2 rounded-xl text-white"
            style={{ backgroundColor: primaryColor + "20" }}
          >
            <ShoppingCart className="w-5 h-5" style={{ color: primaryColor }} />
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 bg-slate-950 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              autoFocus
              type="text"
              placeholder="Mahsulot qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 rounded-2xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-b border-slate-800/50">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedCategoryId === null ? "text-white" : "bg-slate-900 text-slate-400"
            }`}
            style={selectedCategoryId === null ? { backgroundColor: primaryColor } : {}}
          >
            Barchasi
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedCategoryId === cat.id ? "text-white" : "bg-slate-900 text-slate-400"
              }`}
              style={selectedCategoryId === cat.id ? { backgroundColor: primaryColor } : {}}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {renderHomeContent()}
      </div>

      {/* Cart preview banner (Home — agar savatda mahsulot bo'lsa, total ko'rsatamiz) */}
      {cartCount > 0 && view === "home" && (
        <div className="fixed bottom-16 left-4 right-4 z-30">
          <button
            onClick={() => setView("cart")}
            className="w-full py-3 rounded-2xl font-semibold text-white text-sm flex items-center justify-between px-5 shadow-xl transition-all active:scale-[0.98]"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold">{cartCount}</span>
            </div>
            <span>Savatga o'tish</span>
            <span className="font-bold">{formatPrice(cartTotal, data.tenant.currency)}</span>
          </button>
        </div>
      )}

      {/* Bottom navigation — Home, Katalog, Savat, Takliflar, Profile */}
      {currentTab && <BottomNav active={currentTab} cartCount={cartCount} primaryColor={primaryColor} onChange={(t) => setView(TAB_VIEWS[t])} />}

      {/* Product detail overlay */}
      {selectedProduct && renderProductDetail()}
    </div>
  );
}
