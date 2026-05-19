import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  QrCode,
  ShoppingBag,
  Zap,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  CreditCard,
  Settings,
  ChevronLeft,
  Plus,
  Minus,
  Star,
  Search,
  ShoppingCart,
  Heart,
  Send,
  Bot,
  Phone,
  Home,
  Grid3X3,
  BarChart3,
  Package,
  Ban,
  CheckCheck,
  LayoutTemplate,
} from "lucide-react";
import UIBuilderPage from "./UIBuilderPage";
import {
  platformProducts,
  platformOrders,
  platformStats,
  telegramSettings,
  websiteSettings,
  qrSettings,
  platformDailyStats,
  platformRevenueDaily,
} from "../data/platformsData";
import type { PlatformProduct, PlatformSetting } from "../data/platformsData";
import type { ChartTooltipProps } from "../utils/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

type PlatformTab = "overview" | "telegram" | "website" | "qr" | "builder";
type TelegramScreen = "welcome" | "auth" | "home" | "catalog" | "product" | "cart" | "location" | "payment" | "success";
type WebsiteScreen = "home" | "product" | "cart" | "checkout";
type QrScreen = "scan" | "catalog" | "product" | "order";

const categories = ["Barcha", "Telefonlar", "Noutbuklar", "Kiyim", "Oziq-ovqat", "Maishiy", "Sport", "Kitoblar", "O'yinchoqlar", "Aksessuarlar"];

