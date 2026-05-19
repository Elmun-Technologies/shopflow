import { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Download, Loader2 } from "lucide-react";
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
import type { MarketingSub } from "./data/marketingData";

// Heavy pages — lazy loaded for faster initial render
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
    <div className="flex items-center justify-center py-20" role="status" aria-live="polite">
      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      <span className="sr-only">Yuklanmoqda...</span>
    </div>
  );
}

function DashboardPage() {
  const [currentDate] = useState(() =>
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  );

  const handleExport = () => {
    const lines = [
      "ShopFlow Dashboard Report",
      `Generated: ${new Date().toISOString()}`,
      "",
      "Note: This is a demo export with mock data.",
    ].join("\n");
    const blob = new Blob([lines], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopflow-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <Calendar className="w-4 h-4 text-slate-500" />
            <p className="text-sm text-slate-500">{currentDate}</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all"
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </motion.div>

      <KPICards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="space-y-4">
          <SalesByCategory />
          <WeeklySales />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <RecentOrders />
        </div>
        <div className="space-y-4">
          <TopProducts />
          <TrafficSources />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.0 }}
        className="mt-8 pt-6 border-t border-slate-800"
      >
        <p className="text-xs text-slate-600 text-center">
          ShopFlow Dashboard. All data is for demonstration purposes.
        </p>
      </motion.div>
    </>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [marketingSub, setMarketingSub] = useState<MarketingSub>("rassilka");
  const [sidebarWidth, setSidebarWidth] = useState(256);

  const goToMarketing = (sub: MarketingSub) => {
    setMarketingSub(sub);
    setCurrentPage("marketing");
  };

  useEffect(() => {
    const sidebar = document.querySelector("aside");
    if (!sidebar) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSidebarWidth(entry.contentRect.width);
      }
    });
    observer.observe(sidebar);

    return () => observer.disconnect();
  }, []);

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
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950">
        <Sidebar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          marketingSub={marketingSub}
          onMarketingNavigate={goToMarketing}
        />

        <div className="transition-all duration-300" style={{ marginLeft: sidebarWidth }}>
          <Header />

          <main className="p-6">
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
    </ErrorBoundary>
  );
}

export default App;
