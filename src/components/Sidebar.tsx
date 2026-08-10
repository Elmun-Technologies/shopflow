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
  GitMerge,
  Bot,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MarketingSub } from "../data/marketingData";
import { marketingSubOrder, marketingSubGroups } from "../data/marketingData";

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
  voronka: GitMerge,
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
  | "botbuilder"
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
      { icon: Bot, label: "Bot", labelKey: "nav.botbuilder", page: "botbuilder" },
    ],
  },
];

const settingsItem: NavItem = { icon: Settings, label: "Sozlamalar", labelKey: "nav.settings", page: "settings" };

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
    openGroups: { main: true, sales: true, crm: true, channels: true },
    marketingOpen: false,
  };
}

export default function Sidebar({ currentPage, onPageChange, marketingSub, onMarketingNavigate, mobileOpen = false, onMobileClose }: SidebarProps) {
  const [state, setState] = useState<SidebarState>(loadState);
  const { user, tenant, logout } = useAuth();
  const confirmDialog = useConfirm();
  const { lang, setLang, t } = useT();

  const handleLogout = async () => {
    const ok = await confirmDialog({
      title: t("sidebar.logoutConfirm.title"),
      description: t("sidebar.logoutConfirm.desc"),
      confirmText: t("sidebar.logout"),
      cancelText: t("common.cancel"),
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
        label: t(`marketing.sub.${sub}`),
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
        transition={{ duration: 0.22, ease: "easeInOut" }}
        className={`fixed left-0 top-0 h-screen z-50 flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        style={{
          backgroundColor: "#ffffff",
          borderRight: "1px solid #EAEAE0",
        }}
      >
      {/* Logo */}
      <div
        className="flex items-center h-16 px-4"
        style={{ borderBottom: "1px solid #EAEAE0" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center flex-shrink-0 rounded-xl"
            style={{ width: 36, height: 36, background: "linear-gradient(135deg, #2D4938, #4F6B53)" }}
          >
            <Store className="w-4.5 h-4.5" style={{ color: "#95D26F" }} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="min-w-0"
              >
                <p className="text-sm font-bold truncate" style={{ color: "#1F3327" }}>ShopFlow</p>
                <p className="text-[10px] truncate" style={{ color: "#94a3b8" }}>{tenant?.name ?? "—"}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Search trigger */}
      {!collapsed && (
        <button
          onClick={() => setPaletteOpen(true)}
          className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl transition-colors"
          style={{
            backgroundColor: "#F4F4ED",
            border: "1px solid #E5E5DA",
          }}
          title={t("sidebar.quickNav")}
        >
          <SearchIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#94a3b8" }} />
          <span className="flex-1 text-left text-xs" style={{ color: "#94a3b8" }}>{t("sidebar.search")}</span>
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{ backgroundColor: "#E5E5DA", color: "#64748b" }}
          >⌘K</kbd>
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
      <div className="px-2 py-2 space-y-1" style={{ borderTop: "1px solid #EAEAE0" }}>
        <SidebarItem
          icon={settingsItem.icon}
          label={settingsItem.labelKey ? t(settingsItem.labelKey) : settingsItem.label}
          active={currentPage === settingsItem.page}
          collapsed={collapsed}
          onClick={() => onPageChange(settingsItem.page)}
        />

        {/* User row */}
        <div className="flex items-center gap-2 px-2 py-1.5 min-w-0">
          <div
            className="flex items-center justify-center text-xs font-bold flex-shrink-0 rounded-lg"
            style={{ width: 32, height: 32, backgroundColor: "#2D4938", color: "#95D26F" }}
          >
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
                <p className="text-xs font-semibold truncate" style={{ color: "#1F3327" }}>
                  {user?.name ?? "—"}
                </p>
                <p className="text-[10px] truncate" style={{ color: "#94a3b8" }}>
                  {user?.role ?? ""}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg transition-all flex-shrink-0"
              style={{ color: "#94a3b8" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.backgroundColor = "#FEF2F2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.backgroundColor = ""; }}
              title={t("sidebar.logout")}
              aria-label={t("sidebar.logout")}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Language + collapse row */}
        {!collapsed && (
          <div className="flex items-center gap-1.5 px-1">
            <div
              className="flex items-center gap-0.5 p-0.5 rounded-lg flex-shrink-0"
              style={{ backgroundColor: "#F4F4ED" }}
            >
              {(["uz", "ru"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className="px-2 py-1 text-[10px] font-semibold rounded-md transition-all"
                  style={
                    lang === l
                      ? { backgroundColor: "#fff", color: "#1F3327", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
                      : { color: "#94a3b8" }
                  }
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={() => setState((s) => ({ ...s, collapsed: !s.collapsed }))}
              className="ml-auto flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-all"
              style={{ color: "#94a3b8" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F4F4ED"; e.currentTarget.style.color = "#1F3327"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = "#94a3b8"; }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{t("sidebar.collapse")}</span>
            </button>
          </div>
        )}

        {collapsed && (
          <button
            onClick={() => setState((s) => ({ ...s, collapsed: !s.collapsed }))}
            className="w-full flex items-center justify-center py-2 rounded-lg transition-all"
            style={{ color: "#94a3b8" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F4F4ED"; e.currentTarget.style.color = "#1F3327"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = "#94a3b8"; }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
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
              initial={{ y: -16, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -16, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg rounded-2xl overflow-hidden"
              style={{
                backgroundColor: "#FAFAF5",
                border: "1px solid #E5E5DA",
                boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input */}
              <div
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: "1px solid #EAEAE0" }}
              >
                <CommandIcon className="w-4 h-4 flex-shrink-0" style={{ color: "#94a3b8" }} />
                <input
                  autoFocus
                  value={paletteQuery}
                  onChange={(e) => setPaletteQuery(e.target.value)}
                  placeholder={t("sidebar.palette.placeholder")}
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                  style={{ color: "#1F3327" }}
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
                <button
                  onClick={() => setPaletteOpen(false)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: "#94a3b8" }}
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto py-1.5">
                {filteredPalette.length === 0 ? (
                  <div className="py-8 text-center text-sm" style={{ color: "#94a3b8" }}>
                    {t("sidebar.palette.empty")}
                  </div>
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
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                        style={{ color: "#475569" }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F4F4ED"; e.currentTarget.style.color = "#1F3327"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = "#475569"; }}
                      >
                        <div
                          className="flex items-center justify-center rounded-lg flex-shrink-0"
                          style={{ width: 28, height: 28, backgroundColor: "#F4F4ED" }}
                        >
                          <PIcon className="w-3.5 h-3.5" style={{ color: "#64748b" }} />
                        </div>
                        <span className="flex-1 text-left font-medium">{p.label}</span>
                        <span
                          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md"
                          style={{ backgroundColor: "#F4F4ED", color: "#94a3b8" }}
                        >
                          {p.section}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div
                className="px-4 py-2 text-[10px] flex items-center justify-between"
                style={{ borderTop: "1px solid #EAEAE0", color: "#94a3b8" }}
              >
                <span>↵ {t("sidebar.palette.open")}</span>
                <span>
                  <kbd
                    className="px-1.5 py-0.5 rounded font-mono"
                    style={{ backgroundColor: "#EAEAE0", color: "#64748b" }}
                  >Esc</kbd>{" "}{t("sidebar.palette.close")}
                </span>
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
    <div className="pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2.5 py-1 transition-colors rounded-md group"
        aria-expanded={open}
        style={{ color: "#94a3b8" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#64748b"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; }}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest">
          {group.labelKey ? t(group.labelKey) : group.label}
          {!open && groupBadge > 0 && (
            <span
              className="font-bold normal-case tracking-normal"
              style={{ backgroundColor: "#ef4444", color: "#fff", fontSize: 9, padding: "1px 5px", borderRadius: 999 }}
            >
              {groupBadge > 99 ? "99+" : groupBadge}
            </span>
          )}
        </span>
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{ transform: open ? undefined : "rotate(-90deg)" }}
        />
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
        <span>{t("nav.marketing")}</span>
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
              <span>{t("nav.marketingPanel")}</span>
            </button>

            {/* Mantiqiy mini-guruhlar — vizual aniqlik */}
            {marketingSubGroups.map((g) => (
              <div key={g.id} className="mb-2">
                <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400">
                  {t(`marketing.group.${g.id}`)}
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
                      <span className="truncate">{t(`marketing.sub.${sub}`)}</span>
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
    <div className="relative">
      {active && (
        <span
          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full z-10"
          style={{ backgroundColor: "#5FA340" }}
        />
      )}
      <button
        type="button"
        onClick={onClick}
        title={collapsed ? (badge > 0 ? `${label} (${badge})` : label) : undefined}
        className={`relative w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-150 ${
          collapsed ? "justify-center" : ""
        }`}
        style={{
          backgroundColor: active ? "#F0F8E3" : undefined,
          color: active ? "#2D4938" : "#64748b",
        }}
        onMouseEnter={(e) => {
          if (!active) {
            e.currentTarget.style.backgroundColor = "#F4F4ED";
            e.currentTarget.style.color = "#1F3327";
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            e.currentTarget.style.backgroundColor = "";
            e.currentTarget.style.color = "#64748b";
          }
        }}
      >
        <Icon
          style={{
            width: 16, height: 16,
            flexShrink: 0,
            color: active ? "#5FA340" : undefined,
          }}
        />
        {!collapsed && (
          <span
            className="text-sm truncate flex-1 text-left"
            style={{ fontWeight: active ? 600 : 500 }}
          >
            {label}
          </span>
        )}
        {badge > 0 && (
          collapsed ? (
            <span
              className="absolute top-0.5 right-0.5 flex items-center justify-center font-bold"
              style={{
                minWidth: 15, height: 15, padding: "0 3px",
                backgroundColor: "#ef4444", color: "#fff",
                fontSize: 9, borderRadius: 999,
              }}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          ) : (
            <span
              className="flex items-center justify-center font-bold text-white"
              style={{
                minWidth: 18, height: 18, padding: "0 5px",
                backgroundColor: "#ef4444", fontSize: 10,
                borderRadius: 999, lineHeight: 1,
              }}
            >
              {badge > 99 ? "99+" : badge}
            </span>
          )
        )}
      </button>
    </div>
  );
}