const orderStatusConfig: Record<string, { color: string; bg: string; label: string; icon: React.ElementType }> = {
  new: { color: "text-blue-400", bg: "bg-blue-500/10", label: "Yangi", icon: Clock },
  processing: { color: "text-amber-400", bg: "bg-amber-500/10", label: "Jarayonda", icon: Zap },
  shipped: { color: "text-violet-400", bg: "bg-violet-500/10", label: "Yuborildi", icon: Truck },
  delivered: { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Yetkazildi", icon: CheckCheck },
  cancelled: { color: "text-red-400", bg: "bg-red-500/10", label: "Bekor", icon: Ban },
};

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-white font-medium">{label}</p>
        {payload.map((p) => (
          <p key={p.dataKey ?? p.name} className="text-xs" style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
}

export default function PlatformsPage() {
  const [activeTab, setActiveTab] = useState<PlatformTab>("overview");
  const [tgScreen, setTgScreen] = useState<TelegramScreen>("welcome");
  const [webScreen, setWebScreen] = useState<WebsiteScreen>("home");
  const [qrScreen, setQrScreen] = useState<QrScreen>("scan");
  const [tgCart, setTgCart] = useState<{ product: PlatformProduct; qty: number }[]>([]);
  const [webCart, setWebCart] = useState<{ product: PlatformProduct; qty: number }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<PlatformProduct | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Barcha");
  const [searchQuery, setSearchQuery] = useState("");
  const filteredProducts = useMemo(() => {
    let result = [...platformProducts];
    if (selectedCategory !== "Barcha") result = result.filter((p) => p.category === selectedCategory);
    if (searchQuery) result = result.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return result;
  }, [selectedCategory, searchQuery]);

  const addToTgCart = (product: PlatformProduct) => {
    setTgCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { product, qty: 1 }];
    });
  };

  const addToWebCart = (product: PlatformProduct) => {
    setWebCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) return prev.map((i) => (i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { product, qty: 1 }];
    });
  };

  const tgTotal = tgCart.reduce((s, i) => s + i.product.price * i.qty, 0);
  const webTotal = webCart.reduce((s, i) => s + i.product.price * i.qty, 0);

  const renderSetting = (setting: PlatformSetting) => {
    return (
      <div key={setting.key} className="flex items-center justify-between py-3 border-b border-slate-800/50 last:border-0">
        <div>
          <p className="text-sm text-white">{setting.label}</p>
          {setting.type === "text" && <p className="text-xs text-slate-500 mt-0.5">{String(setting.value)}</p>}
        </div>
        {setting.type === "toggle" && (
          <button className={`relative w-10 h-5 rounded-full transition-all ${setting.value ? "bg-emerald-500" : "bg-slate-700"}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${setting.value ? "left-5" : "left-0.5"}`} />
          </button>
        )}
        {setting.type === "number" && (
          <input type="number" defaultValue={setting.value as number} className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-emerald-500/50" />
        )}
        {setting.type === "text" && (
          <input defaultValue={setting.value as string} className="w-48 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500/50" />
        )}
        {setting.type === "select" && (
          <select defaultValue={setting.value as string} className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500/50">
            {setting.options?.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
        )}
      </div>
    );
  };

  // TELEGRAM WEB APP PREVIEW
  const renderTelegramPreview = () => {
    const screenBg = "bg-[#0f1419]";
    const cardBg = "bg-[#1a2332]";
    const textPrimary = "text-white";
    const textSecondary = "text-[#8b9bb4]";
    const btnBg = "bg-[#5288c1]";

    return (
      <div className={`w-[320px] h-[580px] ${screenBg} rounded-3xl border-4 border-slate-700 overflow-hidden flex flex-col relative shadow-2xl mx-auto`}>
        {/* Status Bar */}
        <div className="h-6 flex items-center justify-between px-4 text-[10px] text-slate-400">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border border-slate-500" />
            <div className="w-3 h-3 rounded-full border border-slate-500" />
          </div>
        </div>

        {/* Header */}
        <div className="h-10 flex items-center px-3 border-b border-slate-800/50">
          {tgScreen !== "welcome" && tgScreen !== "success" && (
            <button onClick={() => {
              if (tgScreen === "auth") setTgScreen("welcome");
              else if (tgScreen === "home") setTgScreen("welcome");
              else if (tgScreen === "catalog") setTgScreen("home");
              else if (tgScreen === "product") setTgScreen("catalog");
              else if (tgScreen === "cart") setTgScreen(tgCart.length > 0 ? "catalog" : "home");
              else if (tgScreen === "location") setTgScreen("cart");
              else if (tgScreen === "payment") setTgScreen("location");
            }} className="p-1 text-slate-400">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <span className={`text-sm font-semibold ${textPrimary} flex-1 text-center ${tgScreen === "welcome" || tgScreen === "success" ? "" : "-ml-6"}`}>
            {tgScreen === "welcome" && "ShopFlow"}
            {tgScreen === "auth" && "Telefon"}
            {tgScreen === "home" && "Asosiy"}
            {tgScreen === "catalog" && "Katalog"}
            {tgScreen === "product" && selectedProduct?.name.slice(0, 20) + "..."}
            {tgScreen === "cart" && `Savat (${tgCart.length})`}
            {tgScreen === "location" && "Manzil"}
            {tgScreen === "payment" && "To'lov"}
            {tgScreen === "success" && "Buyurtma"}
          </span>
          {(tgScreen === "catalog" || tgScreen === "home") && (
            <button onClick={() => setTgScreen("cart")} className="relative p-1 text-slate-400">
              <ShoppingCart className="w-5 h-5" />
              {tgCart.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center">{tgCart.reduce((s, i) => s + i.qty, 0)}</span>
              )}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* WELCOME */}
          {tgScreen === "welcome" && (
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
                <Bot className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className={`text-xl font-bold ${textPrimary} mb-2`}>ShopFlow Bot</h2>
              <p className={`text-xs ${textSecondary} text-center mb-6`}>Internet do'konimizga xush kelibsiz! Mahsulotlarni ko'rish va buyurtma berish uchun davom eting.</p>
              <button onClick={() => setTgScreen("auth")} className={`w-full ${btnBg} text-white py-3 rounded-xl text-sm font-medium mb-3`}>Davom etish</button>
              <button onClick={() => setTgScreen("home")} className={`w-full ${cardBg} ${textSecondary} py-3 rounded-xl text-sm`}>Mehmon sifatida</button>
            </div>
          )}

          {/* AUTH */}
          {tgScreen === "auth" && (
            <div className="p-4">
              <p className={`text-sm ${textSecondary} mb-4`}>Telefon raqamingizni tasdiqlang</p>
              <div className={`${cardBg} rounded-xl p-3 mb-3 flex items-center gap-2`}>
                <Phone className="w-4 h-4 text-slate-500" />
                <span className={`text-sm ${textPrimary}`}>+998</span>
                <input className="bg-transparent text-sm text-white flex-1 outline-none" placeholder="90 123 45 67" />
              </div>
              <button onClick={() => setTgScreen("home")} className={`w-full ${btnBg} text-white py-3 rounded-xl text-sm font-medium`}>Kod yuborish</button>
            </div>
          )}

          {/* HOME */}
          {tgScreen === "home" && (
            <div className="p-3 space-y-3">
              <div className={`${cardBg} rounded-xl p-3`}>
                <p className={`text-xs ${textSecondary} mb-1`}>Xush kelibsiz!</p>
                <p className={`text-sm ${textPrimary} font-medium`}>Yangi mahsulotlarni ko'ring</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {categories.slice(1, 5).map((cat) => (
                  <button key={cat} onClick={() => { setSelectedCategory(cat); setTgScreen("catalog"); }} className={`${cardBg} rounded-xl p-3 text-left`}>
                    <Grid3X3 className="w-5 h-5 text-emerald-400 mb-1" />
                    <p className={`text-xs ${textPrimary}`}>{cat}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => { setSelectedCategory("Barcha"); setTgScreen("catalog"); }} className={`w-full ${btnBg} text-white py-3 rounded-xl text-sm font-medium`}>Barcha mahsulotlar</button>
            </div>
          )}

          {/* CATALOG */}
          {tgScreen === "catalog" && (
            <div className="p-3">
              <div className={`${cardBg} rounded-xl p-2 mb-3 flex items-center gap-2`}>
                <Search className="w-4 h-4 text-slate-500" />
                <input className="bg-transparent text-xs text-white flex-1 outline-none" placeholder="Qidirish..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-2.5 py-1 rounded-lg text-[10px] whitespace-nowrap ${selectedCategory === cat ? "bg-emerald-500 text-white" : `${cardBg} ${textSecondary}`}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {filteredProducts.map((p) => (
                  <button key={p.id} onClick={() => { setSelectedProduct(p); setTgScreen("product"); }} className={`${cardBg} rounded-xl p-2 text-left`}>
                    <div className="w-full h-20 bg-slate-800 rounded-lg flex items-center justify-center mb-2">
                      <Package className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className={`text-[10px] ${textPrimary} truncate`}>{p.name}</p>
                    <p className="text-[10px] text-emerald-400 font-bold">{p.price.toLocaleString()}</p>
                    {p.oldPrice && <p className="text-[9px] text-slate-500 line-through">{p.oldPrice.toLocaleString()}</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PRODUCT */}
          {tgScreen === "product" && selectedProduct && (
            <div className="p-3">
              <div className="w-full h-40 bg-slate-800 rounded-xl flex items-center justify-center mb-3">
                <Package className="w-16 h-16 text-slate-600" />
              </div>
              <h3 className={`text-base font-bold ${textPrimary}`}>{selectedProduct.name}</h3>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-xs text-slate-400">{selectedProduct.rating} ({selectedProduct.reviews})</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <span className="text-lg font-bold text-emerald-400">{selectedProduct.price.toLocaleString()} so'm</span>
                {selectedProduct.oldPrice && <span className="text-xs text-slate-500 line-through">{selectedProduct.oldPrice.toLocaleString()}</span>}
              </div>
              <p className={`text-xs ${textSecondary} mt-3`}>Mahsulot haqida: {selectedProduct.name} — sifatli va ishonchli. 1 yillik kafolat.</p>
              <button onClick={() => { addToTgCart(selectedProduct); }} className={`w-full ${btnBg} text-white py-3 rounded-xl text-sm font-medium mt-4`}>Savatga qo'shish</button>
            </div>
          )}

          {/* CART */}
          {tgScreen === "cart" && (
            <div className="p-3">
              {tgCart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48">
                  <ShoppingCart className="w-10 h-10 text-slate-700 mb-2" />
                  <p className={`text-xs ${textSecondary}`}>Savat bo'sh</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-3">
                    {tgCart.map((item) => (
                      <div key={item.product.id} className={`${cardBg} rounded-xl p-2.5 flex items-center gap-2`}>
                        <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[10px] ${textPrimary} truncate`}>{item.product.name}</p>
                          <p className="text-[10px] text-emerald-400">{(item.product.price * item.qty).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setTgCart((prev) => prev.map((i) => i.product.id === item.product.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i))} className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-slate-400"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs text-white w-4 text-center">{item.qty}</span>
                          <button onClick={() => setTgCart((prev) => prev.map((i) => i.product.id === item.product.id ? { ...i, qty: i.qty + 1 } : i))} className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-slate-400"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`${cardBg} rounded-xl p-3 mb-3`}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={textSecondary}>Mahsulotlar</span>
                      <span className={textPrimary}>{tgTotal.toLocaleString()} so'm</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={textSecondary}>Yetkazib berish</span>
                      <span className={textPrimary}>30,000 so'm</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-slate-800">
                      <span className={textPrimary}>Jami</span>
                      <span className="text-emerald-400">{(tgTotal + 30000).toLocaleString()} so'm</span>
                    </div>
                  </div>
                  <button onClick={() => setTgScreen("location")} className={`w-full ${btnBg} text-white py-3 rounded-xl text-sm font-medium`}>Buyurtma berish</button>
                </>
              )}
            </div>
          )}

          {/* LOCATION */}
          {tgScreen === "location" && (
            <div className="p-4">
              <p className={`text-sm ${textSecondary} mb-3`}>Yetkazib berish manzilini tanlang</p>
              <button className={`w-full ${cardBg} rounded-xl p-3 mb-2 flex items-center gap-3 text-left`}>
                <MapPin className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className={`text-xs ${textPrimary} font-medium`}>Joriy joylashuv</p>
                  <p className={`text-[10px] ${textSecondary}`}>GPS orqali aniqlash</p>
                </div>
              </button>
              <div className={`${cardBg} rounded-xl p-3 mb-3`}>
                <p className={`text-xs ${textSecondary} mb-1`}>Yoki manzilni yozing</p>
                <textarea className="w-full bg-transparent text-xs text-white outline-none resize-none" rows={3} placeholder="Shahar, ko'cha, uy..." defaultValue="Toshkent, Yakkasaroy tumani, Shota Rustaveli 45" />
              </div>
              <button onClick={() => setTgScreen("payment")} className={`w-full ${btnBg} text-white py-3 rounded-xl text-sm font-medium`}>Davom etish</button>
            </div>
          )}

          {/* PAYMENT */}
          {tgScreen === "payment" && (
            <div className="p-4">
              <p className={`text-sm ${textSecondary} mb-3`}>To'lov usulini tanlang</p>
              <div className="space-y-2 mb-4">
                {["Click", "Payme", "Uzum", "Naqd pul"].map((method) => (
                  <button key={method} className={`w-full ${cardBg} rounded-xl p-3 flex items-center gap-3 text-left`}>
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                    <span className={`text-sm ${textPrimary}`}>{method}</span>
                  </button>
                ))}
              </div>
              <div className={`${cardBg} rounded-xl p-3 mb-4`}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={textSecondary}>Buyurtma</span>
                  <span className={textPrimary}>{tgTotal.toLocaleString()} so'm</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className={textSecondary}>Yetkazib berish</span>
                  <span className={textPrimary}>30,000 so'm</span>
                </div>
                <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-slate-800">
                  <span className={textPrimary}>Jami</span>
                  <span className="text-emerald-400">{(tgTotal + 30000).toLocaleString()} so'm</span>
                </div>
              </div>
              <button onClick={() => { setTgScreen("success"); setTgCart([]); }} className={`w-full ${btnBg} text-white py-3 rounded-xl text-sm font-medium`}>To'lash</button>
            </div>
          )}

          {/* SUCCESS */}
          {tgScreen === "success" && (
            <div className="flex flex-col items-center justify-center h-full px-6">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className={`text-lg font-bold ${textPrimary} mb-2`}>Buyurtma qabul qilindi!</h2>
              <p className={`text-xs ${textSecondary} text-center mb-6`}>Buyurtma raqami: #TGB-009. Tez orada operatorimiz siz bilan bog'lanadi.</p>
              <button onClick={() => setTgScreen("home")} className={`w-full ${btnBg} text-white py-3 rounded-xl text-sm font-medium`}>Asosiy sahifa</button>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        {tgScreen !== "welcome" && tgScreen !== "auth" && tgScreen !== "success" && (
          <div className="h-12 border-t border-slate-800/50 flex items-center justify-around">
            <button onClick={() => setTgScreen("home")} className={`flex flex-col items-center gap-0.5 ${tgScreen === "home" ? "text-emerald-400" : "text-slate-500"}`}>
              <Home className="w-4 h-4" />
              <span className="text-[8px]">Asosiy</span>
            </button>
            <button onClick={() => { setSelectedCategory("Barcha"); setTgScreen("catalog"); }} className={`flex flex-col items-center gap-0.5 ${tgScreen === "catalog" || tgScreen === "product" ? "text-emerald-400" : "text-slate-500"}`}>
              <Grid3X3 className="w-4 h-4" />
              <span className="text-[8px]">Katalog</span>
            </button>
            <button onClick={() => setTgScreen("cart")} className={`flex flex-col items-center gap-0.5 ${tgScreen === "cart" || tgScreen === "location" || tgScreen === "payment" ? "text-emerald-400" : "text-slate-500"}`}>
              <ShoppingCart className="w-4 h-4" />
              <span className="text-[8px]">Savat</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  // WEBSITE PREVIEW
  const renderWebsitePreview = () => {
    return (
      <div className="w-full h-[580px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="h-12 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">ShopFlow</span>
          </div>
          <div className="flex-1 max-w-xs">
            <div className="bg-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input className="bg-transparent text-xs text-white outline-none w-full" placeholder="Qidirish..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-1.5 text-slate-400 hover:text-white">
              <Heart className="w-4 h-4" />
            </button>
            <button onClick={() => setWebScreen("cart")} className="relative p-1.5 text-slate-400 hover:text-white">
              <ShoppingCart className="w-4 h-4" />
              {webCart.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center">{webCart.reduce((s, i) => s + i.qty, 0)}</span>}
            </button>
            <button className="w-7 h-7 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 text-xs font-bold">JD</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {webScreen === "home" && (
            <div>
              {/* Hero */}
              <div className="h-32 bg-emerald-500/10 flex items-center px-6">
                <div>
                  <p className="text-xs text-emerald-400 mb-1">Yangi kelganlar</p>
                  <h2 className="text-lg font-bold text-white">iPhone 15 Pro Max</h2>
                  <p className="text-xs text-slate-400 mt-1">14,500,000 so'mdan boshlab</p>
                  <button onClick={() => { setSelectedProduct(platformProducts[0]); setWebScreen("product"); }} className="mt-2 px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-lg">Batafsil</button>
                </div>
              </div>
              {/* Categories */}
              <div className="px-4 py-3">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {categories.slice(1).map((cat) => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${selectedCategory === cat ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"}`}>{cat}</button>
                  ))}
                </div>
              </div>
              {/* Products */}
              <div className="px-4 pb-4 grid grid-cols-3 gap-3">
                {filteredProducts.slice(0, 6).map((p) => (
                  <button key={p.id} onClick={() => { setSelectedProduct(p); setWebScreen("product"); }} className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-left hover:border-slate-600 transition-colors">
                    <div className="w-full h-20 bg-slate-800 rounded-lg flex items-center justify-center mb-2">
                      <Package className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-[10px] text-white truncate">{p.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                      <span className="text-[9px] text-slate-500">{p.rating}</span>
                    </div>
                    <p className="text-[10px] text-emerald-400 font-bold mt-0.5">{p.price.toLocaleString()}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {webScreen === "product" && selectedProduct && (
            <div className="p-4">
              <button onClick={() => setWebScreen("home")} className="flex items-center gap-1 text-xs text-slate-400 mb-3"><ChevronLeft className="w-4 h-4" /> Orqaga</button>
              <div className="w-full h-48 bg-slate-800 rounded-xl flex items-center justify-center mb-4">
                <Package className="w-20 h-20 text-slate-600" />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedProduct.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map((s) => (<Star key={s} className={`w-3 h-3 ${s <= Math.floor(selectedProduct.rating) ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />))}
                    </div>
                    <span className="text-xs text-slate-500">{selectedProduct.reviews} sharh</span>
                  </div>
                </div>
                <button className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400"><Heart className="w-4 h-4" /></button>
              </div>
              <div className="flex items-end gap-3 mt-3">
                <span className="text-2xl font-bold text-emerald-400">{selectedProduct.price.toLocaleString()} so'm</span>
                {selectedProduct.oldPrice && <span className="text-sm text-slate-500 line-through">{selectedProduct.oldPrice.toLocaleString()}</span>}
              </div>
              {selectedProduct.badge && <span className="inline-block mt-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full border border-emerald-500/20">{selectedProduct.badge}</span>}
              <p className="text-xs text-slate-400 mt-4 leading-relaxed">{selectedProduct.name} — eng sifatli mahsulot. 1 yillik kafolat, bepul yetkazib berish, qaytarish kafolati.</p>
              <button onClick={() => { addToWebCart(selectedProduct); }} className="w-full mt-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors">Savatga qo'shish</button>
            </div>
          )}

          {webScreen === "cart" && (
            <div className="p-4">
              <h2 className="text-lg font-bold text-white mb-4">Savat</h2>
              {webCart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Savat bo'sh</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    {webCart.map((item) => (
                      <div key={item.product.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-14 h-14 bg-slate-800 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{item.product.name}</p>
                          <p className="text-xs text-emerald-400">{item.product.price.toLocaleString()} so'm</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setWebCart((prev) => prev.map((i) => i.product.id === item.product.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i))} className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400"><Minus className="w-3 h-3" /></button>
                          <span className="text-xs text-white w-4 text-center">{item.qty}</span>
                          <button onClick={() => setWebCart((prev) => prev.map((i) => i.product.id === item.product.id ? { ...i, qty: i.qty + 1 } : i))} className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400"><Plus className="w-3 h-3" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-400">Mahsulotlar</span>
                      <span className="text-white">{webTotal.toLocaleString()} so'm</span>
                    </div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-400">Yetkazib berish</span>
                      <span className="text-white">30,000 so'm</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold mt-3 pt-3 border-t border-slate-800">
                      <span className="text-white">Jami</span>
                      <span className="text-emerald-400">{(webTotal + 30000).toLocaleString()} so'm</span>
                    </div>
                  </div>
                  <button onClick={() => setWebScreen("checkout")} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors">Buyurtma berish</button>
                </>
              )}
            </div>
          )}

          {webScreen === "checkout" && (
            <div className="p-4">
              <h2 className="text-lg font-bold text-white mb-4">Buyurtma berish</h2>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Ism</label>
                  <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50" placeholder="Ismingiz" defaultValue="Azizbek" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Telefon</label>
                  <input className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50" placeholder="+998 90 123 45 67" defaultValue="+998 90 123 45 67" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Manzil</label>
                  <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/50 resize-none" rows={2} placeholder="Manzil" defaultValue="Toshkent, Yakkasaroy, Shota Rustaveli 45" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">To'lov usuli</label>
                  <div className="grid grid-cols-2 gap-2">
                    {["Click", "Payme", "Uzum", "Naqd"].map((m) => (
                      <button key={m} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white text-center hover:border-emerald-500/50 transition-colors">{m}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-white">Jami</span>
                  <span className="text-emerald-400">{(webTotal + 30000).toLocaleString()} so'm</span>
                </div>
              </div>
              <button onClick={() => { setWebScreen("home"); setWebCart([]); }} className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors">Buyurtma tasdiqlash</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // QR CATALOG PREVIEW
  const renderQrPreview = () => {
    return (
      <div className="w-[320px] h-[580px] bg-white rounded-3xl border-4 border-slate-700 overflow-hidden flex flex-col relative shadow-2xl mx-auto">
        {qrScreen === "scan" && (
          <div className="flex flex-col items-center justify-center h-full p-6 bg-slate-50">
            <div className="w-48 h-48 bg-white rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center mb-6">
              <QrCode className="w-24 h-24 text-slate-800" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">ShopFlow Katalog</h2>
            <p className="text-xs text-slate-500 text-center mb-6">QR kodni skanerlang yoki pastdagi tugmani bosing</p>
            <button onClick={() => setQrScreen("catalog")} className="w-full py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium">Katalogni ko'rish</button>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <Phone className="w-3 h-3" />
              <span>Buyurtma uchun: +998 90 123 45 67</span>
            </div>
          </div>
        )}

        {qrScreen === "catalog" && (
          <div className="flex flex-col h-full">
            <div className="h-14 bg-emerald-500 flex items-center px-4">
              <button onClick={() => setQrScreen("scan")} className="text-white"><ChevronLeft className="w-5 h-5" /></button>
              <span className="text-white font-semibold flex-1 text-center -ml-5">Katalog</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 bg-slate-50">
              <div className="space-y-2">
                {platformProducts.slice(0, 8).map((p) => (
                  <button key={p.id} onClick={() => { setSelectedProduct(p); setQrScreen("product"); }} className="w-full bg-white rounded-xl p-3 flex items-center gap-3 text-left shadow-sm">
                    <div className="w-14 h-14 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-800 font-medium truncate">{p.name}</p>
                      <p className="text-xs text-emerald-600 font-bold">{p.price.toLocaleString()} so'm</p>
                      {p.oldPrice && <p className="text-[10px] text-slate-400 line-through">{p.oldPrice.toLocaleString()}</p>}
                    </div>
                    {p.badge && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] rounded-full">{p.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {qrScreen === "product" && selectedProduct && (
          <div className="flex flex-col h-full bg-slate-50">
            <div className="h-14 bg-emerald-500 flex items-center px-4">
              <button onClick={() => setQrScreen("catalog")} className="text-white"><ChevronLeft className="w-5 h-5" /></button>
              <span className="text-white font-semibold flex-1 text-center -ml-5">Mahsulot</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="w-full h-40 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm">
                <Package className="w-16 h-16 text-slate-300" />
              </div>
              <h2 className="text-base font-bold text-slate-800">{selectedProduct.name}</h2>
              <p className="text-lg text-emerald-600 font-bold mt-1">{selectedProduct.price.toLocaleString()} so'm</p>
              {selectedProduct.oldPrice && <p className="text-sm text-slate-400 line-through">{selectedProduct.oldPrice.toLocaleString()}</p>}
              <p className="text-xs text-slate-500 mt-3">Sifatli mahsulot. 1 yillik kafolat. Tez yetkazib berish.</p>
              <button onClick={() => setQrScreen("order")} className="w-full mt-4 py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium">Buyurtma berish</button>
            </div>
          </div>
        )}

        {qrScreen === "order" && selectedProduct && (
          <div className="flex flex-col h-full bg-slate-50">
            <div className="h-14 bg-emerald-500 flex items-center px-4">
              <button onClick={() => setQrScreen("product")} className="text-white"><ChevronLeft className="w-5 h-5" /></button>
              <span className="text-white font-semibold flex-1 text-center -ml-5">Tezkor buyurtma</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                <p className="text-xs text-slate-500">Mahsulot</p>
                <p className="text-sm font-medium text-slate-800">{selectedProduct.name}</p>
                <p className="text-sm text-emerald-600 font-bold">{selectedProduct.price.toLocaleString()} so'm</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Ism</label>
                  <input className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none" placeholder="Ismingiz" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Telefon</label>
                  <input className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none" placeholder="+998 90 123 45 67" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Manzil</label>
                  <textarea className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 outline-none resize-none" rows={2} placeholder="Manzil" />
                </div>
              </div>
              <button onClick={() => setQrScreen("scan")} className="w-full mt-4 py-3 bg-emerald-500 text-white rounded-xl text-sm font-medium">Buyurtma yuborish</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Platformalar</h1>
          <p className="text-sm text-slate-500 mt-1">Telegram Bot, Web-sayt va QR Katalog boshqaruvi</p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {platformStats.map((stat, index) => (
          <motion.div
            key={stat.platform}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              {stat.platform === "telegram" ? <Send className="w-5 h-5 text-blue-400" /> :
               stat.platform === "website" ? <Globe className="w-5 h-5 text-emerald-400" /> :
               <QrCode className="w-5 h-5 text-amber-400" />}
              <span className="text-sm font-semibold text-white">
                {stat.platform === "telegram" ? "Telegram Bot" : stat.platform === "website" ? "Web-sayt" : "QR Katalog"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Tashriflar</p>
                <p className="text-lg font-bold text-white">{stat.visitors.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Buyurtmalar</p>
                <p className="text-lg font-bold text-emerald-400">{stat.orders}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Daromad</p>
                <p className="text-lg font-bold text-white">{(stat.revenue / 1000000).toFixed(0)}M</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Konversiya</p>
                <p className="text-lg font-bold text-violet-400">{stat.conversionRate}%</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 mb-6">
        {[
          { key: "overview" as PlatformTab, label: "Umumiy analitika", icon: BarChart3 },
          { key: "telegram" as PlatformTab, label: "Telegram Bot", icon: Send },
          { key: "website" as PlatformTab, label: "Web-sayt", icon: Globe },
          { key: "qr" as PlatformTab, label: "QR Katalog", icon: QrCode },
          { key: "builder" as PlatformTab, label: "UI Builder", icon: LayoutTemplate },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-all ${
                activeTab === tab.key ? "text-emerald-400 border-b-2 border-emerald-400" : "text-slate-500 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Kunlik buyurtmalar</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platformDailyStats} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="telegram" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={16} />
                      <Bar dataKey="website" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={16} />
                      <Bar dataKey="qr" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Kunlik daromad</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={platformRevenueDaily} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="tgGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                        <linearGradient id="webGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.15} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                        <linearGradient id="qrGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `${v / 1000000}M`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="telegram" stroke="#3b82f6" strokeWidth={2} fill="url(#tgGrad)" dot={false} />
                      <Area type="monotone" dataKey="website" stroke="#10b981" strokeWidth={2} fill="url(#webGrad)" dot={false} />
                      <Area type="monotone" dataKey="qr" stroke="#f59e0b" strokeWidth={2} fill="url(#qrGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">So'nggi buyurtmalar</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/30">
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">ID</th>
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Mijoz</th>
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Platforma</th>
                      <th className="py-3 px-5 text-right text-xs text-slate-500 uppercase">Summa</th>
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Status</th>
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">To'lov</th>
                      <th className="py-3 px-5 text-left text-xs text-slate-500 uppercase">Sana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformOrders.map((order, i) => {
                      const os = orderStatusConfig[order.status];
                      const Icon = os.icon;
                      return (
                        <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="py-3 px-5 text-sm text-slate-400">{order.id}</td>
                          <td className="py-3 px-5">
                            <p className="text-sm text-white">{order.customer}</p>
                            <p className="text-xs text-slate-500">{order.phone}</p>
                          </td>
                          <td className="py-3 px-5">
                            <span className={`text-xs font-medium ${order.platform === "telegram" ? "text-blue-400" : order.platform === "website" ? "text-emerald-400" : "text-amber-400"}`}>
                              {order.platform === "telegram" ? "Telegram" : order.platform === "website" ? "Web" : "QR"}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-sm font-semibold text-emerald-400 text-right">{order.total.toLocaleString()}</td>
                          <td className="py-3 px-5">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${os.color}`}>
                              <Icon className="w-3 h-3" />
                              {os.label}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-sm text-slate-400">{order.paymentMethod}</td>
                          <td className="py-3 px-5 text-sm text-slate-400">{order.date}</td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* TELEGRAM */}
        {activeTab === "telegram" && (
          <motion.div key="telegram" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Telegram Bot Web App Preview</h3>
                  <button onClick={() => setTgScreen("welcome")} className="text-xs text-emerald-400 hover:text-emerald-300">Qayta yuklash</button>
                </div>
                {renderTelegramPreview()}
              </div>
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Settings className="w-4 h-4 text-slate-400" />
                      Sozlamalar
                    </h3>
                  </div>
                  <div className="space-y-1">
                    {telegramSettings.map((s) => renderSetting(s))}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Statistika</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Tashriflar</p>
                      <p className="text-lg font-bold text-white">2,340</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Buyurtmalar</p>
                      <p className="text-lg font-bold text-emerald-400">156</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Konversiya</p>
                      <p className="text-lg font-bold text-violet-400">6.7%</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">O'rtacha chek</p>
                      <p className="text-lg font-bold text-white">3.1M</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* WEBSITE */}
        {activeTab === "website" && (
          <motion.div key="website" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Web-sayt Preview</h3>
                  <button onClick={() => setWebScreen("home")} className="text-xs text-emerald-400 hover:text-emerald-300">Qayta yuklash</button>
                </div>
                {renderWebsitePreview()}
              </div>
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-400" />
                    Sozlamalar
                  </h3>
                  <div className="space-y-1">
                    {websiteSettings.map((s) => renderSetting(s))}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Statistika</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Tashriflar</p>
                      <p className="text-lg font-bold text-white">4,560</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Buyurtmalar</p>
                      <p className="text-lg font-bold text-emerald-400">289</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Konversiya</p>
                      <p className="text-lg font-bold text-violet-400">6.3%</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">O'rtacha chek</p>
                      <p className="text-lg font-bold text-white">3.1M</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* QR */}
        {activeTab === "qr" && (
          <motion.div key="qr" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">QR Katalog Preview</h3>
                  <button onClick={() => setQrScreen("scan")} className="text-xs text-emerald-400 hover:text-emerald-300">Qayta yuklash</button>
                </div>
                {renderQrPreview()}
              </div>
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-400" />
                    Sozlamalar
                  </h3>
                  <div className="space-y-1">
                    {qrSettings.map((s) => renderSetting(s))}
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Statistika</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Skanerlar</p>
                      <p className="text-lg font-bold text-white">890</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Buyurtmalar</p>
                      <p className="text-lg font-bold text-emerald-400">67</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">Konversiya</p>
                      <p className="text-lg font-bold text-violet-400">7.5%</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">O'rtacha chek</p>
                      <p className="text-lg font-bold text-white">2.3M</p>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">QR Kod</h3>
                  <div className="flex items-center justify-center">
                    <div className="w-40 h-40 bg-white rounded-xl flex items-center justify-center">
                      <QrCode className="w-28 h-28 text-slate-800" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 text-center mt-3">Bu QR kodni chop eting yoki onlayn tarzda ulashing</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* BUILDER */}
        {activeTab === "builder" && (
          <motion.div key="builder" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="h-[calc(100vh-280px)]">
            <UIBuilderPage />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
