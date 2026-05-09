import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import { tg, getBotIdFromUrl } from "./lib/tg";
import { miniApi, setToken, type Category, type Product, type OrderSummary, type UISchemaShape } from "./lib/api";
import HomePage from "./pages/HomePage";
import NewCatalogPage from "./pages/NewCatalogPage";
import NewProductPage from "./pages/NewProductPage";
import NewCartPage from "./pages/NewCartPage";
import NewCheckoutPage from "./pages/NewCheckoutPage";
import FavoritesPage from "./pages/FavoritesPage";
import ProfilePage from "./pages/ProfilePage";
import BottomNav, { type Tab } from "./components/BottomNav";

type Screen =
  | { kind: "tab"; tab: Tab; categoryId?: string | null; query?: string }
  | { kind: "product"; productId: string; from: Tab }
  | { kind: "checkout" }
  | { kind: "success"; orderNumber: string; total: number };

export type CartItem = { productId: string; quantity: number };

interface ShopInfo { id: string; name: string; currency: string }

export default function MiniApp() {
  const [stack, setStack] = useState<Screen[]>([{ kind: "tab", tab: "home" }]);
  const [authStatus, setAuthStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [user, setUser] = useState<{ firstName: string | null; username: string | null } | null>(null);
  const [, setUiSchema] = useState<UISchemaShape | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);

  const current = stack[stack.length - 1];
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const cartMap = useMemo(() => new Map(cart.map((c) => [c.productId, c.quantity])), [cart]);
  const favoriteIds = useMemo(() => new Set(products.filter((p) => p.isFavorite).map((p) => p.id)), [products]);

  useEffect(() => {
    tg.ready();
    tg.expand();
    const botId = getBotIdFromUrl();
    if (!botId) {
      setAuthStatus("error");
      setError("URL'da botId yo'q. Bot menyusi orqali oching.");
      return;
    }
    (async () => {
      try {
        const auth = await miniApi.auth(botId, tg.initData || "dev");
        setToken(auth.token);
        setShop(auth.shop);
        setUser(auth.user);
        const [cat, schema] = await Promise.all([
          miniApi.catalog(),
          miniApi.uiSchema().catch(() => null),
        ]);
        setCategories(cat.categories);
        setProducts(cat.products);
        if (schema) setUiSchema(schema);
        try {
          const c = await miniApi.cart.get();
          setCart(c.items);
        } catch { /* */ }
        setAuthStatus("ready");
      } catch (err) {
        setAuthStatus("error");
        setError(err instanceof Error ? err.message : "Ulanib bo'lmadi");
      }
    })();
  }, []);

  // Telegram BackButton
  useEffect(() => {
    if (stack.length > 1) {
      tg.BackButton.show();
      const cb = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
      tg.BackButton.onClick(cb);
      return () => tg.BackButton.offClick(cb);
    }
    tg.BackButton.hide();
  }, [stack.length]);

  function nav(s: Screen) { setStack((prev) => [...prev, s]); }
  function pop() { setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev)); }
  function reset(s: Screen) { setStack([s]); }
  function setTab(tab: Tab) {
    setStack([{ kind: "tab", tab }]);
  }

  function addToCart(productId: string, delta = 1) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === productId);
      let next: CartItem[];
      if (idx < 0 && delta > 0) next = [...prev, { productId, quantity: delta }];
      else if (idx < 0) next = prev;
      else {
        const q = prev[idx].quantity + delta;
        if (q <= 0) next = prev.filter((_, i) => i !== idx);
        else next = prev.map((it, i) => (i === idx ? { ...it, quantity: q } : it));
      }
      miniApi.cart.save(next).catch(() => {});
      return next;
    });
    tg.HapticFeedback.impactOccurred("light");
  }

  function setQty(productId: string, qty: number) {
    setCart((prev) => {
      const next = qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i));
      miniApi.cart.save(next).catch(() => {});
      return next;
    });
  }

  async function toggleFavorite(productId: string) {
    tg.HapticFeedback.impactOccurred("light");
    try {
      const result = await miniApi.favorites.toggle(productId);
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, isFavorite: result.isFavorite } : p));
    } catch { /* */ }
  }

  async function placeOrder(input: { customerPhone: string; address?: object; paymentMethod: "cash" | "card_online" | "transfer"; notes?: string }) {
    const result = await miniApi.orders.create({
      items: cart,
      customerPhone: input.customerPhone,
      deliveryAddress: input.address,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
    });
    setCart([]);
    reset({ kind: "success", orderNumber: result.orderNumber, total: result.total });
    return result;
  }

  async function loadOrders() {
    try {
      const list = await miniApi.orders.my();
      setOrders(list);
    } catch { /* */ }
  }

  // Auth holatlari
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-violet-600" />
        <p className="mt-4 text-gray-600 text-sm">Yuklanmoqda…</p>
      </div>
    );
  }
  if (authStatus === "error") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="mt-4 text-gray-900 text-sm font-semibold">Xatolik</p>
        <p className="mt-2 text-gray-500 text-xs text-center max-w-xs">{error}</p>
      </div>
    );
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => {
    const p = productMap.get(i.productId);
    return p ? s + p.price * i.quantity : s;
  }, 0);
  const activeTab: Tab = current.kind === "tab" ? current.tab : current.kind === "product" ? current.from : "home";

  const handleProduct = (id: string) => nav({ kind: "product", productId: id, from: activeTab });

  return (
    <div className="bg-gray-50 min-h-screen text-gray-900">
      <div className="max-w-md mx-auto pb-[68px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.kind + ("tab" in current ? current.tab : "") + ("productId" in current ? current.productId : "")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {current.kind === "tab" && current.tab === "home" && (
              <HomePage
                shop={shop}
                categories={categories}
                products={products}
                cart={cartMap}
                onProduct={handleProduct}
                onCategory={(id) => setStack([{ kind: "tab", tab: "catalog", categoryId: id }])}
                onShowAllFeatured={() => setStack([{ kind: "tab", tab: "catalog" }])}
                onAddCart={(id) => addToCart(id, 1)}
                onSetQty={setQty}
                onToggleFavorite={toggleFavorite}
                onSearchSubmit={(q) => setStack([{ kind: "tab", tab: "catalog", query: q }])}
              />
            )}
            {current.kind === "tab" && current.tab === "catalog" && (
              <NewCatalogPage
                shop={shop}
                categories={categories}
                products={products}
                cart={cartMap}
                initialCategoryId={current.categoryId}
                initialQuery={current.query}
                onProduct={handleProduct}
                onAddCart={(id) => addToCart(id, 1)}
                onSetQty={setQty}
                onToggleFavorite={toggleFavorite}
              />
            )}
            {current.kind === "tab" && current.tab === "cart" && (
              <NewCartPage
                items={cart}
                productMap={productMap}
                currency={shop?.currency ?? "UZS"}
                onSetQty={setQty}
                onCheckout={() => nav({ kind: "checkout" })}
                onBack={() => setTab("home")}
              />
            )}
            {current.kind === "tab" && current.tab === "favorites" && (
              <FavoritesPage
                products={products.filter((p) => favoriteIds.has(p.id))}
                cart={cartMap}
                currency={shop?.currency ?? "UZS"}
                onProduct={handleProduct}
                onAddCart={(id) => addToCart(id, 1)}
                onSetQty={setQty}
                onToggleFavorite={toggleFavorite}
              />
            )}
            {current.kind === "tab" && current.tab === "profile" && (
              <ProfileTab user={user} shop={shop} favoriteCount={favoriteIds.size} loadOrders={loadOrders} orders={orders} />
            )}
            {current.kind === "product" && (
              <NewProductPage
                product={productMap.get(current.productId) ?? null}
                inCart={cartMap.get(current.productId) ?? 0}
                currency={shop?.currency ?? "UZS"}
                onAdd={() => addToCart(current.productId, 1)}
                onSetQty={(q) => setQty(current.productId, q)}
                onToggleFavorite={() => toggleFavorite(current.productId)}
                onBack={pop}
              />
            )}
            {current.kind === "checkout" && (
              <NewCheckoutPage
                items={cart}
                productMap={productMap}
                currency={shop?.currency ?? "UZS"}
                total={cartTotal}
                onSubmit={placeOrder}
                onBack={pop}
              />
            )}
            {current.kind === "success" && (
              <SuccessScreen
                orderNumber={current.orderNumber}
                total={current.total}
                currency={shop?.currency ?? "UZS"}
                onDone={() => reset({ kind: "tab", tab: "home" })}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation - faqat tablar va product page'da ko'rsatamiz, checkout/success'da emas */}
      {current.kind !== "checkout" && current.kind !== "success" && (
        <BottomNav
          active={activeTab}
          cartCount={cartCount}
          favoriteCount={favoriteIds.size}
          onChange={setTab}
        />
      )}
    </div>
  );
}

