// Telegram Mini App (Web App) — mijozlarga ko'rsatiladigan ommaviy do'kon sahifasi.
// Auth talab qilinmaydi. /api/storefront/:slug orqali ma'lumot olinadi.

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import {
  ShoppingCart, Search, Package, ChevronRight,
  X, CheckCircle2, Loader2, ArrowLeft,
  Tag, Heart, Share2, ShieldCheck, BadgeCheck, Star, Send,
  ShoppingBag, Truck, Plus, Minus,
} from "lucide-react";
import { BottomNav, type StoreTab } from "./storefront/BottomNav";
import { applyTelegramTheme, haptic } from "./storefront/storefront-theme";
import { useT } from "../i18n";
import { ProductGridSkeleton } from "./storefront/Skeleton";
import { ToastProvider, useToast } from "./storefront/Toast";
import { PopupHost } from "./storefront/PopupHost";
import { ProductImageCarousel } from "./storefront/ProductImageCarousel";
import { ProductCard } from "./storefront/ProductCard";
import { CartView } from "./storefront/CartView";
import { CheckoutView } from "./storefront/CheckoutView";
import { SuccessView } from "./storefront/SuccessView";
import { useDebounce } from "../hooks/useDebounce";

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
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
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

type StoreAddon = {
  id: string;
  position: number;
  discountPct: number;
  defaultSelected: boolean;
  addonProduct: {
    id: string;
    name: string;
    sku: string;
    price: string | number;
    imageUrl: string | null;
    stock: number;
    active: boolean;
  };
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
  comboAddons?: StoreAddon[];
  weeklyBuyers?: number;
  avgRating?: number;
  reviewCount?: number;
};

interface StoreReview {
  id: string;
  customerName: string;
  rating: number;
  text: string;
  photos: string[];
  createdAt: string;
}

