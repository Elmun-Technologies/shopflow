// Telegram Mini App (Web App) — mijozlarga ko'rsatiladigan ommaviy do'kon sahifasi.
// Auth talab qilinmaydi. /api/storefront/:slug orqali ma'lumot olinadi.

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import {
  ShoppingCart, Search, Package, ChevronRight, Minus, Plus,
  X, CheckCircle2, Loader2, ArrowLeft, Phone, MapPin, User,
  Tag, Heart, Share2, ShieldCheck, BadgeCheck, ShoppingBag, Truck, Bell, Star, Send,
  Clock, Zap, Sun,
} from "lucide-react";
import { BottomNav, type StoreTab } from "./storefront/BottomNav";
import { applyTelegramTheme, haptic } from "./storefront/storefront-theme";
import { useT } from "../i18n";
import { ProductGridSkeleton } from "./storefront/Skeleton";
import { ToastProvider, useToast } from "./storefront/Toast";
import { PopupHost } from "./storefront/PopupHost";
import { ProductImageCarousel } from "./storefront/ProductImageCarousel";
import { formatUzPhone, isValidUzPhone } from "../utils/phone";
import { normalizeSingleConfig, type SingleSectionKey } from "../data/uiBuilderData";
import {
  CountdownBanner,
  RatingChipPreview as RatingChipSection,
  TrustBadgesPreview as TrustBadgesSection,
  StatsPreview as StatsSection,
  WeeklyBuyersPreview as WeeklyBuyersSection,
  DescriptionPreview as DescriptionSection,
  DeliveryPreview as DeliverySection,
  type SinglePreviewProduct,
} from "./storefront/SingleProductSections";

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
        initData?: string;
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

// Kombo chegirma foizini xavfsiz oraliqqa cheklash (0–99) — manfiy/100%+ qiymatlar
// narxni manfiy yoki noto'g'ri qilib qo'ymasligi uchun.
function clampPct(n: number): number {
  return Math.min(99, Math.max(0, Math.round(n)));
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
  imageUrl?: string | null;
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
  // Web analitika — admin Vitrina brand sozlamalarida kiritadi
  gaId?: string; // Google Analytics 4 — "G-XXXXXXX"
  yandexMetrikaId?: string; // Yandex Metrika — "12345678"
  // Single-product landing konstruktori (storeMode === "single")
  singleConfig?: unknown;
};

// Storefront'ga GA4 / Yandex Metrika trekerlarini bir marta inject qiladi.
// Tenant brand.gaId / brand.yandexMetrikaId kiritgan bo'lsa ishlaydi.
function injectAnalytics(brand: StoreBrand) {
  if (typeof document === "undefined") return;
  const gaId = brand.gaId?.trim();
  const ymId = brand.yandexMetrikaId?.trim();

  if (gaId && /^G-[A-Z0-9]+$/i.test(gaId) && !document.getElementById("sf-ga4")) {
    const s = document.createElement("script");
    s.id = "sf-ga4";
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(s);
    const inline = document.createElement("script");
    inline.id = "sf-ga4-init";
    inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId.replace(/'/g, "")}');`;
    document.head.appendChild(inline);
  }

  if (ymId && /^\d+$/.test(ymId) && !document.getElementById("sf-ym")) {
    const inline = document.createElement("script");
    inline.id = "sf-ym";
    inline.textContent =
      `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();` +
      `k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})` +
      `(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");` +
      `ym(${ymId},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});`;
    document.head.appendChild(inline);
  }
}

// CountdownBanner + msUntilMidnight → storefront/SingleProductSections.tsx (ulashilgan)

