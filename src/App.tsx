import { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import { ShortcutsHelp } from "./components/ShortcutsHelp";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import KPICards from "./components/KPICards";
import SalesGauge from "./components/SalesGauge";
import RecentOrders from "./components/RecentOrders";
import TopProducts from "./components/TopProducts";
import TrafficSources from "./components/TrafficSources";
import LowStockAlert from "./components/LowStockAlert";
import ProfitBreakdown from "./components/ProfitBreakdown";
import { StorefrontStatusBanner } from "./components/StorefrontStatusBanner";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./components/LoginPage";
import { AppToastProvider } from "./components/ui/Toast";
import { ConfirmProvider } from "./components/ui/ConfirmDialog";
import { LangProvider, useT } from "./i18n";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./api/queryClient";
import { PageSkeleton } from "./components/ui/Skeleton";
import type { MarketingSub } from "./data/marketingData";

const OrdersPage = lazy(() => import("./components/OrdersPage"));
const ProductsPage = lazy(() => import("./components/ProductsPage"));
const LeadsPage = lazy(() => import("./components/LeadsPage"));
const CustomersPage = lazy(() => import("./components/CustomersPage"));
const ChatPage = lazy(() => import("./components/ChatPage"));
const PlatformsPage = lazy(() => import("./components/PlatformsPage"));
const PaymentsPage = lazy(() => import("./components/PaymentsPage"));
const DeliveryPage = lazy(() => import("./components/DeliveryPage"));
const RassilkaPage = lazy(() => import("./components/pages/RassilkaPage"));
const PromoPage = lazy(() => import("./components/pages/PromoPage"));
const PopupsPage = lazy(() => import("./components/PopupsPage"));
const SaleCampaignsPage = lazy(() => import("./components/SaleCampaignsPage"));
const AbandonedCartsPage = lazy(() => import("./components/AbandonedCartsPage"));
const SovgalarPage = lazy(() => import("./components/pages/SovgalarPage"));
const SmsPage = lazy(() => import("./components/pages/SmsPage"));
const KanalPage = lazy(() => import("./components/pages/KanalPage"));
const BannerPage = lazy(() => import("./components/pages/BannerPage"));
const IzohlarPage = lazy(() => import("./components/pages/IzohlarPage"));
const SodiqlikPage = lazy(() => import("./components/pages/SodiqlikPage"));
const GiveawayPage = lazy(() => import("./components/pages/GiveawayPage"));
const ManbaPage = lazy(() => import("./components/pages/ManbaPage"));
const TranzaksiyalarPage = lazy(() => import("./components/pages/TranzaksiyalarPage"));
const SegmentsPage = lazy(() => import("./components/pages/SegmentsPage"));
const VoronkaPage = lazy(() => import("./components/pages/VoronkaPage"));
const AnalyticsPage = lazy(() => import("./components/AnalyticsPage"));
const SettingsPage = lazy(() => import("./components/SettingsPage"));
const UIBuilderPage = lazy(() => import("./components/UIBuilderPage"));
const StorePage = lazy(() => import("./components/StorePage"));

// Recharts-og'ir dashboard grafiklar — lazy (recharts initial bundle'dan chiqadi).
// KPI raqamlari + gauge + traffic darhol render bo'ladi, grafiklar oqib keladi.
const RevenueChart = lazy(() => import("./components/RevenueChart"));
const SalesByCategory = lazy(() => import("./components/SalesByCategory"));
const WeeklySales = lazy(() => import("./components/WeeklySales"));

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

function PageLoader() {
  const { t } = useT();
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{t("common.loading")}</span>
      <PageSkeleton />
    </div>
  );
}

