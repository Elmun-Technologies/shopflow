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
  Pin,
  PinOff,
  LayoutGrid,
  Tag,
  Gift,
  ImageIcon,
  TicketPercent,
  PartyPopper,
  PanelTop,
  Mail,
  Send,
  Hash,
  ShoppingCart,
  Star,
  Award,
  Wallet,
  Link2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MarketingSub } from "../data/marketingData";
import { marketingSubOrder, marketingSubLabels, marketingSubGroups } from "../data/marketingData";

// Marketing sub-itemlar uchun ikonkalar — vizual aniqlik
const marketingSubIcons: Record<MarketingSub, React.ElementType> = {
  aksiyalar: Tag,
  promokod: TicketPercent,
  sovgalar: Gift,
  giveaway: PartyPopper,
  popups: PanelTop,
  banner: ImageIcon,
  rassilka: Mail,
  sms: Send,
  kanal: Hash,
  abandoned: ShoppingCart,
  sharhlar: Star,
  sodiqlik: Award,
  tranzaksiyalar: Wallet,
  manbalar: Link2,
};
import { useAuth } from "../contexts/AuthContext";
import { useConfirm } from "./ui/ConfirmDialog";
import { api } from "../api/client";
import { useT, type Lang } from "../i18n";

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
  labelKey?: string; // i18n key — agar berilgan bo'lsa, t() orqali tarjima qilinadi
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
  labelKey?: string;
  items: NavItem[];
}