type StorefrontData = {
  tenant: { id: string; name: string; slug: string; currency: string };
  layout: StoreBlock[];
  brand: StoreBrand;
  products: StoreProduct[];
  categories: StoreCategory[];
  // Do'kon turi — "single" bo'lsa bitta mahsulotli landing ko'rsatiladi
  storeMode?: "multi" | "single";
  singleProductId?: string | null;
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

// Telegram WebApp signed initData — backend verifikatsiyasi uchun har bir
// customer-scoped so'rovga qo'shiladi (tgUserId yolg'iz tasdiqlanmaydi).
function tgInitData(): string {
  return window.Telegram?.WebApp?.initData ?? "";
}

async function fetchStorefront(slug: string): Promise<StorefrontData> {
  const res = await fetch(`${API_BASE}/storefront/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Server xatosi" }));
    throw new Error((err as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json();
}

interface PublicPaymentMethod {
  code: string;
  name: string;
  minAmount?: string | number | null;
  maxAmount?: string | number | null;
}

async function fetchPaymentMethods(slug: string): Promise<PublicPaymentMethod[]> {
  try {
    const res = await fetch(`${API_BASE}/storefront/${encodeURIComponent(slug)}/payment-methods`);
    if (!res.ok) return [];
    const data = await res.json() as { methods?: PublicPaymentMethod[] };
    return data.methods ?? [];
  } catch {
    return [];
  }
}

async function submitCheckout(
  slug: string,
  payload: {
    customer: CheckoutForm;
    items: { productId: string; qty: number }[];
    telegram?: { userId?: number; username?: string; firstName?: string; lastName?: string };
    paymentMethod?: string;
  }
): Promise<{ id: string; code: string; total: number; currency: string; paymentUrl?: string | null; paymentMethodLabel?: string | null }> {
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

// Flash sale uchun countdown — vitrina blokida endTime sozlanadi
function FlashSaleTimer({ endTime }: { endTime?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!endTime) return null;
  const end = new Date(endTime).getTime();
  const diff = Math.max(0, end - now);
  if (diff === 0) return <span className="text-[10px] text-white/80 font-mono">--:--:--</span>;
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const sec = Math.floor((diff % 60_000) / 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    <div className="flex items-center gap-1 bg-black/30 px-2 py-1 rounded-lg">
      <Clock className="w-3 h-3 text-white" />
      <span className="text-[11px] text-white font-mono font-bold">{pad(h)}:{pad(m)}:{pad(sec)}</span>
    </div>
  );
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
  const [catalogMode, setCatalogMode] = useState<"categories" | "products">("categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => loadStoredCart(slug));
  const [cartRemindShown, setCartRemindShown] = useState(false);
  const [sortBy, setSortBy] = useState<"popular" | "price_asc" | "price_desc" | "newest">("popular");
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [form, setForm] = useState<CheckoutForm>({ name: "", phone: "", email: "", address: "", notes: "", lat: null, lng: null });
  const [gpsBusy, setGpsBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<{ code: string; total: number; currency: string; paymentUrl?: string | null; paymentMethodLabel?: string | null } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<string>(""); // "" = naqd / yetkazib berishda
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites(slug));
  const [savedAddresses] = useState<StoredAddress[]>(() => loadStoredAddresses(slug));
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  // Profile sahifasi tashqi nuqtadan ochilganda boshlang'ich subview
  // (masalan, success screen'dan "Buyurtmalarim" tugmasi)
  const [profileInitialView, setProfileInitialView] = useState<"menu" | "orders" | undefined>(undefined);
  // PDP — reviews va form
  const [productReviews, setProductReviews] = useState<StoreReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
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
          body: JSON.stringify({ tgUserId: tgUid, productId, initData: tgInitData() }),
        }).catch(() => null);
      } else {
        fetch(`/api/storefront/${slug}/wishlist/${productId}?tgUserId=${tgUid}&initData=${encodeURIComponent(tgInitData())}`, {
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
        initData: tgInitData(),
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
      fetch(`/api/storefront/${slug}/wishlist?tgUserId=${tgUser.id}&initData=${encodeURIComponent(tgInitData())}`)
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

  // Single-product rejim — bitta mahsulotga qaratilgan landing + direct order.
  const isSingle = data?.storeMode === "single";
  const singleProduct = isSingle && data
    ? (data.products.find((p) => p.id === data.singleProductId) ?? null)
    : null;

  // Telegram theme'ni va brand color'ni CSS variable'lariga joylab qo'yamiz
  useEffect(() => {
    applyTelegramTheme(data?.brand?.primaryColor);
  }, [data?.brand?.primaryColor]);

  useEffect(() => {
    fetchStorefront(slug)
      .then((d) => {
        setData(d);
        // GA4 / Yandex Metrika — tenant sozlagan bo'lsa inject qilamiz
        injectAnalytics((d.brand ?? {}) as StoreBrand);
        // Single rejim — landing darhol tanlangan mahsulotni ko'rsatadi.
        // Eski multi-savatni tozalaymiz (direct-order toza boshlanishi uchun).
        if (d.storeMode === "single") {
          const sp = d.singleProductId ? d.products.find((p) => p.id === d.singleProductId) : null;
          if (sp) setSelectedProduct(sp);
          setCart([]);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // To'lov usullarini ham yuklaymiz — checkout'da ko'rsatish uchun
    fetchPaymentMethods(slug).then(setPaymentMethods);
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
    setReviewsLoading(false);
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
      setReviewsLoading(true);
      fetch(`${API_BASE}/storefront/${encodeURIComponent(slug)}/products/${selectedProduct.id}/reviews`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
        .then((data: { items: StoreReview[] }) => setProductReviews(data.items))
        .catch(() => null)
        .finally(() => setReviewsLoading(false));
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
        if (view === "checkout") { setView(isSingle ? "home" : "cart"); return; }
        if (view === "success") { setView("home"); return; }
        setView("home");
      };
      bb.onClick(handler);
      return () => bb.offClick(handler);
    } else {
      bb.hide();
    }
  }, [view, twa, isSingle]);

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
        customer: { ...form, lat: form.lat ?? undefined, lng: form.lng ?? undefined },
        items: cart.map((i) => ({ productId: i.productId, qty: i.qty })),
        telegram: tgUser ? {
          userId: tgUser.id,
          username: tgUser.username,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
        } : undefined,
        paymentMethod: selectedPayment || undefined,
      });
      setOrderResult(result);
      setCart([]);
      setView("success");
      twa?.HapticFeedback?.notificationOccurred("success");
      // Online to'lov tanlangan bo'lsa — provayder sahifasiga yo'naltiramiz
      if (result.paymentUrl) {
        if (twa?.openLink) twa.openLink(result.paymentUrl, { try_instant_view: false });
        else window.open(result.paymentUrl, "_blank");
      }
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : t("common.error"));
      twa?.HapticFeedback?.notificationOccurred("error");
    } finally {
      setSubmitting(false);
    }
  }, [data, form, cart, slug, twa, selectedPayment]);

  // Single rejim "Buyurtma berish" — mahsulot(lar)ni savatga qo'shib
  // to'g'ridan-to'g'ri checkout'ga o'tadi (savat bosqichisiz).
  const buyNow = useCallback((items: StoreProduct[]) => {
    for (const it of items) addToCart(it);
    setView("checkout");
  }, [addToCart]);

  // Single rejimda "home" ga qaytilganda landing'ni qayta ochib qo'yamiz.
  useEffect(() => {
    if (!isSingle || !singleProduct) return;
    if (view === "home" && (!selectedProduct || selectedProduct.id !== singleProduct.id)) {
      setSelectedProduct(singleProduct);
    }
  }, [isSingle, singleProduct, view, selectedProduct]);

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
    const deliveryDate = estimatedDeliveryDate();
    const deliveryStr = formatUzDate(deliveryDate);
    const hasTg = !!telegramUser?.userId;
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 py-8" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
          <div className="max-w-md mx-auto">
            {/* Hero — yashil belgi + sarlavha */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-300" style={{ backgroundColor: primaryColor + "20" }}>
                <CheckCircle2 className="w-11 h-11" style={{ color: primaryColor }} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">{t("success.title")}</h2>
              <p className="text-sm text-slate-400">{t("success.subtitle")}</p>
            </div>

            {/* Buyurtma kartochkasi */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider">Buyurtma</p>
                  <p className="text-lg font-bold text-white">#{orderResult.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500 uppercase tracking-wider">Jami</p>
                  <p className="text-lg font-bold" style={{ color: primaryColor }}>
                    {formatPrice(orderResult.total, orderResult.currency)}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-400 flex-shrink-0" />
                <span className="text-xs text-slate-300">Yetkazib berish: <span className="font-medium text-white">{deliveryStr}</span></span>
              </div>
            </div>

            {/* Status taymlayni — keyingi qadamlar */}
            <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 mb-4">
              <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-3">Keyingi qadamlar</p>
              <div className="space-y-3">
                {[
                  { label: t("success.step.received"), desc: t("success.step.receivedDesc"), done: true },
                  { label: t("success.step.processing"), desc: t("success.step.processingDesc"), done: false, active: true },
                  { label: t("success.step.shipping"), desc: t("success.step.shippingDesc"), done: false },
                  { label: t("success.step.delivered"), desc: deliveryStr, done: false },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      s.done
                        ? "bg-emerald-500 text-white"
                        : s.active
                          ? "bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/40"
                          : "bg-slate-800 text-slate-600"
                    }`}>
                      {s.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0 pb-0.5">
                      <p className={`text-sm font-medium ${s.done || s.active ? "text-white" : "text-slate-500"}`}>{s.label}</p>
                      <p className="text-[11px] text-slate-500">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bildirishnoma haqida eslatma */}
            {hasTg ? (
              <div className="flex items-start gap-2.5 p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl mb-6">
                <Bell className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-sky-200 leading-relaxed">
                  {t("success.notify.tg")}
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 p-3 bg-slate-800/60 border border-slate-700/60 rounded-xl mb-6">
                <Bell className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  Buyurtma raqamingizni <span className="font-semibold">#{orderResult.code}</span> saqlab qo'ying — kerak bo'lsa shu raqam orqali tekshiring.
                </p>
              </div>
            )}

            {/* Action tugmalari */}
            <div className="space-y-2">
              {orderResult.paymentUrl && (
                <a
                  href={orderResult.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3.5 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600"
                >
                  {orderResult.paymentMethodLabel ? `${orderResult.paymentMethodLabel} bilan to'lash` : "To'lov sahifasiga o'tish"}
                </a>
              )}
              <button
                onClick={() => {
                  setProfileInitialView("orders");
                  setView("profile");
                  setOrderResult(null);
                }}
                className="w-full py-3.5 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                <ShoppingBag className="w-5 h-5" />
                {t("success.viewOrder")}
              </button>
              <button
                onClick={() => {
                  setProfileInitialView(undefined);
                  setView("home");
                  setOrderResult(null);
                }}
                className="w-full py-3 rounded-2xl font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all"
              >
                {t("success.continueShopping")}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- CHECKOUT ----
  if (view === "checkout") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-slate-800">
          <button onClick={() => setView(isSingle ? "home" : "cart")} className="p-2 rounded-xl text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-white">{t("checkout.title")}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Order summary */}
          <div className="bg-slate-900 rounded-2xl p-4">
            <h3 className="text-xs font-medium text-slate-400 mb-3">{t("checkout.orderSummary")}</h3>
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <span className="text-sm text-white">{item.name} <span className="text-slate-500">×{item.qty}</span></span>
                <span className="text-sm font-medium" style={{ color: primaryColor }}>
                  {formatPrice(item.price * item.qty, data.tenant.currency)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 mt-1">
              <span className="text-sm font-semibold text-white">{t("checkout.total")}</span>
              <span className="text-base font-bold" style={{ color: primaryColor }}>
                {formatPrice(cartTotal, data.tenant.currency)}
              </span>
            </div>
          </div>

          {/* Customer form */}
          <div className="bg-slate-900 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-medium text-slate-400 mb-1">{t("checkout.yourInfo")}</h3>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{t("checkout.name")} *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={t("checkout.namePlaceholder")}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{t("checkout.phone")} *</label>
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
                <p className="text-[11px] text-rose-300 mt-1">{t("checkout.phoneInvalid")}</p>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{t("checkout.addressLabel")}</label>
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
                  placeholder={t("checkout.address")}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value, lat: null, lng: null }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              {/* GPS — joriy joylashuvni olish */}
              <button
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.show(t("checkout.gpsUnsupported"), "error");
                    return;
                  }
                  setGpsBusy(true);
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const { latitude, longitude } = pos.coords;
                      const lat = Number(latitude.toFixed(6));
                      const lng = Number(longitude.toFixed(6));
                      // Address bo'sh bo'lsa, koordinatadan o'qiladigan label yasaymiz
                      setForm((f) => ({
                        ...f,
                        lat,
                        lng,
                        address: f.address.trim() || `GPS: ${lat}, ${lng}`,
                      }));
                      haptic.medium();
                      setGpsBusy(false);
                    },
                    (err) => {
                      setGpsBusy(false);
                      toast.show(
                        err.code === err.PERMISSION_DENIED ? t("checkout.gpsDenied") : t("checkout.gpsError"),
                        "error",
                      );
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
                  );
                }}
                disabled={gpsBusy}
                className="mt-1.5 w-full flex items-center justify-center gap-2 px-3 py-2 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/15 disabled:opacity-50 rounded-xl text-sm text-sky-300 transition-colors"
              >
                {gpsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-base leading-none">📍</span>}
                {t("checkout.gps")}
              </button>
              {form.lat != null && form.lng != null && (
                <p className="text-[11px] text-emerald-300 mt-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  {t("checkout.gpsDetected")}: <span className="font-mono">{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</span>
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{t("checkout.note")}</label>
              <textarea
                placeholder={t("checkout.notePlaceholder")}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
          </div>

          {paymentMethods.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-4 space-y-2">
              <h3 className="text-xs font-medium text-slate-400 mb-2">To'lov usuli</h3>
              <button
                type="button"
                onClick={() => setSelectedPayment("")}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  selectedPayment === ""
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-800/50"
                }`}
              >
                <span className="text-sm font-medium text-white">Yetkazib berishda naqd</span>
                {selectedPayment === "" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </button>
              {paymentMethods.map((m) => (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => setSelectedPayment(m.code)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${
                    selectedPayment === m.code
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-800/50"
                  }`}
                >
                  <span className="text-sm font-medium text-white">{m.name}</span>
                  {selectedPayment === m.code && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </button>
              ))}
            </div>
          )}

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
            {submitting ? t("checkout.sending") : `${t("checkout.submit")} · ${formatPrice(cartTotal, data.tenant.currency)}`}
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
              onClick={() => setView("home")}
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
                <span className="text-sm text-slate-400">{t("cart.totalItems", { count: cartCount })}</span>
                <span className="text-lg font-bold text-white">{formatPrice(cartTotal, data.tenant.currency)}</span>
              </div>
              <button
                onClick={() => setView("checkout")}
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

    // ---- Single-product landing konstruktor tartibi ----
    // Admin Vitrina'da saqlangan bo'lim tartibi/holatiga qarab body bo'limlari
    // chiziladi. Multi rejimda (oddiy PDP) tartib o'zgarmaydi.
    const singleSectionList = isSingle ? normalizeSingleConfig(data.brand?.singleConfig).sections : [];

    // Reyting chipi — sarlavha ostida (har ikki rejimda). Sharhlar mavjud bo'lsa
    // doim ko'rinadi; "reviews" bo'limi toggle'i faqat to'liq sharhlar ro'yxatini boshqaradi.
    // Ulashilgan bo'limlar uchun view-model (konstruktor preview bilan bir xil shakl)
    const sectionVm: SinglePreviewProduct = {
      name: selectedProduct.name,
      price,
      oldPrice: oldPrice ?? undefined,
      currency: data.tenant.currency,
      imageUrl: selectedProduct.imageUrl ?? undefined,
      description: desc || undefined,
      stock: selectedProduct.stock,
      featured: !!selectedProduct.featured,
      categoryName: selectedProduct.category?.name,
      reviewCount: selectedProduct.reviewCount ?? 0,
      avgRating: selectedProduct.avgRating ?? 0,
      weeklyBuyers,
      comboCount: selectedProduct.comboAddons?.length ?? 0,
    };

    const ratingChipEl =
      (selectedProduct.reviewCount ?? 0) > 0 ? (
        <RatingChipSection vm={sectionVm} sample={false} className="mb-3" />
      ) : null;

    // Ishonch belgilari
    const trustBadgesEl = (
      <TrustBadgesSection
        onOpenOriginal={() => { haptic.light(); setTrustSheet("original"); }}
        onOpenWarranty={() => { haptic.light(); setTrustSheet("warranty"); }}
      />
    );

    // Tezkor ma'lumot (kategoriya, mavjudlik, bestseller)
    const statsEl = <StatsSection vm={sectionVm} />;

    // Social proof — haftalik xaridorlar
    const weeklyBuyersEl = weeklyBuyers > 0 ? <WeeklyBuyersSection vm={sectionVm} sample={false} /> : null;

    // Aksiya taymeri — faqat single rejim konstruktorida
    const timerEl = <CountdownBanner label={t("single.timerLabel")} color={primaryColor} />;

    // Tavsif
    const descriptionEl = desc ? (
      <DescriptionSection
        vm={sectionVm}
        expanded={descExpanded}
        isLong={descIsLong}
        onToggle={() => { haptic.light(); setDescExpanded((v) => !v); }}
      />
    ) : null;

    // Yetkazib berish
    const deliveryEl = <DeliverySection dateStr={deliveryStr} />;

    // Sharhlar (to'liq ro'yxat)
    const reviewsEl = (
      <div>
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
        {reviewsLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="bg-slate-900 rounded-xl p-3 border border-slate-800 animate-pulse">
                <div className="h-3 w-24 bg-slate-800 rounded mb-2" />
                <div className="h-2.5 w-full bg-slate-800 rounded" />
                <div className="h-2.5 w-2/3 bg-slate-800 rounded mt-1.5" />
              </div>
            ))}
          </div>
        ) : productReviews.length === 0 ? (
          <div className="flex flex-col items-center text-center py-5 px-3 bg-slate-900/50 rounded-xl border border-slate-800">
            <Star className="w-7 h-7 text-slate-700 mb-2" />
            <p className="text-xs text-slate-400">{t("pdp.noReviews")}</p>
            {telegramUser?.userId && (
              <button
                type="button"
                onClick={() => { haptic.light(); setReviewForm((f) => ({ ...f, open: true })); }}
                className="mt-3 px-4 py-2 rounded-xl bg-slate-800 text-sky-400 text-xs font-medium active:scale-[0.98] transition-transform"
              >
                {t("pdp.beFirst")}
              </button>
            )}
          </div>
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
    );

    // Combo / qo'shimcha mahsulotlar
    const comboEl = selectedProduct.comboAddons && selectedProduct.comboAddons.length > 0 ? (
      <div>
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
            const pct = clampPct(addon.discountPct);
            const finalPrice = pct > 0
              ? Math.round(origPrice * (1 - pct / 100))
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
                      {pct > 0 && (
                        <>
                          <span className="text-[10px] text-slate-500 line-through">{origPrice.toLocaleString("uz-UZ")}</span>
                          <span className="text-[10px] font-bold text-rose-300">−{pct}%</span>
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
    ) : isSingle ? (
      // Single rejimda kombo bo'limi yoqilgan, lekin mahsulotda qo'shimcha yo'q —
      // bo'lim jim yo'qolmasligi uchun ohista maslahat.
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Plus className="w-4 h-4 text-slate-600" />
        <span>{t("pdp.noCombo")}</span>
      </div>
    ) : null;

    // Single rejim: kalit → bo'lim JSX
    const singleSectionEl = (key: SingleSectionKey) => {
      switch (key) {
        case "trustBadges": return trustBadgesEl;
        case "reviews": return reviewsEl;
        case "weeklyBuyers": return weeklyBuyersEl;
        case "stats": return statsEl;
        case "timer": return timerEl;
        case "description": return descriptionEl;
        case "delivery": return deliveryEl;
        case "combo": return comboEl;
        default: return null;
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
            {!isSingle && (
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                aria-label="Yopish"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
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
          {isSingle ? <div /> : (
            <button
              onClick={() => setSelectedProduct(null)}
              className="w-9 h-9 rounded-full bg-slate-800/60 backdrop-blur flex items-center justify-center text-white active:scale-90 transition-transform"
              aria-label="Yopish"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
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
            // Gisterezis — chegara atrofida miltillamaslik uchun (yoq >180, o'chir <140)
            const next = pdpScrolled ? top > 140 : top > 180;
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

            {/* Ishonch belgilari — multi rejimda sarlavhadan tepada.
                Single rejimda konstruktor tartibida (pastda) chiziladi. */}
            {!isSingle && <div className="mb-4">{trustBadgesEl}</div>}

            {/* Title */}
            <h2 className="text-lg font-semibold text-white mb-3 leading-snug">{selectedProduct.name}</h2>

            {/* Rating chip — sarlavha ostida (single rejimda "reviews" bo'limiga bog'liq) */}
            {ratingChipEl}

            {/* Body bo'limlari — single rejimda konstruktor tartibida (yoqilganlari),
                multi rejimda standart tartibda. Bir xil oraliq + chiziq + kirish animatsiyasi. */}
            {(() => {
              const ordered: Array<{ key: string; el: React.ReactNode }> = isSingle
                ? singleSectionList.filter((s) => s.enabled).map((s) => ({ key: s.key, el: singleSectionEl(s.key) }))
                : [
                    { key: "stats", el: statsEl },
                    { key: "weeklyBuyers", el: weeklyBuyersEl },
                    { key: "description", el: descriptionEl },
                    { key: "delivery", el: deliveryEl },
                    { key: "reviews", el: reviewsEl },
                    { key: "combo", el: comboEl },
                  ];
              const visible = ordered.filter((b) => b.el);
              return visible.map((b, i) => (
                <div
                  key={b.key}
                  className={`animate-in fade-in slide-in-from-bottom-1 duration-300 ${
                    i > 0 ? "mt-5 pt-5 border-t border-slate-800" : "mt-4"
                  }`}
                  style={{ animationDelay: `${Math.min(i * 40, 240)}ms`, animationFillMode: "both" }}
                >
                  {b.el}
                </div>
              ));
            })()}
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
              const pct = clampPct(addon.discountPct);
              const fp = pct > 0
                ? Math.round(orig * (1 - pct / 100))
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
                    if (isSingle) {
                      buyNow([selectedProduct, ...selectedComboItems.map((i) => i.product)]);
                    } else {
                      addToCart(selectedProduct);
                      for (const item of selectedComboItems) addToCart(item.product);
                      setSelectedProduct(null);
                    }
                  }}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-0.5"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    {isSingle ? t("single.buy") : "Combo savatga"} · {comboTotal.toLocaleString("uz-UZ")} {currencyStr}
                  </span>
                  <span className="text-xs opacity-90">{1 + selectedComboItems.length} ta mahsulot · yetkazib berish {deliveryStr}</span>
                </button>
              );
            }

            if (qty === 0) {
              return (
                <button
                  onClick={() => { if (isSingle) { buyNow([selectedProduct]); } else { addToCart(selectedProduct); setSelectedProduct(null); } }}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-0.5"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="flex items-center gap-2">
                    {isSingle ? <ShoppingBag className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {isSingle ? t("single.buy") : "Savatga"}
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
                onClick={() => { if (isSingle) { setView("checkout"); } else { setSelectedProduct(null); setView("cart"); } }}
                className="flex-1 py-3 rounded-2xl font-semibold text-white text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                style={{ backgroundColor: primaryColor }}
              >
                <ShoppingCart className="w-4 h-4" />
                {isSingle ? t("single.buy") : "Savatga o'tish"}
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
                          initData: tgInitData(),
                          productId: selectedProduct.id,
                          rating: reviewForm.rating,
                          text: reviewForm.text.trim(),
                        }),
                      });
                      const body = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error((body as { error?: string }).error || t("pdp.review.error"));
                      haptic.success();
                      setReviewForm({ open: false, rating: 5, text: "", busy: false });
                      toast.show(t("pdp.review.success"), "success");
                    } catch (err) {
                      toast.show(err instanceof Error ? err.message : t("pdp.review.error"), "error");
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
        className={`bg-slate-900 rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform relative group border border-slate-800/60 ${
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
        <div className="p-3">
          {/* Name — mahsulot identifikatori birinchi */}
          <p className="text-xs font-medium text-white leading-snug line-clamp-2 mb-1.5">{product.name}</p>

          {/* Low stock indicator */}
          {lowStock && (
            <p className="text-[10px] text-amber-300 mb-1.5 leading-tight">
              ⚡ Faqat {product.stock} ta qoldi
            </p>
          )}

          {/* Price line — katta qalin + kichik o'chirilgan */}
          <div className="flex items-baseline gap-1.5 mb-2.5">
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

          {/* Add to cart */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!outOfStock) addToCart(product);
            }}
            disabled={outOfStock}
            className="w-full py-2 rounded-xl flex items-center justify-center gap-1.5 text-white text-xs font-semibold active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
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
              <Tag className="w-12 h-12 mx-auto text-cream-300 mb-3" />
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
    const showCatGrid = catalogMode === "categories" && !searchQuery;
    const selectedCat = categories.find((c) => c.id === selectedCategoryId);
    const catProductCount = (catId: string) =>
      data.products.filter((p) => (p as { categoryId?: string }).categoryId === catId).length;

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 bg-slate-950 border-b border-slate-800 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div className="flex items-center gap-2 mb-2">
            {!showCatGrid && (
              <button
                onClick={() => { setSelectedCategoryId(null); setCatalogMode("categories"); setSearchQuery(""); }}
                className="p-1.5 -ml-1.5 rounded-lg text-slate-400 active:text-white active:bg-slate-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-base font-semibold text-white flex-1">
              {showCatGrid ? "Katalog" : (selectedCat?.name || t("catalog.allProducts"))}
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) { setSelectedCategoryId(null); setCatalogMode("products"); } }}
              placeholder={t("catalog.searchPlaceholder")}
              className="w-full bg-slate-800 rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setCatalogMode("categories"); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {showCatGrid ? (
          /* ── Kategoriyalar gridi ── */
          <div className="flex-1 overflow-y-auto pb-24">
            {/* Barcha mahsulotlar shortcut */}
            <button
              onClick={() => { setSelectedCategoryId(null); setCatalogMode("products"); }}
              className="w-full flex items-center justify-between px-4 py-3.5 border-b border-slate-800 active:bg-slate-900/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ backgroundColor: primaryColor + "20" }}>
                  🛍️
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">{t("catalog.allProducts")}</p>
                  <p className="text-[11px] text-slate-500">{t("catalog.productCount", { n: data.products.length })}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>

            {categories.length > 0 ? (
              <div className="p-4">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-3">Kategoriyalar</p>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map((cat) => {
                    const count = catProductCount(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => { setSelectedCategoryId(cat.id); setCatalogMode("products"); }}
                        className="bg-slate-900 rounded-2xl p-3.5 text-left active:scale-[0.98] transition-transform border border-slate-800/60"
                      >
                        <div
                          className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-lg font-bold text-white mb-2.5"
                          style={cat.imageUrl ? {} : { backgroundColor: primaryColor + "25" }}
                        >
                          {cat.imageUrl
                            ? <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover" />
                            : (cat.name[0]?.toUpperCase() ?? "?")
                          }
                        </div>
                        <p className="text-sm font-medium text-white leading-tight line-clamp-2">{cat.name}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{t("catalog.productCount", { n: count })}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <Package className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                <p className="text-sm text-slate-400">Kategoriyalar yo'q</p>
              </div>
            )}
          </div>
        ) : (
          /* ── Mahsulotlar ro'yxati ── */
          <>
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/50">
              <span className="text-[11px] text-slate-500">{t("catalog.productCount", { n: filteredProducts.length })}</span>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="appearance-none bg-slate-800 border border-slate-700 text-xs text-white pl-3 pr-8 py-1.5 rounded-lg focus:outline-none"
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
                  <Package className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400">
                    {searchQuery ? t("catalog.empty.search", { q: searchQuery }) : t("catalog.empty.category")}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(""); setCatalogMode("categories"); }}
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
          </>
        )}

        <BottomNav
          active="catalog"
          cartCount={cartCount}
          primaryColor={primaryColor}
          onChange={(tab) => {
            if (tab === "catalog") { setCatalogMode("categories"); setSelectedCategoryId(null); }
            setView(TAB_VIEWS[tab]);
          }}
        />
        {selectedProduct && renderProductDetail()}
      </div>
    );
  }

  const renderHomeContent = () => {
    const enabledBlocks = layout.filter((b) => b.enabled);

    // If no layout blocks saved, show default products view
    if (enabledBlocks.length === 0) {
      const activeLabel = selectedCategoryId
        ? (categories.find((c) => c.id === selectedCategoryId)?.name ?? t("catalog.allProducts"))
        : t("catalog.allProducts");
      return (
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">{activeLabel}</h2>
            <span className="text-xs text-slate-500">{filteredProducts.length} ta</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map(renderProductCard)}
          </div>
          {filteredProducts.length === 0 && (
            <div className="py-12 text-center">
              <Package className="w-12 h-12 text-cream-300 mx-auto mb-3" />
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
                        <div className="w-10 h-10 mx-auto rounded-full overflow-hidden flex items-center justify-center mb-1.5" style={(cat as StoreCategory).imageUrl ? {} : { backgroundColor: primaryColor + "25" }}>
                          {(cat as StoreCategory).imageUrl
                            ? <img src={(cat as StoreCategory).imageUrl!} alt={cat.name} className="w-full h-full object-cover" />
                            : <span className="text-base">{cat.name[0]}</span>
                          }
                        </div>
                        <p className="text-[11px] text-white">{cat.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            case "banner":
              return (
                <div
                  key={block.id}
                  className="w-full rounded-2xl overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${(s.bgColor as string) || primaryColor}, ${brand.secondaryColor || "#6366f1"})` }}
                >
                  <div className="p-5">
                    <h2 className="text-lg font-bold text-white">{String(s.title ?? block.title ?? "")}</h2>
                    {!!s.subtitle && <p className="text-xs text-white/80 mt-1">{String(s.subtitle)}</p>}
                    {!!s.buttonText && (
                      <button className="mt-3 px-4 py-2 bg-white text-slate-900 text-xs font-semibold rounded-xl">
                        {String(s.buttonText)}
                      </button>
                    )}
                  </div>
                </div>
              );

            case "stories": {
              // Mavjud kategoriyalardan birinchi 6 tasini story-circle qilib ko'rsatamiz
              const storyCats = categories.slice(0, 6);
              const items = storyCats.length > 0
                ? storyCats
                : Array.from({ length: 6 }, (_, i) => ({ id: `ph-${i}`, name: `Hikoya ${i + 1}`, slug: "", parentId: null }));
              return (
                <div key={block.id}>
                  <h3 className="text-sm font-semibold text-white mb-3">{block.title}</h3>
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                    {items.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => storyCats.length > 0 && setSelectedCategoryId(cat.id)}
                        className="flex-shrink-0 flex flex-col items-center gap-1.5"
                      >
                        <div
                          className="w-16 h-16 rounded-full p-0.5"
                          style={{ background: `linear-gradient(135deg, ${primaryColor}, #ec4899)` }}
                        >
                          {(cat as StoreCategory).imageUrl
                            ? <img src={(cat as StoreCategory).imageUrl!} alt={cat.name} className="w-full h-full rounded-full object-cover" />
                            : <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-lg font-bold text-white">
                                {cat.name[0]}
                              </div>
                          }
                        </div>
                        <span className="text-[10px] text-slate-300 max-w-[64px] truncate">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            case "categories_grid": {
              const items = categories.length > 0
                ? categories
                : Array.from({ length: 5 }, (_, i) => ({ id: `ph-${i}`, name: `Kategoriya ${i + 1}`, slug: "", parentId: null, createdAt: "" }));
              return (
                <div key={block.id}>
                  <h3 className="text-sm font-semibold text-white mb-3">{block.title}</h3>
                  <div className="space-y-2">
                    {items.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => categories.length > 0 && setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl ${selectedCategoryId === cat.id ? "ring-2" : "bg-slate-900"} ${categories.length === 0 ? "opacity-40 cursor-default" : ""}`}
                        style={selectedCategoryId === cat.id ? { backgroundColor: primaryColor + "20" } : {}}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: primaryColor + "25" }}>
                            {cat.name[0]}
                          </div>
                          <span className="text-sm text-white">{cat.name}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            case "categories_2x2": {
              const count = (s.count as number) || 4;
              const cats = categories.slice(0, count);
              const items = cats.length > 0
                ? cats
                : Array.from({ length: count }, (_, i) => ({ id: `ph-${i}`, name: `Kategoriya ${i + 1}`, slug: "", parentId: null, createdAt: "" }));
              return (
                <div key={block.id}>
                  <h3 className="text-sm font-semibold text-white mb-3">{block.title}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {items.map((cat, i) => {
                      const grad = [
                        "linear-gradient(135deg,#3b82f6,#1e40af)",
                        "linear-gradient(135deg,#ec4899,#a21caf)",
                        "linear-gradient(135deg,#f59e0b,#b45309)",
                        "linear-gradient(135deg,#10b981,#047857)",
                        "linear-gradient(135deg,#8b5cf6,#5b21b6)",
                        "linear-gradient(135deg,#ef4444,#991b1b)",
                      ][i % 6];
                      return (
                        <button
                          key={cat.id}
                          onClick={() => cats.length > 0 && setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
                          className={`aspect-square rounded-2xl p-4 flex flex-col justify-between text-left overflow-hidden relative ${cats.length === 0 ? "opacity-40 cursor-default" : ""}`}
                          style={{ background: grad }}
                        >
                          <span className="text-2xl">{cat.name[0]}</span>
                          <div>
                            <p className="text-sm font-semibold text-white">{cat.name}</p>
                            <p className="text-[10px] text-white/70 mt-0.5">Ko'rish →</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            case "flash_sale": {
              const count = (s.count as number) || 4;
              // Eski narxi (oldPrice) bo'lgan mahsulotlar — chegirma
              let blockProds = products.filter((p) => p.oldPrice && Number(p.oldPrice) > Number(p.price));
              if (blockProds.length === 0) blockProds = products;
              blockProds = blockProds.slice(0, count);
              const showSkeleton = blockProds.length === 0;
              return (
                <div key={block.id} className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                        <h3 className="text-sm font-bold text-white">{block.title}</h3>
                      </div>
                      <FlashSaleTimer endTime={s.endTime as string | undefined} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {showSkeleton
                        ? Array.from({ length: count }, (_, i) => (
                            <div key={i} className="bg-white/10 rounded-2xl aspect-square flex items-center justify-center">
                              <Package className="w-8 h-8 text-white/40" />
                            </div>
                          ))
                        : blockProds.map(renderProductCard)
                      }
                    </div>
                  </div>
                </div>
              );
            }

            case "product_of_day": {
              const featured = products.find((p) => p.featured) || products[0];
              if (!featured) {
                return (
                  <div key={block.id} className="rounded-2xl bg-slate-900 p-6 text-center">
                    <Sun className="w-10 h-10 text-cream-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">{block.title}</p>
                    <p className="text-xs text-slate-500 mt-1">Mahsulot tanlanmagan</p>
                  </div>
                );
              }
              const price = Number(featured.price);
              const oldPrice = featured.oldPrice ? Number(featured.oldPrice) : null;
              const discount = calcDiscountPct(price, oldPrice);
              const stockBar = s.showStockBar !== false;
              const stockPct = Math.min(100, Math.max(0, (featured.stock / 20) * 100));
              return (
                <button
                  key={block.id}
                  onClick={() => setSelectedProduct(featured)}
                  className="w-full rounded-2xl overflow-hidden bg-slate-900 text-left"
                >
                  <div className="flex items-center gap-1.5 px-4 pt-3 pb-2">
                    <Sun className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: primaryColor }}>{block.title}</span>
                  </div>
                  <div className="flex gap-3 p-3 pt-0">
                    <div className="w-28 h-28 rounded-xl bg-slate-800 flex-shrink-0 overflow-hidden">
                      {featured.imageUrl ? (
                        <img src={featured.imageUrl} alt={featured.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-10 h-10 text-slate-600" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-white line-clamp-2">{featured.name}</h4>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span className="text-base font-bold text-white">{formatPrice(price, data.tenant.currency)}</span>
                        {oldPrice && (
                          <span className="text-xs text-slate-500 line-through">{formatPrice(oldPrice, data.tenant.currency)}</span>
                        )}
                      </div>
                      {discount > 0 && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                          -{discount}%
                        </span>
                      )}
                      {stockBar && featured.stock > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${stockPct}%`, backgroundColor: stockPct < 30 ? "#ef4444" : primaryColor }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">{featured.stock} ta qoldi</p>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            }

            case "preorder":
            case "new_products":
            case "discounts":
            case "trending":
            case "bestsellers":
            case "recommended":
            case "category_products": {
              const count = (s.count as number) || 4;
              const catName = s.category as string | undefined;
              // ID orqali moslashtirish — nom case-insensitive yoki slug bo'yicha
              const targetCat = catName
                ? categories.find((c) =>
                    c.name.toLowerCase() === catName.toLowerCase() ||
                    c.slug === catName.toLowerCase().replace(/\s+/g, "-")
                  )
                : null;
              let blockProds = targetCat
                ? products.filter((p) => p.categoryId === targetCat.id)
                : catName ? [] : products;
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
                          <div key={i} className="bg-slate-900 rounded-2xl overflow-hidden opacity-50 border border-slate-800/60">
                            <div className="aspect-square bg-slate-800 flex items-center justify-center">
                              <Package className="w-10 h-10 text-cream-300" />
                            </div>
                            <div className="p-3 space-y-2">
                              <div className="h-2.5 bg-slate-800 rounded-full w-3/4" />
                              <div className="h-2.5 bg-slate-800 rounded-full w-1/2" />
                              <div className="h-7 bg-slate-800 rounded-xl w-full" />
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

  // ---- SINGLE-PRODUCT LANDING ----
  // Bitta mahsulot rejimida butun do'kon = bitta mahsulot sahifasi.
  // PDP renderer (selectedProduct = singleProduct) to'liq ekran sifatida ishlatiladi.
  if (isSingle) {
    if (singleProduct) {
      return renderProductDetail() ?? (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
        </div>
      );
    }
    // Mahsulot tanlanmagan (empty) yoki o'chirilgan/nofaol (unavailable)
    const reason = data.singleProductId ? t("single.unavailable") : t("single.empty");
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
          <Package className="w-8 h-8 text-slate-600" />
        </div>
        <p className="text-base font-semibold text-white mb-1">{brand.name || data.tenant.name}</p>
        <p className="text-sm text-slate-400">{reason}</p>
      </div>
    );
  }

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
              placeholder={t("catalog.searchPlaceholder")}
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