function ProfileTab({ user, shop, favoriteCount, loadOrders, orders }: {
  user: { firstName: string | null; username: string | null } | null;
  shop: ShopInfo | null;
  favoriteCount: number;
  loadOrders: () => Promise<void>;
  orders: OrderSummary[];
}) {
  useEffect(() => { void loadOrders(); }, []);
  return <ProfilePage user={user} shop={shop} orders={orders} favoriteCount={favoriteCount} />;
}

function SuccessScreen({ orderNumber, total, currency, onDone }: { orderNumber: string; total: number; currency: string; onDone: () => void }) {
  const formatted = new Intl.NumberFormat("uz-UZ").format(total);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-gray-50">
      <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
        <span className="text-5xl">✅</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Buyurtma qabul qilindi!</h2>
      <p className="text-sm text-gray-500 mb-1">Raqam: <span className="text-gray-900 font-mono font-medium">{orderNumber}</span></p>
      <p className="text-sm text-gray-500 mb-8">Jami: <span className="text-violet-600 font-bold">{formatted} {currency === "UZS" ? "so'm" : currency}</span></p>
      <p className="text-xs text-gray-500 mb-6 max-w-xs">Tez orada operator bog'lanadi. Bot orqali holat o'zgarishi haqida xabar olasiz.</p>
      <button onClick={onDone} className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-3 rounded-xl w-full max-w-xs">
        Bosh sahifaga qaytish
      </button>
    </div>
  );
}