// Uzbek oylar — yetkazib berish sanasi va shu kabi formatlash uchun
const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
function formatUzDate(d: Date): string {
  return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]}`;
}
// Standart yetkazib berish — 2 kundan keyin
function estimatedDeliveryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d;
}

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
  oldPrice: number | null;
  imageUrl: string | null;
};

type CheckoutForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  lat?: number | null;
  lng?: number | null;
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
  // Debounced qidiruv — 250ms kechikish bilan filterlash (har keystroke emas)
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [showSearch, setShowSearch] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => loadStoredCart(slug));
  const [cartRemindShown, setCartRemindShown] = useState(false);
  const [sortBy, setSortBy] = useState<"popular" | "price_asc" | "price_desc" | "newest">("popular");
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [form, setForm] = useState<CheckoutForm>({ name: "", phone: "", email: "", address: "", notes: "", lat: null, lng: null });
  const [gpsBusy, setGpsBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<{ code: string; total: number; currency: string } | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites(slug));
  const [savedAddresses] = useState<StoredAddress[]>(() => loadStoredAddresses(slug));
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  // Profile sahifasi tashqi nuqtadan ochilganda boshlang'ich subview
  // (masalan, success screen'dan "Buyurtmalarim" tugmasi)
  const [profileInitialView, setProfileInitialView] = useState<"menu" | "orders" | undefined>(undefined);
  // PDP — reviews va form
  const [productReviews, setProductReviews] = useState<StoreReview[]>([]);
  const [reviewForm, setReviewForm] = useState<{ open: boolean; rating: number; text: string; busy: boolean }>({
    open: false,
    rating: 5,
    text: "",
    busy: false,
  });
  // Mahsulot detali — sticky header (scroll'da), trust badge modal, description toggle
  const [pdpScrolled, setPdpScrolled] = useState(false);
  const [trustSheet, setTrustSheet] = useState<"original" | "warranty" | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const toast = useToast();

  const toggleFavorite = useCallback((productId: string) => {
    haptic.light();
    let added = false;
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
        added = false;
      } else {
        next.add(productId);
        added = true;
      }
      saveFavorites(slug, next);
      return next;
    });
    // Server sync — Telegram user mavjud bo'lsa
    const tgUid = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgUid) {
      if (added) {
        fetch(`/api/storefront/${slug}/wishlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tgUserId: tgUid, productId }),
        }).catch(() => null);
      } else {
        fetch(`/api/storefront/${slug}/wishlist/${productId}?tgUserId=${tgUid}`, {
          method: "DELETE",
        }).catch(() => null);
      }
    }
  }, [slug]);

  // Telegram WebApp — darhol ready() chaqirish (yuklanish ekranini yashirish uchun)
  const twa = window.Telegram?.WebApp;
  const { t } = useT();
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

    // Avto-ro'yxat — Telegram'dan tanilgan mijozni serverga yozib qo'yamiz
    // (telegramUserId bo'yicha upsert). Bu checkout'gacha kutmasdan
    // Customer record yaratadi va profile sync ishlashi uchun zarur.
    // ?ref=<tgId> URL parametri bo'lsa, referral grafini bog'laymiz.
    if (tgUser) {
      const urlParams = new URLSearchParams(window.location.search);
      const refFromUrl = urlParams.get("ref");
      // Telegram Mini App start_param ham referral sifatida ishlatiladi
      type TwaWithStart = { initDataUnsafe?: { start_param?: string } };
      const refFromTg = (twa as unknown as TwaWithStart | undefined)?.initDataUnsafe?.start_param;
      const ref = refFromUrl || refFromTg;
      const params = new URLSearchParams({
        tgUserId: String(tgUser.id),
        ...(tgUser.first_name && { firstName: tgUser.first_name }),
        ...(tgUser.last_name && { lastName: tgUser.last_name }),
        ...(tgUser.username && { username: tgUser.username }),
        ...(ref && /^\d+$/.test(ref) ? { ref } : {}),
      });
      fetch(`/api/storefront/${slug}/profile?${params}`).catch(() => {
        // Tarmoq xatosi — Mini App ishlashda davom etadi, checkout vaqtida qayta urinadi
      });
      // Wishlist'ni server'dan yuklab, lokal favoritlar bilan birlashtiramiz.
      // Server "haqiqat" manbai — qurilmadan-qurilmaga sevimlilar saqlanadi.
      fetch(`/api/storefront/${slug}/wishlist?tgUserId=${tgUser.id}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
        .then((data: { items: Array<{ productId: string }> }) => {
          const serverFavs = new Set(data.items.map((i) => i.productId));
          setFavorites(serverFavs);
          saveFavorites(slug, serverFavs);
        })
        .catch(() => { /* offline — localStorage'da turgan favoritlar saqlanadi */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primaryColor = data?.brand?.primaryColor || "#10b981";

  // Telegram theme'ni va brand color'ni CSS variable'lariga joylab qo'yamiz
  useEffect(() => {
    applyTelegramTheme(data?.brand?.primaryColor);
  }, [data?.brand?.primaryColor]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/storefront/${encodeURIComponent(slug)}`, { signal });
        if (signal.aborted) return;
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Server xatosi" }));
          throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
        }
        const json = (await res.json()) as StorefrontData;
        if (!signal.aborted) setData(json);
      } catch (e) {
        if (signal.aborted) return;
        setError(e instanceof Error ? e.message : "Noma'lum xato");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [slug]);

  // Savatni localStorage'ga saqlash (mijoz Mini App'ni yopib qaytsa ham qoladi)
  useEffect(() => {
    saveCart(slug, cart);
  }, [cart, slug]);

  // Quick view ochilganida default-selected combo addons'larni belgilab qo'yamiz
  // + PDP state (scroll, sheet, description) reset
  useEffect(() => {
    setPdpScrolled(false);
    setTrustSheet(null);
    setDescExpanded(false);
    setProductReviews([]);
    setReviewForm({ open: false, rating: 5, text: "", busy: false });
    if (!selectedProduct) {
      setSelectedAddons(new Set());
      return;
    }
    const defaults = new Set<string>();
    for (const a of selectedProduct.comboAddons ?? []) {
      if (a.defaultSelected && a.addonProduct.active && a.addonProduct.stock > 0) {
        defaults.add(a.addonProduct.id);
      }
    }
    setSelectedAddons(defaults);
    // Reviews yuklash
    if ((selectedProduct.reviewCount ?? 0) > 0) {
      fetch(`${API_BASE}/storefront/${encodeURIComponent(slug)}/products/${selectedProduct.id}/reviews`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
        .then((data: { items: StoreReview[] }) => setProductReviews(data.items))
        .catch(() => null);
    }
  }, [selectedProduct, slug]);

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
        oldPrice: product.oldPrice != null ? Number(product.oldPrice) : null,
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
      setSubmitError(e instanceof Error ? e.message : t("common.error"));
      twa?.HapticFeedback?.notificationOccurred("error");
    } finally {
      setSubmitting(false);
    }
  }, [data, form, cart, slug, twa]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    let prods = data.products.slice();
    if (selectedCategoryId) prods = prods.filter((p) => p.categoryId === selectedCategoryId);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
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
  }, [data, selectedCategoryId, debouncedSearch, sortBy]);

  // ---- LOADING ----
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d14" }}>
        {/* Header skeleton */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <div className="animate-pulse rounded-xl flex-shrink-0" style={{ width: 34, height: 34, backgroundColor: "#1e1e2a" }} />
          <div className="flex-1 space-y-2">
            <div className="animate-pulse rounded-full w-1/2" style={{ height: 12, backgroundColor: "#1e1e2a" }} />
            <div className="animate-pulse rounded-full w-1/3" style={{ height: 10, backgroundColor: "#1e1e2a" }} />
          </div>
          <div className="animate-pulse rounded-xl" style={{ width: 34, height: 34, backgroundColor: "#1e1e2a" }} />
        </div>
        {/* Category chips skeleton */}
        <div className="px-4 pb-3 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-full flex-shrink-0" style={{ width: 64 + (i % 3) * 22, height: 30, backgroundColor: "#1e1e2a" }} />
          ))}
        </div>
        <div className="p-4">
          <ProductGridSkeleton count={6} />
        </div>
      </div>
    );
  }

  // ---- ERROR ----
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#0d0d14" }}>
        <div className="text-center">
          <div
            className="flex items-center justify-center mx-auto mb-4"
            style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(239,68,68,0.1)" }}
          >
            <X className="w-7 h-7" style={{ color: "#ef4444" }} />
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: "#f4f4f8" }}>Do'kon topilmadi</p>
          <p className="text-sm" style={{ color: "#52526a" }}>{error || "Noma'lum xato"}</p>
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
      <SuccessView
        orderResult={orderResult}
        primaryColor={primaryColor}
        hasTelegram={!!telegramUser?.userId}
        onViewOrders={() => {
          setProfileInitialView("orders");
          setView("profile");
          setOrderResult(null);
        }}
        onContinueShopping={() => {
          setProfileInitialView(undefined);
          setView("home");
          setOrderResult(null);
        }}
      />
    );
  }

  // ---- CHECKOUT ----
  if (view === "checkout") {
    return (
      <CheckoutView
        cart={cart}
        cartTotal={cartTotal}
        currency={data.tenant.currency}
        primaryColor={primaryColor}
        form={form}
        savedAddresses={savedAddresses}
        gpsBusy={gpsBusy}
        submitting={submitting}
        submitError={submitError}
        onBack={() => setView("cart")}
        onFormChange={setForm}
        onGpsBusy={setGpsBusy}
        onSubmit={handleCheckout}
      />
    );
  }

  // ---- CART ----
  if (view === "cart") {
    return (
      <CartView
        cart={cart}
        cartTotal={cartTotal}
        cartCount={cartCount}
        currency={data.tenant.currency}
        primaryColor={primaryColor}
        onBack={() => setView("home")}
        onCheckout={() => setView("checkout")}
        onUpdateQty={updateQty}
      />
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
    const weeklyBuyers = selectedProduct.weeklyBuyers ?? 0;
    const desc = selectedProduct.description ?? "";
    const descIsLong = desc.length > 220 || (desc.match(/\n/g) ?? []).length > 3;
    const deliveryStr = formatUzDate(estimatedDeliveryDate());
    const currencyStr = data.tenant.currency === "UZS" ? "so'm" : data.tenant.currency;

    // Share — Telegram Web App API yoki clipboard fallback
    const handleShare = async () => {
      haptic.light();
      const url = `https://${window.location.host}/store/${data.tenant.slug}?product=${selectedProduct.id}`;
      const text = `${selectedProduct.name} — ${price.toLocaleString("uz-UZ")} ${currencyStr}`;
      // Telegram Mini App
      if (twa?.openTelegramLink) {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
        twa.openTelegramLink(shareUrl);
        return;
      }
      // Brauzer share API
      try {
        if (navigator.share) {
          await navigator.share({ title: selectedProduct.name, text, url });
          return;
        }
      } catch {
        // Foydalanuvchi bekor qildi
      }
      // Fallback — clipboard
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // ignore
      }
    };

    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col animate-in fade-in duration-150">
        {/* Compact sticky header — scroll'da paydo bo'ladi (Uzum uslubi) */}
        <div
          className={`absolute top-0 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 transition-opacity duration-200 ${
            pdpScrolled ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <div className="px-3 pb-2 flex items-center gap-2">
            <button
              onClick={() => setSelectedProduct(null)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              aria-label="Yopish"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="flex-1 text-sm font-semibold text-white truncate">{selectedProduct.name}</h2>
            <button
              onClick={() => toggleFavorite(selectedProduct.id)}
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              aria-label={isFav ? "Sevimlilardan o'chirish" : "Sevimlilarga qo'shish"}
            >
              <Heart className={`w-5 h-5 ${isFav ? "text-rose-400 fill-rose-400" : "text-white"}`} />
            </button>
            <button
              onClick={handleShare}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
              aria-label="Ulashish"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Overlay top bar (rasm ustida — pdpScrolled bo'lmaganda ko'rinadi) */}
        <div
          className={`absolute top-0 left-0 right-0 z-20 px-4 pb-2 flex items-center justify-between transition-opacity duration-200 ${
            pdpScrolled ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <button
            onClick={() => setSelectedProduct(null)}
            className="w-9 h-9 rounded-full bg-slate-800/60 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-transform"
            aria-label="Yopish"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleFavorite(selectedProduct.id)}
              className="w-9 h-9 rounded-full bg-slate-800/60 backdrop-blur flex items-center justify-center active:scale-90 transition-transform"
              aria-label={isFav ? "Sevimlilardan o'chirish" : "Sevimlilarga qo'shish"}
            >
              <Heart className={`w-4.5 h-4.5 ${isFav ? "text-rose-400 fill-rose-400" : "text-white"}`} />
            </button>
            <button
              onClick={handleShare}
              className="w-9 h-9 rounded-full bg-slate-800/60 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-transform"
              aria-label="Ulashish"
            >
              <Share2 className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto"
          onScroll={(e) => {
            const top = (e.target as HTMLDivElement).scrollTop;
            const next = top > 180;
            if (next !== pdpScrolled) setPdpScrolled(next);
          }}
        >
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
                {t("pdp.savings", { value: `${savings.toLocaleString("uz-UZ")} ${currencyStr}` })}
              </div>
            )}

            {/* Trust badges — Uzum uslubidagi tappable rivojlangan kafolat belgilari */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => { haptic.light(); setTrustSheet("original"); }}
                className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl active:scale-[0.98] transition-transform"
              >
                <BadgeCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white">{t("pdp.original")}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
              </button>
              <button
                type="button"
                onClick={() => { haptic.light(); setTrustSheet("warranty"); }}
                className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl active:scale-[0.98] transition-transform"
              >
                <ShieldCheck className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span className="text-xs font-medium text-white">{t("pdp.warranty")}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 ml-auto" />
              </button>
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold text-white mb-3 leading-snug">{selectedProduct.name}</h2>

            {/* Rating chip — sharhlar bo'lsa Uzum/WB uslubida */}
            {(selectedProduct.reviewCount ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 mb-3">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-semibold text-white">{(selectedProduct.avgRating ?? 0).toFixed(1)}</span>
                <span className="text-xs text-slate-500">·</span>
                <span className="text-xs text-slate-400">{t("pdp.totalReviews", { count: selectedProduct.reviewCount ?? 0 })}</span>
              </div>
            )}

            {/* Quick stats */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {selectedProduct.category && (
                <span className="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-1 rounded-md">
                  {selectedProduct.category.name}
                </span>
              )}
              {selectedProduct.stock > 0 ? (
                <span className="text-[11px] text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-md">
                  {t("pdp.available")}
                </span>
              ) : (
                <span className="text-[11px] text-rose-300 bg-rose-500/10 px-2 py-1 rounded-md">
                  {t("pdp.outOfStock")}
                </span>
              )}
              {selectedProduct.featured && (
                <span className="text-[11px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-md">{t("pdp.bestseller")}</span>
              )}
            </div>

            {/* Social proof — haftalik xaridorlar soni */}
            {weeklyBuyers > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mb-4">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t("pdp.weeklyBuyers", { count: weeklyBuyers })}</span>
              </div>
            )}

            {/* Description — Uzum uslubidagi expand/collapse */}
            {desc && (
              <div className="relative">
                <p
                  className={`text-sm text-slate-300 leading-relaxed whitespace-pre-wrap ${
                    !descExpanded && descIsLong ? "line-clamp-4" : ""
                  }`}
                >
                  {desc}
                </p>
                {descIsLong && (
                  <button
                    type="button"
                    onClick={() => { haptic.light(); setDescExpanded((v) => !v); }}
                    className="mt-2 text-sm font-medium text-sky-400 active:opacity-70"
                  >
                    {descExpanded ? t("pdp.readLess") : t("pdp.readMore")}
                  </button>
                )}
              </div>
            )}

            {/* Yetkazib berish ma'lumotlari */}
            <div className="mt-5 pt-5 border-t border-slate-800 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{t("pdp.delivery", { date: deliveryStr })}</div>
                <div className="text-xs text-slate-400 mt-0.5">{t("pdp.deliveryNote")}</div>
              </div>
            </div>

            {/* Sharhlar — Uzum/WB uslubida ✓ purchase qilgan mijoz yozadi */}
            <div className="mt-5 pt-5 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {t("pdp.reviews")}
                  {(selectedProduct.reviewCount ?? 0) > 0 && (
                    <span className="text-slate-500">({selectedProduct.reviewCount})</span>
                  )}
                </h3>
                {telegramUser?.userId && (
                  <button
                    type="button"
                    onClick={() => { haptic.light(); setReviewForm((f) => ({ ...f, open: true })); }}
                    className="text-xs font-medium text-sky-400 hover:text-sky-300"
                  >
                    {t("pdp.writeReview")}
                  </button>
                )}
              </div>
              {productReviews.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  {t("pdp.noReviews")} {telegramUser?.userId ? t("pdp.beFirst") : ""}
                </p>
              ) : (
                <div className="space-y-3">
                  {productReviews.slice(0, 5).map((rv) => (
                    <div key={rv.id} className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < rv.rating ? "fill-amber-400 text-amber-400" : "text-slate-700"}`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-slate-400 font-medium">{rv.customerName}</span>
                        <span className="text-[10px] text-slate-600 ml-auto">
                          {new Date(rv.createdAt).toLocaleDateString("uz-UZ", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{rv.text}</p>
                    </div>
                  ))}
                  {productReviews.length > 5 && (
                    <p className="text-xs text-slate-500 text-center">Va yana {productReviews.length - 5} ta</p>
                  )}
                </div>
              )}
            </div>

            {/* Combo / qo'shimcha mahsulotlar */}
            {selectedProduct.comboAddons && selectedProduct.comboAddons.length > 0 && (
              <div className="mt-5 pt-5 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    {t("pdp.comboTitle")}
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    {selectedAddons.size} / {selectedProduct.comboAddons.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {selectedProduct.comboAddons.map((addon) => {
                    const ap = addon.addonProduct;
                    if (!ap.active) return null;
                    const isSelected = selectedAddons.has(ap.id);
                    const origPrice = Number(ap.price);
                    const finalPrice = addon.discountPct > 0
                      ? Math.round(origPrice * (1 - addon.discountPct / 100))
                      : origPrice;
                    const isOut = ap.stock <= 0;
                    return (
                      <button
                        key={addon.id}
                        onClick={() => {
                          if (isOut) return;
                          haptic.light();
                          setSelectedAddons((prev) => {
                            const next = new Set(prev);
                            if (next.has(ap.id)) next.delete(ap.id);
                            else next.add(ap.id);
                            return next;
                          });
                        }}
                        disabled={isOut}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-left ${
                          isSelected
                            ? "bg-emerald-500/10 border-emerald-500/40"
                            : "bg-slate-900 border-slate-800 hover:border-slate-700"
                        } ${isOut ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? "bg-emerald-500 border-emerald-500" : "border-slate-600"
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        {/* Image */}
                        {ap.imageUrl ? (
                          <img src={ap.imageUrl} alt={ap.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-slate-600" />
                          </div>
                        )}
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white font-medium line-clamp-2">{ap.name}</div>
                          {isOut ? (
                            <div className="text-[10px] text-rose-400 mt-0.5">Tugagan</div>
                          ) : (
                            <div className="flex items-baseline gap-1.5 mt-1">
                              <span className="text-sm font-bold text-white">
                                {finalPrice.toLocaleString("uz-UZ")}
                                <span className="text-[10px] font-normal text-slate-400 ml-0.5">
                                  {data.tenant.currency === "UZS" ? "so'm" : data.tenant.currency}
                                </span>
                              </span>
                              {addon.discountPct > 0 && (
                                <>
                                  <span className="text-[10px] text-slate-500 line-through">{origPrice.toLocaleString("uz-UZ")}</span>
                                  <span className="text-[10px] font-bold text-rose-300">−{addon.discountPct}%</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky bottom CTA */}
        <div
          className="border-t border-slate-800 bg-slate-950 p-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {(() => {
            // Combo total = main + selected addons (discount qo'llanadi)
            let comboTotal = price;
            const selectedComboItems: Array<{ product: StoreProduct; finalPrice: number }> = [];
            for (const addon of selectedProduct.comboAddons ?? []) {
              if (!selectedAddons.has(addon.addonProduct.id)) continue;
              const ap = addon.addonProduct;
              const orig = Number(ap.price);
              const fp = addon.discountPct > 0
                ? Math.round(orig * (1 - addon.discountPct / 100))
                : orig;
              comboTotal += fp;
              // Pseudo-StoreProduct for addToCart
              selectedComboItems.push({
                product: {
                  id: ap.id,
                  sku: ap.sku,
                  name: ap.name,
                  description: null,
                  price: fp,
                  oldPrice: null,
                  currency: data.tenant.currency,
                  stock: ap.stock,
                  imageUrl: ap.imageUrl,
                  images: [],
                  featured: false,
                  categoryId: null,
                  category: null,
                } as StoreProduct,
                finalPrice: fp,
              });
            }
            const hasCombo = selectedComboItems.length > 0;

            if (selectedProduct.stock <= 0) {
              return (
                <button disabled className="w-full py-4 rounded-2xl font-semibold text-slate-400 text-base bg-slate-800 cursor-not-allowed">
                  Hozircha tugagan
                </button>
              );
            }

            if (hasCombo) {
              return (
                <button
                  onClick={() => {
                    addToCart(selectedProduct);
                    for (const item of selectedComboItems) addToCart(item.product);
                    setSelectedProduct(null);
                  }}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-0.5"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Combo savatga · {comboTotal.toLocaleString("uz-UZ")} {currencyStr}
                  </span>
                  <span className="text-xs opacity-90">{1 + selectedComboItems.length} ta mahsulot · yetkazib berish {deliveryStr}</span>
                </button>
              );
            }

            if (qty === 0) {
              return (
                <button
                  onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-0.5"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Savatga
                  </span>
                  <span className="text-xs opacity-90">{deliveryStr} · yetkazib berish</span>
                </button>
              );
            }

            return null;
          })()}

          {qty > 0 && selectedAddons.size === 0 && selectedProduct.stock > 0 && (
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

        {/* Trust badge bottom sheet — Uzum uslubidagi tushuntirish modal */}
        {trustSheet && (
          <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 animate-in fade-in duration-150"
            onClick={() => setTrustSheet(null)}
          >
            <div
              className="w-full sm:max-w-sm bg-slate-900 sm:rounded-2xl rounded-t-3xl border-t sm:border border-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              <div className="flex justify-end p-3">
                <button
                  onClick={() => setTrustSheet(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 active:scale-90"
                  aria-label={t("common.close")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 pb-6 flex flex-col items-center gap-3 text-center">
                {trustSheet === "original" ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <BadgeCheck className="w-9 h-9 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">{t("pdp.trust.original.title")}</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {t("pdp.trust.original.text")}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full bg-sky-500/15 flex items-center justify-center">
                      <ShieldCheck className="w-9 h-9 text-sky-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">{t("pdp.trust.warranty.title")}</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {t("pdp.trust.warranty.text")}
                    </p>
                  </>
                )}
                <button
                  onClick={() => setTrustSheet(null)}
                  className="mt-2 w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium text-white active:scale-[0.98] transition-transform"
                >
                  {t("common.ok")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sharh yozish modal */}
        {reviewForm.open && (
          <div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 animate-in fade-in duration-150"
            onClick={() => setReviewForm((f) => ({ ...f, open: false }))}
          >
            <div
              className="w-full sm:max-w-sm bg-slate-900 sm:rounded-2xl rounded-t-3xl border-t sm:border border-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-800">
                <h3 className="text-base font-semibold text-white">{t("pdp.review.title")}</h3>
                <button
                  onClick={() => setReviewForm((f) => ({ ...f, open: false }))}
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-4">
                {/* Star picker */}
                <div>
                  <p className="text-xs text-slate-400 mb-2">{t("pdp.review.rating")}</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { haptic.light(); setReviewForm((f) => ({ ...f, rating: n })); }}
                        className="active:scale-90 transition-transform"
                      >
                        <Star
                          className={`w-9 h-9 ${n <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "text-slate-700"}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-2">{t("pdp.review.textLabel")}</p>
                  <textarea
                    value={reviewForm.text}
                    onChange={(e) => setReviewForm((f) => ({ ...f, text: e.target.value }))}
                    rows={4}
                    placeholder={t("pdp.review.placeholder")}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    {t("pdp.review.moderation")}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!telegramUser?.userId || !selectedProduct || reviewForm.text.trim().length < 5) return;
                    setReviewForm((f) => ({ ...f, busy: true }));
                    try {
                      const res = await fetch(`${API_BASE}/storefront/${encodeURIComponent(slug)}/reviews`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          tgUserId: telegramUser.userId,
                          productId: selectedProduct.id,
                          rating: reviewForm.rating,
                          text: reviewForm.text.trim(),
                        }),
                      });
                      const body = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error((body as { error?: string }).error || t("pdp.review.error"));
                      haptic.success();
                      setReviewForm({ open: false, rating: 5, text: "", busy: false });
                      alert(t("pdp.review.success"));
                    } catch (err) {
                      alert(err instanceof Error ? err.message : t("pdp.review.error"));
                      setReviewForm((f) => ({ ...f, busy: false }));
                    }
                  }}
                  disabled={reviewForm.busy || reviewForm.text.trim().length < 5}
                  className="w-full py-3 rounded-2xl font-semibold text-white text-base bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {reviewForm.busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t("pdp.review.submit")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---- HOME ----
  // Memoized ProductCard wrapper — har mahsulot uchun alohida memo
  const renderProductCard = useCallback((product: StoreProduct) => {
    const price = Number(product.price);
    const oldPrice = product.oldPrice != null ? Number(product.oldPrice) : null;
    const discountPct = calcDiscountPct(price, oldPrice);
    const liveCampaign = isCampaignLive(product.saleCampaign);

    return (
      <ProductCard
        key={product.id}
        productId={product.id}
        name={product.name}
        price={price}
        oldPrice={oldPrice}
        imageUrl={product.imageUrl}
        stock={product.stock}
        featured={product.featured}
        currency={data.tenant.currency}
        primaryColor={primaryColor}
        isFav={favorites.has(product.id)}
        qty={cartQty(product.id)}
        discountPct={discountPct}
        liveCampaign={liveCampaign}
        campaignLabel={product.saleCampaign?.label}
        campaignBadgeColor={product.saleCampaign?.badgeColor as Parameters<typeof ProductCard>[0]["campaignBadgeColor"]}
        avgRating={product.avgRating}
        weeklyBuyers={product.weeklyBuyers}
        onSelect={() => setSelectedProduct(product)}
        onToggleFav={() => toggleFavorite(product.id)}
        onAddToCart={() => addToCart(product)}
        onIncrease={() => updateQty(product.id, 1)}
        onDecrease={() => updateQty(product.id, -1)}
      />
    );
  }, [data, primaryColor, favorites, cartQty, toggleFavorite, addToCart, updateQty, setSelectedProduct]);

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
              initialView={profileInitialView}
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
            {t("promo.tabTitle")}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto pb-24 p-3">
          {promotionProducts.length === 0 ? (
            <div className="py-16 text-center">
              <Tag className="w-12 h-12 mx-auto text-slate-700 mb-3" />
              <p className="text-sm text-slate-400">{t("promo.empty")}</p>
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
              placeholder={t("catalog.searchPlaceholder")}
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
              {t("catalog.allCategories")}
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
          <span className="text-[11px] text-slate-500">{t("catalog.productCount", { n: filteredProducts.length })}</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="appearance-none bg-slate-800 border border-slate-700 text-xs text-white pl-3 pr-8 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="popular">{t("catalog.sort.popular")}</option>
              <option value="price_asc">{t("catalog.sort.priceAsc")}</option>
              <option value="price_desc">{t("catalog.sort.priceDesc")}</option>
              <option value="newest">{t("catalog.sort.newest")}</option>
            </select>
            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 rotate-90 pointer-events-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pb-24 p-3">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-12 h-12 mx-auto text-slate-700 mb-3" />
              <p className="text-sm text-slate-400">
                {searchQuery ? t("catalog.empty.search", { q: searchQuery }) : t("catalog.empty.category")}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-3 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                >
                  {t("catalog.clearSearch")}
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
            <h2 className="text-sm font-semibold text-white mb-3">{t("catalog.allProducts")}</h2>
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
        {(selectedCategoryId || debouncedSearch) && (
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              {selectedCategoryId
                ? categories.find((c) => c.id === selectedCategoryId)?.name || "Mahsulotlar"
                : `"${debouncedSearch}" qidiruv natijalari`}
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0d0d14" }}>

      {/* ─── Header ─── */}
      <div
        className="sticky top-0 z-20 flex flex-col gap-0"
        style={{
          backgroundColor: "rgba(13,13,20,0.96)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Top bar: logo + actions */}
        <div
          className="flex items-center justify-between px-4 pb-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {brand.logo && (
              <div
                className="flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: primaryColor }}
              >
                {brand.logo}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "#f4f4f8" }}>
                {brand.name || data.tenant.name}
              </p>
              {brand.address && (
                <p className="text-[10px] truncate" style={{ color: "#3a3a56" }}>{brand.address}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center justify-center active:scale-90 transition-transform"
              style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: showSearch ? primaryColor + "20" : "#1e1e2a",
                color: showSearch ? primaryColor : "#52526a",
              }}
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              onClick={() => setView("cart")}
              className="relative flex items-center justify-center active:scale-90 transition-transform"
              style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: cartCount > 0 ? primaryColor + "20" : "#1e1e2a",
                color: cartCount > 0 ? primaryColor : "#52526a",
              }}
            >
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex items-center justify-center text-white text-[9px] font-bold rounded-full"
                  style={{ minWidth: 16, height: 16, backgroundColor: primaryColor, padding: "0 3px" }}
                >
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar — slides in */}
        {showSearch && (
          <div className="px-4 pb-3">
            <div
              className="flex items-center gap-2 px-3 rounded-2xl"
              style={{
                height: 40,
                backgroundColor: "#1e1e2a",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#3a3a56" }} />
              <input
                autoFocus
                type="text"
                placeholder={t("catalog.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "#f4f4f8" }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="flex-shrink-0">
                  <X className="w-3.5 h-3.5" style={{ color: "#52526a" }} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3">
            <button
              onClick={() => setSelectedCategoryId(null)}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
              style={
                selectedCategoryId === null
                  ? { backgroundColor: primaryColor, color: "#fff" }
                  : { backgroundColor: "#1e1e2a", color: "#52526a", border: "1px solid rgba(255,255,255,0.06)" }
              }
            >
              Barchasi
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                style={
                  selectedCategoryId === cat.id
                    ? { backgroundColor: primaryColor, color: "#fff" }
                    : { backgroundColor: "#1e1e2a", color: "#52526a", border: "1px solid rgba(255,255,255,0.06)" }
                }
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {renderHomeContent()}
      </div>

      {/* Floating cart bar */}
      {cartCount > 0 && view === "home" && (
        <div className="fixed left-4 right-4 z-30" style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}>
          <button
            onClick={() => setView("cart")}
            className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-between px-4 active:scale-[0.98] transition-transform"
            style={{
              backgroundColor: primaryColor,
              color: "#fff",
            }}
          >
            <span
              className="flex items-center justify-center text-xs font-bold rounded-xl"
              style={{ width: 26, height: 26, backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              {cartCount}
            </span>
            <span className="font-semibold">Savatni ko'rish</span>
            <span className="font-bold">{formatPrice(cartTotal, data.tenant.currency)}</span>
          </button>
        </div>
      )}

      {/* Bottom Nav */}
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
