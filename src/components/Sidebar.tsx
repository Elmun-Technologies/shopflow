import { useEffect, useState } from "react";
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
  Paintbrush,
  GitBranch,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MarketingSub } from "../data/marketingData";
import { marketingSubOrder, marketingSubLabels } from "../data/marketingData";
import { useAuth } from "../contexts/AuthContext";

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
  | "settings";

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
  marketingSub: MarketingSub;
  onMarketingNavigate: (sub: MarketingSub) => void;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  page: Page;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

// Guruhlar — qisqa, mantiqiy
const navGroups: NavGroup[] = [
  {
    id: "main",
    label: "Asosiy",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", page: "dashboard" },
      { icon: BarChart3, label: "Tahlil", page: "analytics" },
    ],
  },
  {
    id: "sales",
    label: "Savdo",
    items: [
      { icon: ShoppingBag, label: "Buyurtmalar", page: "orders" },
      { icon: Package, label: "Mahsulotlar", page: "products" },
      { icon: CreditCard, label: "To'lovlar", page: "payments" },
      { icon: Truck, label: "Yetkazib berish", page: "delivery" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      { icon: Radio, label: "Lidlar", page: "leads" },
      { icon: Users, label: "Mijozlar", page: "customers" },
      { icon: GitBranch, label: "Segmentlar", page: "segments" },
      { icon: MessageSquare, label: "Chat", page: "chat" },
    ],
  },
  {
    id: "channels",
    label: "Kanallar",
    items: [
      { icon: Layers, label: "Platformalar", page: "platforms" },
      { icon: Paintbrush, label: "Vitrina", page: "uibuilder" },
    ],
  },
];

const settingsItem: NavItem = { icon: Settings, label: "Sozlamalar", page: "settings" };

const LS_KEY = "shopflow.sidebar.state";

interface SidebarState {
  collapsed: boolean;
  openGroups: Record<string, boolean>;
  marketingOpen: boolean;
}

function loadState(): SidebarState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    collapsed: false,
    openGroups: { main: true, sales: true, crm: true, channels: false },
    marketingOpen: false,
  };
}

export default function Sidebar({ currentPage, onPageChange, marketingSub, onMarketingNavigate }: SidebarProps) {
  const [state, setState] = useState<SidebarState>(loadState);
  const { user, tenant, logout } = useAuth();
  const collapsed = state.collapsed;
  const isMarketingActive = currentPage === "marketing";

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const toggleGroup = (id: string) =>
    setState((s) => ({ ...s, openGroups: { ...s.openGroups, [id]: !s.openGroups[id] } }));

  const initials = (user?.name ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
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
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="min-w-0"
              >
                <p className="text-sm font-bold text-white truncate">ShopFlow</p>
                <p className="text-[10px] text-slate-500 truncate">{tenant?.name ?? "—"}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group) => (
          <NavGroupBlock
            key={group.id}
            group={group}
            open={state.openGroups[group.id] ?? true}
            collapsed={collapsed}
            currentPage={currentPage}
            onToggle={() => toggleGroup(group.id)}
            onPageChange={onPageChange}
          />
        ))}

        {/* Marketing — submenu bilan alohida */}
        <MarketingBlock
          collapsed={collapsed}
          open={state.marketingOpen}
          active={isMarketingActive}
          marketingSub={marketingSub}
          onToggle={() => setState((s) => ({ ...s, marketingOpen: !s.marketingOpen }))}
          onNavigate={onMarketingNavigate}
        />
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-2 py-2 space-y-1">
        <SidebarItem
          icon={settingsItem.icon}
          label={settingsItem.label}
          active={currentPage === settingsItem.page}
          collapsed={collapsed}
          onClick={() => onPageChange(settingsItem.page)}
        />

        {/* User mini-card */}
        <div className="px-2 py-2 flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initials || "?"}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-medium text-white truncate">{user?.name ?? "—"}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.role ?? ""}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all flex-shrink-0"
            title="Chiqish"
            aria-label="Chiqish"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setState((s) => ({ ...s, collapsed: !s.collapsed }))}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          aria-label={collapsed ? "Sidebar'ni kengaytirish" : "Sidebar'ni yig'ish"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs font-medium">Yig'ish</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}

function NavGroupBlock({
  group,
  open,
  collapsed,
  currentPage,
  onToggle,
  onPageChange,
}: {
  group: NavGroup;
  open: boolean;
  collapsed: boolean;
  currentPage: Page;
  onToggle: () => void;
  onPageChange: (p: Page) => void;
}) {
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <SidebarItem
            key={item.page}
            icon={item.icon}
            label={item.label}
            active={currentPage === item.page}
            collapsed
            onClick={() => onPageChange(item.page)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
        aria-expanded={open}
      >
        <span>{group.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden space-y-0.5"
          >
            {group.items.map((item) => (
              <SidebarItem
                key={item.page}
                icon={item.icon}
                label={item.label}
                active={currentPage === item.page}
                collapsed={false}
                onClick={() => onPageChange(item.page)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MarketingBlock({
  collapsed,
  open,
  active,
  marketingSub,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  open: boolean;
  active: boolean;
  marketingSub: MarketingSub;
  onToggle: () => void;
  onNavigate: (sub: MarketingSub) => void;
}) {
  if (collapsed) {
    return (
      <SidebarItem
        icon={Megaphone}
        label="Marketing"
        active={active}
        collapsed
        onClick={() => onNavigate(marketingSub)}
      />
    );
  }
  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors"
        aria-expanded={open}
      >
        <span>Marketing</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden space-y-0.5"
          >
            <button
              type="button"
              onClick={() => onNavigate(marketingSub)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                active
                  ? "bg-emerald-500/10 text-emerald-400 font-medium"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <Megaphone className="w-4 h-4" />
              <span>Umumiy</span>
            </button>
            {marketingSubOrder.map((sub) => {
              const subActive = active && marketingSub === sub;
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => onNavigate(sub)}
                  className={`w-full flex items-center gap-2 pl-9 pr-3 py-1.5 rounded-lg text-left text-xs transition-all ${
                    subActive
                      ? "bg-emerald-500/10 text-emerald-400 font-medium"
                      : "text-slate-500 hover:text-slate-200 hover:bg-slate-800/80"
                  }`}
                >
                  <span className="truncate">{marketingSubLabels[sub]}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
        active ? "bg-emerald-500/10 text-emerald-400" : "text-slate-400 hover:text-white hover:bg-slate-800"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-emerald-400" : ""}`} />
      {!collapsed && <span className="text-sm font-medium truncate">{label}</span>}
      {active && !collapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
    </button>
  );
}
