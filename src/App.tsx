import { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Loader2 } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import KPICards from "./components/KPICards";
import RevenueChart from "./components/RevenueChart";
import SalesByCategory from "./components/SalesByCategory";
import WeeklySales from "./components/WeeklySales";
import RecentOrders from "./components/RecentOrders";
import TopProducts from "./components/TopProducts";
import TrafficSources from "./components/TrafficSources";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginPage from "./components/LoginPage";
import { AppToastProvider } from "./components/ui/Toast";
import { ConfirmProvider } from "./components/ui/ConfirmDialog";
import { LangProvider } from "./i18n";
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
const AnalyticsPage = lazy(() => import("./components/AnalyticsPage"));
const SettingsPage = lazy(() => import("./components/SettingsPage"));
const UIBuilderPage = lazy(() => import("./components/UIBuilderPage"));
const StorePage = lazy(() => import("./components/StorePage"));

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
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Yuklanmoqda...</span>
      <PageSkeleton />
    </div>
  );
}

function DashboardPage() {
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const now = new Date();
    setCurrentDate(
      now.toLocaleDateString("uz-UZ", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between mb-6"
      >
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="w-4 h-4 text-slate-500" />
            <p className="text-sm text-slate-500">{currentDate}</p>
          </div>
        </div>
      </motion.div>

      <KPICards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <SalesByCategory />
          <WeeklySales />
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
    </>
  );
}

function AppShell() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [marketingSub, setMarketingSub] = useState<MarketingSub>("rassilka");
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
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
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar
        currentPage={currentPage}
        onPageChange={(p) => { setCurrentPage(p); setMobileSidebarOpen(false); }}
        marketingSub={marketingSub}
        onMarketingNavigate={(sub) => { goToMarketing(sub); setMobileSidebarOpen(false); }}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="md:transition-all md:duration-300" style={{ marginLeft: isMobile ? 0 : sidebarWidth }}>
        <Header onMobileMenuOpen={() => setMobileSidebarOpen(true)} />
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
          <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        }>
          <StorePage slug={slug} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <LangProvider>
        <AuthProvider>
          <AppToastProvider>
            <ConfirmProvider>
              <AppShell />
            </ConfirmProvider>
          </AppToastProvider>
        </AuthProvider>
      </LangProvider>
    </ErrorBoundary>
  );
}

export default App;
