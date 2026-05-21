import { useEffect, useMemo, useState } from "react";
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
  Search as SearchIcon,
  Command as CommandIcon,
  X as XIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MarketingSub } from "../data/marketingData";
import { marketingSubOrder, marketingSubLabels } from "../data/marketingData";
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "./ui/ConfirmDialog";
import { api } from "../api/client";

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
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

type BadgeKey = "orders" | "leads" | "chat" | "abandonedCarts";

interface NavItem {
  icon: React.ElementType;
  label: string;
  page: Page;
  badgeKey?: BadgeKey;
}

interface SidebarCounts {
  orders: number;
  leads: number;
  chat: number;
  conversationsActive: number;
  abandonedCarts: number;
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
      { icon: ShoppingBag, label: "Buyurtmalar", page: "orders", badgeKey: "orders" },
      { icon: Package, label: "Mahsulotlar", page: "products" },
      { icon: CreditCard, label: "To'lovlar", page: "payments" },
      { icon: Truck, label: "Yetkazib berish", page: "delivery" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    items: [
      { icon: Radio, label: "Lidlar", page: "leads", badgeKey: "leads" },
      { icon: Users, label: "Mijozlar", page: "customers" },
      { icon: GitBranch, label: "Segmentlar", page: "segments" },
      { icon: MessageSquare, label: "Chat", page: "chat", badgeKey: "chat" },
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

export default function Sidebar({ currentPage, onPageChange, marketingSub, onMarketingNavigate, mobileOpen = false, onMobileClose }: SidebarProps) {
  const [state, setState] = useState<SidebarState>(loadState);
  const { user, tenant, logout } = useAuth();
  const confirmDialog = useConfirm();

  const handleLogout = async () => {
    const ok = await confirmDialog({
      title: "Chiqishni xohlaysizmi?",
      description: "Hisobingizdan chiqasiz va qaytadan login qilishingiz kerak.",
      confirmText: "Chiqish",
      cancelText: "Bekor",
    });
    if (ok) logout();
  };
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

  // Sidebar badge'lari — auth bo'lsa har 30s yangilanadi
  const [counts, setCounts] = useState<SidebarCounts | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () => {
      api<SidebarCounts>("/dashboard/sidebar-counts")
        .then((res) => { if (!cancelled) setCounts(res); })
        .catch(() => null);
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user]);

  // Cmd+K — barcha sahifalar bo'yicha qidiruv
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const allPages = useMemo(() => {
    const list: Array<{ page: Page | "marketing-sub"; label: string; icon: React.ElementType; section: string; sub?: MarketingSub }> = [];
    for (const g of navGroups) for (const it of g.items) list.push({ page: it.page, label: it.label, icon: it.icon, section: g.label });
    list.push({ page: "marketing", label: "Marketing", icon: Megaphone, section: "Marketing" });
    for (const sub of marketingSubOrder) {
      list.push({ page: "marketing-sub", label: marketingSubLabels[sub], icon: Megaphone, section: "Marketing", sub });
    }
    list.push({ page: settingsItem.page, label: settingsItem.label, icon: settingsItem.icon, section: "Sozlamalar" });
    return list;
  }, []);
  const filteredPalette = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return allPages.slice(0, 8);
    return allPages.filter((p) => p.label.toLowerCase().includes(q)).slice(0, 12);
  }, [paletteQuery, allPages]);

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onMobileClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className={`fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-800 z-50 flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
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

      {/* Search trigger — Cmd+K to'liq qidirish */}
      {!collapsed && (
        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-2 mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-800 text-xs text-slate-400 transition-colors"
          title="Tezkor navigatsiya (⌘K)"
        >
          <SearchIcon className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Qidirish…</span>
          <kbd className="text-[10px] bg-slate-700/60 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group) => (
          <NavGroupBlock
            key={group.id}
            group={group}
            open={state.openGroups[group.id] ?? true}
            collapsed={collapsed}
            currentPage={currentPage}
            counts={counts}
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
            onClick={handleLogout}
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

      {/* Cmd+K command palette */}
      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
            onClick={() => setPaletteOpen(false)}
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                <CommandIcon className="w-4 h-4 text-slate-500" />
                <input
                  autoFocus
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  placeholder="Sahifani qidiring…"
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && filteredPalette[0]) {
                      const sel = filteredPalette[0];
                      if (sel.page === "marketing-sub" && sel.sub) onMarketingNavigate(sel.sub);
                      else if (sel.page !== "marketing-sub") onPageChange(sel.page);
                      setPaletteOpen(false);
                      setPaletteQuery("");
                    }
                  }}
                />
                <button onClick={() => setPaletteOpen(false)} className="p-1 text-slate-500 hover:text-white">
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto py-1">
                {filteredPalette.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">Topilmadi</div>
                ) : (
                  filteredPalette.map((p, i) => {
                    const PIcon = p.icon;
                    return (
                      <button
                        key={`${p.page}-${p.sub ?? i}`}
                        onClick={() => {
                          if (p.page === "marketing-sub" && p.sub) onMarketingNavigate(p.sub);
                          else if (p.page !== "marketing-sub") onPageChange(p.page);
                          setPaletteOpen(false);
                          setPaletteQuery("");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        <PIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="flex-1 text-left">{p.label}</span>
                        <span className="text-[10px] text-slate-600 uppercase tracking-wider">{p.section}</span>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="px-4 py-2 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between">
                <span>↵ ochish</span>
                <span><kbd className="bg-slate-800 px-1 py-0.5 rounded">Esc</kbd> yopish</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function NavGroupBlock({
  group,
  open,
  collapsed,
  currentPage,
  counts,
  onToggle,
  onPageChange,
}: {
  group: NavGroup;
  open: boolean;
  collapsed: boolean;
  currentPage: Page;
  counts: SidebarCounts | null;
  onToggle: () => void;
  onPageChange: (p: Page) => void;
}) {
  // Group jami badge — yopilgan bo'lsa ham diqqatga olib boradi
  const groupBadge = group.items.reduce((s, it) => s + (it.badgeKey && counts ? counts[it.badgeKey] : 0), 0);

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
            badge={item.badgeKey && counts ? counts[item.badgeKey] : 0}
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
        <span className="flex items-center gap-1.5">
          {group.label}
          {!open && groupBadge > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full normal-case tracking-normal">
              {groupBadge > 99 ? "99+" : groupBadge}
            </span>
          )}
        </span>
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
                badge={item.badgeKey && counts ? counts[item.badgeKey] : 0}
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
  badge = 0,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? (badge > 0 ? `${label} (${badge})` : label) : undefined}
      className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
        active ? "bg-emerald-500/10 text-emerald-400" : "text-slate-400 hover:text-white hover:bg-slate-800"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-emerald-400" : ""}`} />
      {!collapsed && <span className="text-sm font-medium truncate flex-1 text-left">{label}</span>}
      {badge > 0 && (collapsed ? (
        <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : (
        <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          {badge > 99 ? "99+" : badge}
        </span>
      ))}
      {active && !collapsed && badge === 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
    </button>
  );
}