// Lazy grafiklar yuklanayotganda — karta shaklidagi skeleton (layout shift yo'q)
function ChartFallback({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-cream-300 animate-pulse ${className}`} />
  );
}

function DashboardPage({ onNavigate }: { onNavigate?: (page: Page) => void } = {}) {
  const { t, lang } = useT();
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const now = new Date();
    setCurrentDate(
      now.toLocaleDateString(lang === "ru" ? "ru-RU" : "uz-UZ", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }, [lang]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5 text-leaf-500">
            {currentDate}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-forest-900">
            {t("dashboard.greeting")}
          </h1>
          <p className="text-sm mt-1 text-slate-400">
            {t("dashboard.subtitle")}
          </p>
        </div>

        {/* Date badge */}
        <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl self-start bg-white border border-cream-300">
          <div className="w-2 h-2 rounded-full bg-leaf-500" />
          <span className="text-xs font-medium text-slate-600">
            {t("dashboard.liveData")}
          </span>
        </div>
      </motion.div>

      <KPICards />

      <ProfitBreakdown />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Suspense fallback={<ChartFallback className="h-80" />}>
            <RevenueChart />
          </Suspense>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <SalesGauge />
          <Suspense fallback={<ChartFallback className="h-64" />}>
            <SalesByCategory />
          </Suspense>
          <Suspense fallback={<ChartFallback className="h-64" />}>
            <WeeklySales />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <RecentOrders />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <TopProducts />
          <TrafficSources />
        </div>
      </div>

      <div className="mt-4">
        <LowStockAlert onOpenProducts={() => onNavigate?.("products")} />
      </div>
    </>
  );
}

// ─── URL ↔ sahifa sinxronizatsiyasi ──────────────────────────────────────────
// Admin navigatsiyasi state-based. URL manzil satrida ko'rinishi, brauzer "orqaga"/
// "oldinga" va refresh to'g'ri sahifani ochishi uchun History API bilan bog'laymiz.
const PAGE_PATH: Record<Page, string> = {
  dashboard: "/",
  orders: "/orders",
  products: "/products",
  leads: "/leads",
  customers: "/customers",
  segments: "/segments",
  chat: "/chat",
  platforms: "/platforms",
  payments: "/payments",
  delivery: "/delivery",
  uibuilder: "/uibuilder",
  marketing: "/marketing",
  analytics: "/analytics",
  settings: "/settings",
};

function pageToPath(page: Page, sub: MarketingSub): string {
  return page === "marketing" ? `/marketing/${sub}` : PAGE_PATH[page];
}

function parseLocation(): { page: Page; sub: MarketingSub | null } {
  const path = window.location.pathname;
  if (path.startsWith("/marketing")) {
    const sub = path.split("/")[2] || null;
    return { page: "marketing", sub: sub as MarketingSub | null };
  }
  const found = (Object.entries(PAGE_PATH) as [Page, string][]).find(([, p]) => p === path);
  return { page: found ? found[0] : "dashboard", sub: null };
}

function AppShell() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>(() => parseLocation().page);
  const [marketingSub, setMarketingSub] = useState<MarketingSub>(() => parseLocation().sub ?? "rassilka");
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useGlobalShortcuts({
    onNavigate: (page) => setCurrentPage(page),
    onShowHelp: () => setShortcutsOpen(true),
    onCloseHelp: () => setShortcutsOpen(false),
  });

  const goToMarketing = (sub: MarketingSub) => {
    setMarketingSub(sub);
    setCurrentPage("marketing");
  };

  useEffect(() => {
    if (!user) return;
    const sidebar = document.querySelector("aside");
    if (!sidebar) return;
    setSidebarWidth(sidebar.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSidebarWidth(entry.contentRect.width);
      }
    });
    observer.observe(sidebar);
    return () => observer.disconnect();
  }, [user]);

  // Mobile breakpoint kuzatish (Tailwind's md: 768px)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // currentPage/marketingSub → URL (manzil satri yangilanadi, history yoziladi)
  useEffect(() => {
    const path = pageToPath(currentPage, marketingSub);
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  }, [currentPage, marketingSub]);

  // Brauzer "orqaga"/"oldinga" tugmasi → sahifani tiklash
  useEffect(() => {
    const onPop = () => {
      const loc = parseLocation();
      setCurrentPage(loc.page);
      if (loc.sub) setMarketingSub(loc.sub);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-leaf-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage onNavigate={setCurrentPage} />;
      case "orders":
        return <OrdersPage />;
      case "products":
        return <ProductsPage />;
      case "leads":
        return <LeadsPage />;
      case "customers":
        return <CustomersPage />;
      case "segments":
        return <SegmentsPage />;
      case "chat":
        return <ChatPage />;
      case "platforms":
        return <PlatformsPage />;
      case "payments":
        return <PaymentsPage />;
      case "delivery":
        return <DeliveryPage />;
      case "marketing":
        switch (marketingSub) {
          case "popups":
            return <PopupsPage />;
          case "aksiyalar":
            return <SaleCampaignsPage />;
          case "abandoned":
            return <AbandonedCartsPage />;
          case "rassilka":
            return <RassilkaPage />;
          case "promokod":
            return <PromoPage />;
          case "sovgalar":
            return <SovgalarPage />;
          case "sms":
            return <SmsPage />;
          case "kanal":
            return <KanalPage />;
          case "banner":
            return <BannerPage />;
          case "sharhlar":
            return <IzohlarPage />;
          case "sodiqlik":
            return <SodiqlikPage />;
          case "giveaway":
            return <GiveawayPage />;
          case "manbalar":
            return <ManbaPage />;
          case "tranzaksiyalar":
            return <TranzaksiyalarPage />;
          case "voronka":
            return <VoronkaPage />;
          default:
            return <RassilkaPage />;
        }
      case "uibuilder":
        return <UIBuilderPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-cream-50">
      <Sidebar
        currentPage={currentPage}
        onPageChange={(p) => { setCurrentPage(p); setMobileSidebarOpen(false); }}
        marketingSub={marketingSub}
        onMarketingNavigate={(sub) => { goToMarketing(sub); setMobileSidebarOpen(false); }}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="md:transition-all md:duration-300" style={{ marginLeft: isMobile ? 0 : sidebarWidth }}>
        <Header
          onMobileMenuOpen={() => setMobileSidebarOpen(true)}
          onNotifNavigate={(page) => setCurrentPage(page)}
          onOpenSettings={() => setCurrentPage("settings")}
        />
        <StorefrontStatusBanner onOpenVitrina={() => setCurrentPage("uibuilder")} />
        <main className="p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>{renderPage()}</Suspense>
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <OnboardingWizard
        onNavigate={(page) => {
          if (page === "products") setCurrentPage("products");
          else if (page === "settings") setCurrentPage("settings");
          else if (page === "platforms") setCurrentPage("platforms");
          else if (page === "uibuilder") setCurrentPage("uibuilder");
        }}
      />
    </div>
  );
}

function App() {
  // Public store route: /store/:slug — no auth required
  const path = window.location.pathname;
  const storeMatch = path.match(/^\/store\/([^/]+)/);
  if (storeMatch) {
    const slug = storeMatch[1];
    return (
      <ErrorBoundary>
        <Suspense fallback={
          <div className="min-h-screen bg-cream-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-leaf-500 animate-spin" />
          </div>
        }>
          <StorePage slug={slug} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LangProvider>
          <AuthProvider>
            <AppToastProvider>
              <ConfirmProvider>
                <AppShell />
              </ConfirmProvider>
            </AppToastProvider>
          </AuthProvider>
        </LangProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