// Guruhlar — qisqa, mantiqiy
const navGroups: NavGroup[] = [
  {
    id: "main",
    label: "Asosiy",
    labelKey: "sidebar.group.main",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", labelKey: "nav.dashboard", page: "dashboard" },
      { icon: BarChart3, label: "Tahlil", labelKey: "nav.analytics", page: "analytics" },
    ],
  },
  {
    id: "sales",
    label: "Savdo",
    labelKey: "sidebar.group.sales",
    items: [
      { icon: ShoppingBag, label: "Buyurtmalar", labelKey: "nav.orders", page: "orders", badgeKey: "orders" },
      { icon: Package, label: "Mahsulotlar", labelKey: "nav.products", page: "products" },
      { icon: CreditCard, label: "To'lovlar", labelKey: "nav.payments", page: "payments" },
      { icon: Truck, label: "Yetkazib berish", labelKey: "nav.delivery", page: "delivery" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    labelKey: "sidebar.group.crm",
    items: [
      { icon: Radio, label: "Lidlar", labelKey: "nav.leads", page: "leads", badgeKey: "leads" },
      { icon: Users, label: "Mijozlar", labelKey: "nav.customers", page: "customers" },
      { icon: GitBranch, label: "Segmentlar", labelKey: "nav.segments", page: "segments" },
      { icon: MessageSquare, label: "Chat", labelKey: "nav.chat", page: "chat", badgeKey: "chat" },
    ],
  },
  {
    id: "channels",
    label: "Kanallar",
    labelKey: "sidebar.group.channels",
    items: [
      { icon: Layers, label: "Platformalar", labelKey: "nav.platforms", page: "platforms" },
      { icon: Paintbrush, label: "Vitrina", labelKey: "nav.uibuilder", page: "uibuilder" },
    ],
  },
];

const settingsItem: NavItem = { icon: Settings, label: "Sozlamalar", labelKey: "nav.settings", page: "settings" };

const LS_KEY = "shopflow.sidebar.state";
const LS_RECENT_KEY = "shopflow.sidebar.recent";
const LS_PINNED_KEY = "shopflow.sidebar.pinned";

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

// Yaqinda ochilgan sahifalar — eng so'nggi 5 ta unique
function loadRecent(): Page[] {
  try {
    const raw = localStorage.getItem(LS_RECENT_KEY);
    if (raw) return JSON.parse(raw) as Page[];
  } catch { /* ignore */ }
  return [];
}
function saveRecent(pages: Page[]) {
  try { localStorage.setItem(LS_RECENT_KEY, JSON.stringify(pages)); } catch { /* ignore */ }
}

// Pinned (qadalgan) sahifalar — operator o'zi pin qiladi
function loadPinned(): Page[] {
  try {
    const raw = localStorage.getItem(LS_PINNED_KEY);
    if (raw) return JSON.parse(raw) as Page[];
  } catch { /* ignore */ }
  return [];
}
function savePinned(pages: Page[]) {
  try { localStorage.setItem(LS_PINNED_KEY, JSON.stringify(pages)); } catch { /* ignore */ }
}

// Flat lookup — Page → NavItem
function findNavItem(page: Page): NavItem | undefined {
  for (const g of navGroups) {
    const it = g.items.find((i) => i.page === page);
    if (it) return it;
  }
  if (settingsItem.page === page) return settingsItem;
  return undefined;
}

export default function Sidebar({ currentPage, onPageChange, marketingSub, onMarketingNavigate, mobileOpen = false, onMobileClose }: SidebarProps) {
  const [state, setState] = useState<SidebarState>(loadState);
  const [recent, setRecent] = useState<Page[]>(() => loadRecent());
  const [pinned, setPinned] = useState<Page[]>(() => loadPinned());
  const { user, tenant, logout } = useAuth();
  const confirmDialog = useConfirm();
  const { lang, setLang, t } = useT();

  // Helper — NavItem'ni tarjima qilingan label bilan render qilish uchun
  const itemLabel = (it: NavItem) => (it.labelKey ? t(it.labelKey) : it.label);

  // Sahifa o'zgarganda Yaqinda ro'yxatini yangilaymiz (eng so'nggi birinchi, 5 ta max)
  useEffect(() => {
    if (currentPage === "settings") return; // sozlamalar pastda alohida, recent'ga kerak emas
    setRecent((prev) => {
      const next = [currentPage, ...prev.filter((p) => p !== currentPage)].slice(0, 5);
      saveRecent(next);
      return next;
    });
  }, [currentPage]);

  const togglePin = (page: Page) => {
    setPinned((prev) => {
      const next = prev.includes(page) ? prev.filter((p) => p !== page) : [...prev, page].slice(0, 6);
      savePinned(next);
      return next;
    });
  };

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
    for (const g of navGroups) for (const it of g.items) list.push({
      page: it.page,
      label: it.labelKey ? t(it.labelKey) : it.label,
      icon: it.icon,
      section: g.labelKey ? t(g.labelKey) : g.label,
    });
    list.push({ page: "marketing", label: t("nav.marketingPanel"), icon: LayoutGrid, section: t("nav.marketing") });
    for (const sub of marketingSubOrder) {
      list.push({
        page: "marketing-sub",
        label: marketingSubLabels[sub],
        icon: marketingSubIcons[sub],
        section: t("nav.marketing"),
        sub,
      });
    }
    list.push({ page: settingsItem.page, label: t("nav.settings"), icon: settingsItem.icon, section: t("nav.settings") });
    return list;
  }, [t]);
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
        className={`fixed left-0 top-0 h-screen bg-cream-100 border-r border-cream-300 z-50 flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-cream-300">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-forest-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5 text-leaf-300" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="min-w-0"
              >
                <p className="text-sm font-bold text-forest-800 truncate">ShopFlow</p>
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
          className="mx-2 mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-cream-200/80 hover:bg-cream-200 border border-cream-300 text-xs text-slate-500 transition-colors"
          title="Tezkor navigatsiya (⌘K)"
        >
          <SearchIcon className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">{t("sidebar.search")}</span>
          <kbd className="text-[10px] bg-cream-300/80 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {/* Tezkor (pinned) — operator o'zi pin qilgan */}
        {!collapsed && pinned.length > 0 && (
          <div className="pt-1 mb-1">
            <div className="px-2 py-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
              <Pin className="w-3 h-3" />
              <span>{t("sidebar.pinned")}</span>
            </div>
            <div className="space-y-0.5">
              {pinned.map((page) => {
                const item = findNavItem(page);
                if (!item) return null;
                return (
                  <SidebarItem
                    key={`pin-${page}`}
                    icon={item.icon}
                    label={itemLabel(item)}
                    active={currentPage === page}
                    collapsed={false}
                    badge={item.badgeKey && counts ? counts[item.badgeKey] : 0}
                    onClick={() => onPageChange(page)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Yaqinda (recent) — avtomatik kuzatiladi */}
        {!collapsed && recent.length > 1 && (
          <div className="pt-1 mb-1">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t("sidebar.recent")}
            </div>
            <div className="space-y-0.5">
              {recent.filter((p) => p !== currentPage && !pinned.includes(p)).slice(0, 3).map((page) => {
                const item = findNavItem(page);
                if (!item) return null;
                return (
                  <SidebarItem
                    key={`recent-${page}`}
                    icon={item.icon}
                    label={itemLabel(item)}
                    active={false}
                    collapsed={false}
                    badge={item.badgeKey && counts ? counts[item.badgeKey] : 0}
                    onClick={() => onPageChange(page)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {navGroups.map((group) => (
          <NavGroupBlock
            key={group.id}
            group={group}
            open={state.openGroups[group.id] ?? true}
            collapsed={collapsed}
            currentPage={currentPage}
            counts={counts}
            pinned={pinned}
            onTogglePin={togglePin}
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

        {/* Promo card — Commerly stilida pastdagi yashil card */}
        {!collapsed && (
          <div className="mx-1 mt-4 p-3 rounded-2xl bg-gradient-to-br from-leaf-100 to-leaf-200 border border-leaf-300/50 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-leaf-400/30 blur-xl" />
            <div className="relative">
              <div className="w-7 h-7 rounded-lg bg-leaf-400 flex items-center justify-center mb-2">
                <Award className="w-4 h-4 text-forest-800" />
              </div>
              <p className="text-xs font-semibold text-forest-800">Productive with AI</p>
              <p className="text-[10px] text-forest-700/80 mt-0.5 leading-tight">
                Avto javoblar, teg insight, va vaqtni tejaydigan vositalar
              </p>
              <button className="w-full mt-2.5 py-1.5 bg-forest-700 hover:bg-forest-800 text-white text-xs font-semibold rounded-lg transition-colors">
                Upgrade Plan
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-cream-300 px-2 py-2 space-y-1">
        <SidebarItem
          icon={settingsItem.icon}
          label={itemLabel(settingsItem)}
          active={currentPage === settingsItem.page}
          collapsed={collapsed}
          onClick={() => onPageChange(settingsItem.page)}
        />

        {/* User mini-card */}
        <div className="px-2 py-2 flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-leaf-100 text-forest-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
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
                <p className="text-xs font-medium text-forest-800 truncate">{user?.name ?? "—"}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.role ?? ""}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-cream-200 transition-all flex-shrink-0"
            title={t("sidebar.logout")}
            aria-label={t("sidebar.logout")}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Til o'zgartirish — kompakt segmented */}
        {!collapsed && (
          <div className="flex items-center gap-1 p-1 mb-1 bg-cream-200/60 rounded-lg">
            {(["uz", "ru"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 py-1 text-[11px] font-semibold rounded transition-all ${
                  lang === l
                    ? "bg-cream-300 text-forest-800"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setState((s) => ({ ...s, collapsed: !s.collapsed }))}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-forest-900 hover:bg-cream-200 transition-all"
          aria-label={collapsed ? "Sidebar'ni kengaytirish" : "Sidebar'ni yig'ish"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs font-medium">{t("sidebar.collapse")}</span>
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
              className="bg-cream-100 border border-cream-300 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-cream-300">
                <CommandIcon className="w-4 h-4 text-slate-500" />
                <input
                  autoFocus
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  placeholder="Sahifani qidiring…"
                  className="flex-1 bg-transparent text-sm text-forest-800 placeholder-slate-500 focus:outline-none"
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
                <button onClick={() => setPaletteOpen(false)} className="p-1 text-slate-500 hover:text-forest-900">
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
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-cream-200 hover:text-forest-900"
                      >
                        <PIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="flex-1 text-left">{p.label}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">{p.section}</span>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="px-4 py-2 border-t border-cream-300 text-[10px] text-slate-500 flex items-center justify-between">
                <span>↵ ochish</span>
                <span><kbd className="bg-cream-200 px-1 py-0.5 rounded">Esc</kbd> yopish</span>
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
  pinned = [],
  onTogglePin,
  onToggle,
  onPageChange,
}: {
  group: NavGroup;
  open: boolean;
  collapsed: boolean;
  currentPage: Page;
  counts: SidebarCounts | null;
  pinned?: Page[];
  onTogglePin?: (page: Page) => void;
  onToggle: () => void;
  onPageChange: (p: Page) => void;
}) {
  const { t } = useT();
  const itemLabel = (it: NavItem) => (it.labelKey ? t(it.labelKey) : it.label);
  // Group jami badge — yopilgan bo'lsa ham diqqatga olib boradi
  const groupBadge = group.items.reduce((s, it) => s + (it.badgeKey && counts ? counts[it.badgeKey] : 0), 0);

  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <SidebarItem
            key={item.page}
            icon={item.icon}
            label={itemLabel(item)}
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
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-1.5">
          {group.labelKey ? t(group.labelKey) : group.label}
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
                label={itemLabel(item)}
                active={currentPage === item.page}
                collapsed={false}
                badge={item.badgeKey && counts ? counts[item.badgeKey] : 0}
                pinned={pinned.includes(item.page)}
                onTogglePin={onTogglePin ? () => onTogglePin(item.page) : undefined}
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
  const { t } = useT();
  if (collapsed) {
    return (
      <SidebarItem
        icon={Megaphone}
        label={t("nav.marketing")}
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
        className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-700 transition-colors"
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
            className="overflow-hidden"
          >
            {/* Asosiy dashboard — eski "Umumiy" o'rniga aniq nom */}
            <button
              type="button"
              onClick={() => onNavigate(marketingSub)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all mb-2 ${
                active
                  ? "bg-leaf-100 text-forest-700 font-medium"
                  : "text-slate-700 hover:text-forest-900 hover:bg-cream-200"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Marketing paneli</span>
            </button>

            {/* Mantiqiy mini-guruhlar — vizual aniqlik */}
            {marketingSubGroups.map((g) => (
              <div key={g.id} className="mb-2">
                <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                  {g.label}
                </div>
                {g.items.map((sub) => {
                  const subActive = active && marketingSub === sub;
                  const SubIcon = marketingSubIcons[sub];
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => onNavigate(sub)}
                      className={`w-full flex items-center gap-2.5 pl-3 pr-3 py-1.5 rounded-lg text-left text-xs transition-all ${
                        subActive
                          ? "bg-leaf-100 text-forest-700 font-medium"
                          : "text-slate-500 hover:text-forest-900 hover:bg-cream-200/80"
                      }`}
                    >
                      <SubIcon className={`w-3.5 h-3.5 flex-shrink-0 ${subActive ? "text-forest-700" : "text-slate-500"}`} />
                      <span className="truncate">{marketingSubLabels[sub]}</span>
                    </button>
                  );
                })}
              </div>
            ))}
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
  pinned = false,
  onTogglePin,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  pinned?: boolean;
  onTogglePin?: () => void;
  onClick: () => void;
}) {
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        title={collapsed ? (badge > 0 ? `${label} (${badge})` : label) : undefined}
        className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
          active ? "bg-leaf-100 text-forest-700" : "text-slate-500 hover:text-forest-900 hover:bg-cream-200"
        } ${collapsed ? "justify-center" : ""}`}
      >
        <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${active ? "text-forest-700" : ""}`} />
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
        {active && !collapsed && badge === 0 && !pinned && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
      </button>
      {/* Pin tugmasi — faqat expanded + onTogglePin bo'lsa, hover'da yoki pinned bo'lsa ko'rinadi */}
      {!collapsed && onTogglePin && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity ${
            pinned
              ? "opacity-100 text-amber-400"
              : "opacity-0 group-hover:opacity-100 text-slate-500 hover:text-amber-400"
          }`}
          title={pinned ? "Pin'dan olib tashlash" : "Pin qo'shish"}
          aria-label={pinned ? "Pin'dan olib tashlash" : "Pin qo'shish"}
        >
          {pinned ? <Pin className="w-3.5 h-3.5 fill-amber-400" /> : <PinOff className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
