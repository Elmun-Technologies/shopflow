// Telegram Mini App (Web App) — mijozlarga ko'rsatiladigan ommaviy do'kon sahifasi.
// Auth talab qilinmaydi. /api/storefront/:slug orqali ma'lumot olinadi.

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import {
  ShoppingCart, Search, Package, ChevronRight, Minus, Plus,
  X, CheckCircle2, Loader2, ArrowLeft, Phone, MapPin, User,
  Tag, Heart,
} from "lucide-react";
import { BottomNav, type StoreTab } from "./storefront/BottomNav";
import { applyTelegramTheme, haptic } from "./storefront/storefront-theme";
import { ProductGridSkeleton } from "./storefront/Skeleton";
import { ToastProvider, useToast } from "./storefront/Toast";
import { PopupHost } from "./storefront/PopupHost";
import { ProductImageCarousel } from "./storefront/ProductImageCarousel";
import { formatUzPhone, isValidUzPhone } from "../utils/phone";

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

type SaleBadgeColor = "RED" | "ORANGE" | "EMERALD" | "PURPLE" | "BLUE";

type StoreSaleCampaign = {
  id: string;
  label: string;
  badgeColor: SaleBadgeColor;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

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
  saleCampaign?: StoreSaleCampaign | null;
};

const SALE_BADGE_STYLES: Record<SaleBadgeColor, string> = {
  RED: "bg-rose-500 text-white",
  ORANGE: "bg-orange-500 text-white",
  EMERALD: "bg-emerald-500 text-white",
  PURPLE: "bg-purple-500 text-white",
  BLUE: "bg-blue-500 text-white",
};

function isCampaignLive(c: StoreSaleCampaign | null | undefined): boolean {
  if (!c || !c.active) return false;
  const now = Date.now();
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return false;
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return false;
  return true;
}

function calcDiscountPct(price: number, oldPrice: number | null | undefined): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

const FAV_KEY = (slug: string) => `shopflow:store:${slug}:favorites`;
function loadFavorites(slug: string): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY(slug));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}
function saveFavorites(slug: string, favs: Set<string>) {
  try {
    localStorage.setItem(FAV_KEY(slug), JSON.stringify(Array.from(favs)));
  } catch {
    // ignore
  }
}

