import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Store,
  Radio,
  MessageSquare,
  Layers,
  CreditCard,
  Truck,
  Megaphone,
  Mail,
  Tag,
  Share2,
  Image as ImageIcon,
  Star,
  Send,
  Gift,
  Award,
  Trophy,
  ArrowLeftRight,
  Paintbrush,
  GitBranch,
  Plug,
  Activity,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MarketingSub } from "../data/marketingData";
import { marketingSubOrder, marketingSubLabels } from "../data/marketingData";

type Page =
  | "dashboard"
  | "orders"
  | "products"
  | "leads"
  | "customers"
  | "segments"
  | "chat"
  | "platforms"
  | "payments"
  | "delivery"
  | "uibuilder"
  | "marketing"
  | "analytics"
  | "settings"
  | "integrations"
  | "sync"
  | "storefront";

interface SidebarProps {
  currentPage: Page | string;
  onPageChange: (page: string) => void;
  marketingSub: MarketingSub;
  onMarketingNavigate: (sub: MarketingSub) => void;
}

const navItems: { icon: React.ElementType; label: string; page: Page }[] = [
  { icon: LayoutDashboard, label: "Dashboard", page: "dashboard" },
  { icon: ShoppingBag, label: "Orders", page: "orders" },
  { icon: Package, label: "Products", page: "products" },
  { icon: Radio, label: "Leads", page: "leads" },
  { icon: Users, label: "Customers", page: "customers" },
  { icon: GitBranch, label: "Segmentlar", page: "segments" },
  { icon: MessageSquare, label: "Chat", page: "chat" },
  { icon: Layers, label: "Platforms", page: "platforms" },
  { icon: CreditCard, label: "Payments", page: "payments" },
  { icon: Truck, label: "Delivery", page: "delivery" },
  { icon: Globe, label: "Onlayn do'kon", page: "storefront" },
  { icon: Paintbrush, label: "Vitrina", page: "uibuilder" },
  { icon: BarChart3, label: "Analytics", page: "analytics" },
  { icon: Plug, label: "Integratsiyalar", page: "integrations" },
  { icon: Activity, label: "Sync holati", page: "sync" },
  { icon: Settings, label: "Settings", page: "settings" },
];

const primaryNav = navItems.slice(0, 11); // ... Delivery, Onlayn do'kon
const tailNav = navItems.slice(11); // Vitrina, Analytics, Integratsiyalar, Sync, Settings

const marketingSubIcons: Record<MarketingSub, React.ElementType> = {
  rassilka: Mail,
  promokod: Tag,
  sovgalar: Gift,
  manbalar: Share2,
  sms: MessageSquare,
  kanal: Send,
  banner: ImageIcon,
  sharhlar: Star,
  sodiqlik: Award,
  giveaway: Trophy,
  tranzaksiyalar: ArrowLeftRight,
};

export default function Sidebar({ currentPage, onPageChange, marketingSub, onMarketingNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(true);
  const isMarketingActive = currentPage === "marketing";

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-800 z-50 flex flex-col"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-lg font-bold text-white whitespace-nowrap"
              >
                ShopFlow
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {primaryNav.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              type="button"
              onClick={() => onPageChange(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-emerald-400" : ""}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && !collapsed && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400"
                />
              )}
            </button>
          );
        })}

        {/* Marketing */}
        {collapsed ? (
          <button
            type="button"
            onClick={() => onMarketingNavigate(marketingSub)}
            className={`w-full flex items-center justify-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
              isMarketingActive
                ? "bg-emerald-500/10 text-emerald-400"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Marketing"
          >
            <Megaphone className={`w-5 h-5 flex-shrink-0 ${isMarketingActive ? "text-emerald-400" : ""}`} />
          </button>
        ) : (
          <div className="pt-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onMarketingNavigate(marketingSub)}
                className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
                  isMarketingActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Megaphone className={`w-5 h-5 flex-shrink-0 ${isMarketingActive ? "text-emerald-400" : ""}`} />
                <span className="text-sm font-medium whitespace-nowrap">Marketing</span>
                {isMarketingActive && (
                  <motion.div layoutId="activeIndicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMarketingOpen(!marketingOpen)}
                className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800"
                aria-expanded={marketingOpen}
                aria-label={marketingOpen ? "Marketing menyuni yig'ish" : "Marketing menyuni ochish"}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${marketingOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
            <AnimatePresence initial={false}>
              {marketingOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pl-2 ml-3 border-l border-slate-800 space-y-0.5 mt-1"
                >
                  {marketingSubOrder.map((sub) => {
                    const SubIcon = marketingSubIcons[sub];
                    const subActive = isMarketingActive && marketingSub === sub;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => onMarketingNavigate(sub)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all ${
                          subActive
                            ? "bg-emerald-500/10 text-emerald-400 font-medium"
                            : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/80"
                        }`}
                      >
                        <SubIcon className="w-4 h-4 flex-shrink-0 opacity-80" />
                        <span className="truncate">{marketingSubLabels[sub]}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {tailNav.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              type="button"
              onClick={() => onPageChange(item.page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-emerald-400" : ""}`} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && !collapsed && (
                <motion.div layoutId="activeIndicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-3 py-3 border-t border-slate-800">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
