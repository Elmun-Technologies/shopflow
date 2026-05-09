import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import { tg, getBotIdFromUrl } from "./lib/tg";
import { miniApi, setToken, type Category, type Product, type OrderSummary, type UISchemaShape } from "./lib/api";
import CatalogPage from "./pages/CatalogPage";
import ProductPage from "./pages/ProductPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrdersPage from "./pages/OrdersPage";

type Screen =
  | { kind: "catalog" }
  | { kind: "product"; productId: string }
  | { kind: "cart" }
  | { kind: "checkout" }
  | { kind: "orders" }
  | { kind: "success"; orderNumber: string; total: number };

export type CartItem = { productId: string; quantity: number };

interface ShopInfo { id: string; name: string; currency: string }

export default function MiniApp() {
  const [stack, setStack] = useState<Screen[]>([{ kind: "catalog" }]);
  const [authStatus, setAuthStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [uiSchema, setUiSchema] = useState<UISchemaShape | null>(null);

  const current = stack[stack.length - 1];
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

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
        } catch { /* cart bo'sh */ }
        setAuthStatus("ready");
      } catch (err) {
        setAuthStatus("error");
        setError(err instanceof Error ? err.message : "Ulanib bo'lmadi");
      }
    })();
  }, []);

  // Telegram BackButton stack bilan ulash
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
      miniApi.cart.save(next).catch(() => { /* offline mayli */ });
      return next;
    });
    tg.HapticFeedback.impactOccurred("light");
  }

  function setQty(productId: string, qty: number) {
    setCart((prev) => {
      const next = qty <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i));
      miniApi.cart.save(next).catch(() => { /* */ });
      return next;
    });
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

  if (authStatus === "loading") {
    return <FullScreen><Loader2 className="w-10 h-10 animate-spin text-emerald-400" /><p className="mt-4 text-slate-300 text-sm">Yuklanmoqda…</p></FullScreen>;
  }
  if (authStatus === "error") {
    return <FullScreen><AlertCircle className="w-10 h-10 text-red-400" /><p className="mt-4 text-slate-200 text-sm font-medium">Xatolik</p><p className="mt-2 text-slate-500 text-xs text-center max-w-xs">{error}</p></FullScreen>;
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => {
    const p = productMap.get(i.productId);
    return p ? s + p.price * i.quantity : s;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-md mx-auto pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.kind + (current.kind === "product" ? current.productId : "")}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.18 }}
          >
            {current.kind === "catalog" && (
              <CatalogPage
                shop={shop}
                categories={categories}
                products={products}
                cartCount={cartCount}
                uiSchema={uiSchema}
                onProduct={(id) => nav({ kind: "product", productId: id })}
                onCart={() => nav({ kind: "cart" })}
                onOrders={() => { void loadOrders(); nav({ kind: "orders" }); }}
              />
            )}
            {current.kind === "product" && (
              <ProductPage
                product={productMap.get(current.productId) ?? null}
                inCart={cart.find((i) => i.productId === current.productId)?.quantity ?? 0}
                currency={shop?.currency ?? "UZS"}
                onAdd={() => addToCart(current.productId, 1)}
                onSetQty={(q) => setQty(current.productId, q)}
                onBack={pop}
              />
            )}
            {current.kind === "cart" && (
              <CartPage
                items={cart}
                productMap={productMap}
                currency={shop?.currency ?? "UZS"}
                onSetQty={setQty}
                onCheckout={() => nav({ kind: "checkout" })}
                onBack={pop}
              />
            )}
            {current.kind === "checkout" && (
              <CheckoutPage
                items={cart}
                productMap={productMap}
                currency={shop?.currency ?? "UZS"}
                total={cartTotal}
                onSubmit={placeOrder}
                onBack={pop}
              />
            )}
            {current.kind === "success" && (
              <SuccessScreen orderNumber={current.orderNumber} total={current.total} currency={shop?.currency ?? "UZS"} onDone={() => reset({ kind: "catalog" })} />
            )}
            {current.kind === "orders" && (
              <OrdersPage orders={orders} currency={shop?.currency ?? "UZS"} onBack={pop} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">{children}</div>;
}

function SuccessScreen({ orderNumber, total, currency, onDone }: { orderNumber: string; total: number; currency: string; onDone: () => void }) {
  const formatted = new Intl.NumberFormat("uz-UZ").format(total);
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
        <span className="text-4xl">✅</span>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Buyurtma qabul qilindi!</h2>
      <p className="text-sm text-slate-400 mb-1">Raqam: <span className="text-white font-mono">{orderNumber}</span></p>
      <p className="text-sm text-slate-400 mb-8">Jami: <span className="text-white font-semibold">{formatted} {currency === "UZS" ? "so'm" : currency}</span></p>
      <button onClick={onDone} className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-3 rounded-lg w-full max-w-xs">
        Bosh sahifaga qaytish
      </button>
    </div>
  );
}