const CART_KEY = (slug: string) => `shopflow:store:${slug}:cart`;
interface StoredCart { items: CartItem[]; ts: number }
function loadStoredCart(slug: string): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCart;
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}
function loadCartMeta(slug: string): StoredCart | null {
  try {
    const raw = localStorage.getItem(CART_KEY(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCart;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}
function saveCart(slug: string, items: CartItem[]) {
  try {
    if (items.length === 0) localStorage.removeItem(CART_KEY(slug));
    else localStorage.setItem(CART_KEY(slug), JSON.stringify({ items, ts: Date.now() }));
  } catch {
    // ignore
  }
}

// Profile / Manzillar — Mini App profilida saqlangan, checkout'da auto-fill uchun
interface StoredProfile {
  firstName?: string;
  lastName?: string;
  patronymic?: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
}
interface StoredAddress {
  id: string;
  label: string;
  city: string;
  street: string;
  apartment?: string;
  notes?: string;
}
function loadStoredProfile(slug: string): StoredProfile | null {
  try {
    const raw = localStorage.getItem(`shopflow:store:${slug}:profile`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredProfile;
  } catch {
    return null;
  }
}
function loadStoredAddresses(slug: string): StoredAddress[] {
  try {
    const raw = localStorage.getItem(`shopflow:store:${slug}:addresses`);
    if (!raw) return [];
    return JSON.parse(raw) as StoredAddress[];
  } catch {
    return [];
  }
}
function formatAddress(a: StoredAddress): string {
  return [a.city, a.street, a.apartment].filter(Boolean).join(", ");
}

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
  const [cart, setCart] = useState<CartItem[]>(() => loadStoredCart(slug));
  const [cartRemindShown, setCartRemindShown] = useState(false);
  const [sortBy, setSortBy] = useState<"popular" | "price_asc" | "price_desc" | "newest">("popular");
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [form, setForm] = useState<CheckoutForm>({ name: "", phone: "", email: "", address: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<{ code: string; total: number; currency: string } | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites(slug));
  const [savedAddresses] = useState<StoredAddress[]>(() => loadStoredAddresses(slug));
  const toast = useToast();

  const toggleFavorite = useCallback((productId: string) => {
    haptic.light();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      saveFavorites(slug, next);
      return next;
    });
  }, [slug]);

  // Telegram WebApp — darhol ready() chaqirish (yuklanish ekranini yashirish uchun)
  const twa = window.Telegram?.WebApp;
  useEffect(() => {
    try {
      twa?.ready();
      twa?.expand();
    } catch {
      // Telegram WebApp mavjud bo'lmagan muhitda xatolikni e'tiborsiz qoldiramiz
    }

    // Pre-fill name from Profile (saqlangan ma'lumotlar) → fallback Telegram
    const savedProfile = loadStoredProfile(slug);
    const profileName = savedProfile ? [savedProfile.firstName, savedProfile.lastName].filter(Boolean).join(" ").trim() : "";
    const savedAddrs = loadStoredAddresses(slug);
    const defaultAddress = savedAddrs[0];
    const tgUser = twa?.initDataUnsafe?.user;
    const tgFullName = tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") : "";

    setForm((prev) => ({
      ...prev,
      name: prev.name || profileName || tgFullName,
      phone: prev.phone || savedProfile?.phone || "",
      address: prev.address || (defaultAddress ? formatAddress(defaultAddress) : ""),
    }));
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

  // Savatni localStorage'ga saqlash (mijoz Mini App'ni yopib qaytsa ham qoladi)
  useEffect(() => {
    saveCart(slug, cart);
  }, [cart, slug]);

  // Savatni server'ga sinxronlash — cart abandonment scheduler uchun.
  // Faqat Telegram user mavjud bo'lganda. Debounce 1.5s — har keypress uchun emas.
  useEffect(() => {
    const tgUser = twa?.initDataUnsafe?.user;
    if (!tgUser) return;
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/storefront/${encodeURIComponent(slug)}/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram: {
            userId: tgUser.id,
            firstName: tgUser.first_name,
            lastName: tgUser.last_name,
          },
          items: cart,
          total,
          currency: data?.tenant?.currency ?? "UZS",
        }),
      }).catch(() => {
        // failsoft — abandonment server-side faqat qulay bonus
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [cart, slug, twa, data?.tenant?.currency]);

  // Cart abandonment reminder — agar mijozning savati 1 soatdan ortiq bo'lsa,
  // do'kon ochilganida bir martalik reminder ko'rsatamiz.
  useEffect(() => {
    if (cartRemindShown || loading || !data) return;
    const meta = loadCartMeta(slug);
    if (!meta || meta.items.length === 0) return;
    const ageMs = Date.now() - meta.ts;
    if (ageMs < 60 * 60 * 1000) return; // 1 soatdan kam — eslatish shart emas
    const itemCount = meta.items.reduce((s, i) => s + i.qty, 0);
    setCartRemindShown(true);
    setTimeout(() => {
      toast.show(`🛒 Savatingizda ${itemCount} ta mahsulot kutmoqda!`, "info");
    }, 1200);
  }, [loading, data, slug, cartRemindShown, toast]);

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
    let prods = data.products.slice();
    if (selectedCategoryId) prods = prods.filter((p) => p.categoryId === selectedCategoryId);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      prods = prods.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case "price_asc":
        prods.sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price_desc":
        prods.sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "newest":
        // Backend already orders by featured desc then createdAt desc — keep that
        // but explicit fallback: featured first
        prods.sort((a, b) => Number(b.featured) - Number(a.featured));
        break;
      case "popular":
      default:
        // Popular = featured first, then default backend order
        prods.sort((a, b) => Number(b.featured) - Number(a.featured));
        break;
    }
    return prods;
  }, [data, selectedCategoryId, searchQuery, sortBy]);

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
                  onChange={(e) => setForm((f) => ({ ...f, phone: formatUzPhone(e.target.value) }))}
                  inputMode="tel"
                  autoComplete="tel"
                  className={`w-full bg-slate-800 border rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none ${
                    form.phone && !isValidUzPhone(form.phone)
                      ? "border-rose-500/40 focus:border-rose-500/60"
                      : "border-slate-700 focus:border-emerald-500/50"
                  }`}
                />
              </div>
              {form.phone && !isValidUzPhone(form.phone) && (
                <p className="text-[11px] text-rose-300 mt-1">To'liq raqam: +998 90 123 45 67</p>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Manzil</label>
              {savedAddresses.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                  {savedAddresses.map((a) => {
                    const full = formatAddress(a);
                    const isActive = form.address === full;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, address: full }))}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                          isActive
                            ? "text-white"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                        style={isActive ? { backgroundColor: primaryColor } : {}}
                      >
                        📍 {a.label}
                      </button>
                    );
                  })}
                </div>
              )}
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
            disabled={submitting || !form.name.trim() || !isValidUzPhone(form.phone)}
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
    const price = Number(selectedProduct.price);
    const oldPrice = selectedProduct.oldPrice != null ? Number(selectedProduct.oldPrice) : null;
    const discountPct = calcDiscountPct(price, oldPrice);
    const savings = oldPrice && oldPrice > price ? oldPrice - price : 0;
    const liveCampaign = isCampaignLive(selectedProduct.saleCampaign);
    const isFav = favorites.has(selectedProduct.id);

    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col animate-in fade-in duration-150">
        {/* Top bar */}
        <div
          className="px-4 pb-2 flex items-center justify-between bg-slate-950"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <button
            onClick={() => setSelectedProduct(null)}
            className="w-9 h-9 rounded-full bg-slate-800/60 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-transform"
            aria-label="Yopish"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => toggleFavorite(selectedProduct.id)}
            className="w-9 h-9 rounded-full bg-slate-800/60 backdrop-blur flex items-center justify-center active:scale-90 transition-transform"
            aria-label={isFav ? "Sevimlilardan o'chirish" : "Sevimlilarga qo'shish"}
          >
            <Heart className={`w-4.5 h-4.5 ${isFav ? "text-rose-400 fill-rose-400" : "text-white"}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Image carousel + badges */}
          <ProductImageCarousel
            imageUrl={selectedProduct.imageUrl}
            images={selectedProduct.images}
            alt={selectedProduct.name}
            badges={
              <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                {discountPct > 0 && (
                  <span className="bg-rose-500 text-white text-sm font-bold px-2 py-1 rounded-lg shadow-lg">
                    −{discountPct}%
                  </span>
                )}
                {liveCampaign && selectedProduct.saleCampaign && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg shadow-lg ${SALE_BADGE_STYLES[selectedProduct.saleCampaign.badgeColor]}`}>
                    {selectedProduct.saleCampaign.label}
                  </span>
                )}
              </div>
            }
          />

          <div className="p-5">
            {/* Price block — WB style */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-white">
                {price.toLocaleString("uz-UZ")}
                <span className="text-base font-normal text-slate-400 ml-1">
                  {data.tenant.currency === "UZS" ? "so'm" : data.tenant.currency}
                </span>
              </span>
              {oldPrice != null && oldPrice > price && (
                <span className="text-base text-slate-500 line-through">
                  {oldPrice.toLocaleString("uz-UZ")}
                </span>
              )}
            </div>
            {savings > 0 && (
              <div className="inline-block bg-emerald-500/15 text-emerald-300 text-xs font-medium px-2 py-1 rounded-md mb-3">
                Tejovingiz: {savings.toLocaleString("uz-UZ")} {data.tenant.currency === "UZS" ? "so'm" : data.tenant.currency}
              </div>
            )}

            {/* Title */}
            <h2 className="text-lg font-semibold text-white mb-3 leading-snug">{selectedProduct.name}</h2>

            {/* Quick stats */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {selectedProduct.category && (
                <span className="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-1 rounded-md">
                  {selectedProduct.category.name}
                </span>
              )}
              {selectedProduct.stock > 0 ? (
                <span className="text-[11px] text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-md">
                  ✓ Mavjud
                </span>
              ) : (
                <span className="text-[11px] text-rose-300 bg-rose-500/10 px-2 py-1 rounded-md">
                  Tugagan
                </span>
              )}
              {selectedProduct.featured && (
                <span className="text-[11px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md">⭐ Bestseller</span>
              )}
            </div>

            {selectedProduct.description && (
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedProduct.description}</p>
            )}
          </div>
        </div>

        {/* Sticky bottom CTA */}
        <div
          className="border-t border-slate-800 bg-slate-950 p-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {selectedProduct.stock <= 0 ? (
            <button
              disabled
              className="w-full py-4 rounded-2xl font-semibold text-slate-400 text-base bg-slate-800 cursor-not-allowed"
            >
              Hozircha tugagan
            </button>
          ) : qty === 0 ? (
            <button
              onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
              className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor }}
            >
              <Plus className="w-5 h-5" />
              Savatga qo'shish · {price.toLocaleString("uz-UZ")} {data.tenant.currency === "UZS" ? "so'm" : data.tenant.currency}
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-slate-800 rounded-2xl">
                <button
                  onClick={() => updateQty(selectedProduct.id, -1)}
                  className="w-12 h-12 flex items-center justify-center text-white active:scale-90 transition-transform"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-base font-bold text-white px-3 min-w-[36px] text-center">{qty}</span>
                <button
                  onClick={() => updateQty(selectedProduct.id, 1)}
                  className="w-12 h-12 flex items-center justify-center text-white active:scale-90 transition-transform"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => { setSelectedProduct(null); setView("cart"); }}
                className="flex-1 py-3 rounded-2xl font-semibold text-white text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                style={{ backgroundColor: primaryColor }}
              >
                <ShoppingCart className="w-4 h-4" />
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
    const price = Number(product.price);
    const oldPrice = product.oldPrice != null ? Number(product.oldPrice) : null;
    const discountPct = calcDiscountPct(price, oldPrice);
    const liveCampaign = isCampaignLive(product.saleCampaign);
    const isFav = favorites.has(product.id);
    const outOfStock = product.stock <= 0;
    const lowStock = !outOfStock && product.stock > 0 && product.stock <= 5;

    return (
      <div
        key={product.id}
        className={`bg-slate-900 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform relative group ${
          outOfStock ? "opacity-70" : ""
        }`}
        onClick={() => setSelectedProduct(product)}
      >
        {/* Top-left badges (discount + campaign) */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {discountPct > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              −{discountPct}%
            </span>
          )}
          {liveCampaign && product.saleCampaign && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${SALE_BADGE_STYLES[product.saleCampaign.badgeColor]}`}>
              {product.saleCampaign.label}
            </span>
          )}
        </div>

        {/* Top-right heart (favorite) */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }}
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
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
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
          {/* Price line — WB-style: big bold + small struck */}
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-sm font-bold text-white">
              {price.toLocaleString("uz-UZ")}
              <span className="text-[10px] font-normal text-slate-400 ml-0.5">{data.tenant.currency === "UZS" ? "so'm" : data.tenant.currency}</span>
            </span>
            {oldPrice != null && oldPrice > price && (
              <span className="text-[10px] text-slate-500 line-through">
                {oldPrice.toLocaleString("uz-UZ")}
              </span>
            )}
          </div>

          {/* Name */}
          <p className="text-[11px] text-slate-300 line-clamp-2 leading-tight mb-2 min-h-[28px]">{product.name}</p>

          {/* Low stock indicator */}
          {lowStock && (
            <p className="text-[10px] text-amber-300 mb-1 leading-tight">
              ⚡ Faqat {product.stock} ta qoldi
            </p>
          )}

          {/* Add to cart */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!outOfStock) addToCart(product);
            }}
            disabled={outOfStock}
            className="w-full py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            style={{
              backgroundColor: outOfStock ? "#475569" : qty > 0 ? "#10b981" : primaryColor,
            }}
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
        <div className="sticky top-0 bg-slate-950 border-b border-slate-800 z-30 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <h2 className="text-base font-semibold text-white mb-2 px-1">Katalog</h2>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mahsulot qidirish..."
              className="w-full bg-slate-800 rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
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
        {/* Sort + result count bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/50">
          <span className="text-[11px] text-slate-500">{filteredProducts.length} ta mahsulot</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="appearance-none bg-slate-800 border border-slate-700 text-xs text-white pl-3 pr-8 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="popular">Mashhur</option>
              <option value="price_asc">Narx: arzondan</option>
              <option value="price_desc">Narx: qimmatdan</option>
              <option value="newest">Yangi</option>
            </select>
            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 rotate-90 pointer-events-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pb-24 p-3">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-12 h-12 mx-auto text-slate-700 mb-3" />
              <p className="text-sm text-slate-400">
                {searchQuery ? `"${searchQuery}" bo'yicha topilmadi` : "Bu bo'limda mahsulot yo'q"}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-3 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                >
                  Qidiruvni tozalash
                </button>
              )}
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

      {/* Marketing popups — admin paneldan boshqariladi */}
      <PopupHost
        storeSlug={slug}
        apiBase={API_BASE}
        primaryColor={primaryColor}
        onCtaClick={(url) => {
          if (url.startsWith("/")) {
            // Ichki yo'l: hozircha shu storefrontda — keyingi etapda routing
            if (url.includes("catalog")) setView("catalog");
            else if (url.includes("promotions")) setView("promotions");
            else if (url.includes("profile")) setView("profile");
          } else {
            window.open(url, "_blank");
          }
        }}
      />

      {/* Product detail overlay */}
      {selectedProduct && renderProductDetail()}
    </div>
  );
}
