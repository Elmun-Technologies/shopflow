import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import KPICards from "./components/KPICards";
import RevenueChart from "./components/RevenueChart";
import SalesByCategory from "./components/SalesByCategory";
import WeeklySales from "./components/WeeklySales";
import RecentOrders from "./components/RecentOrders";
import TopProducts from "./components/TopProducts";
import TrafficSources from "./components/TrafficSources";
import OrdersPage from "./components/OrdersPage";
import ProductsPage from "./components/ProductsPage";
import LeadsPage from "./components/LeadsPage";
import CustomersPage from "./components/CustomersPage";
import ChatPage from "./components/ChatPage";
import PlatformsPage from "./components/PlatformsPage";
import PaymentsPage from "./components/PaymentsPage";
import DeliveryPage from "./components/DeliveryPage";
import RassilkaPage from "./components/pages/RassilkaPage";
import PromoPage from "./components/pages/PromoPage";
import SovgalarPage from "./components/pages/SovgalarPage";
import SmsPage from "./components/pages/SmsPage";
import KanalPage from "./components/pages/KanalPage";
import BannerPage from "./components/pages/BannerPage";
import IzohlarPage from "./components/pages/IzohlarPage";
import SodiqlikPage from "./components/pages/SodiqlikPage";
import GiveawayPage from "./components/pages/GiveawayPage";
import ManbaPage from "./components/pages/ManbaPage";
import TranzaksiyalarPage from "./components/pages/TranzaksiyalarPage";
import SegmentsPage from "./components/pages/SegmentsPage";
import AnalyticsPage from "./components/AnalyticsPage";
import SettingsPage from "./components/SettingsPage";
import UIBuilderPage from "./components/UIBuilderPage";
import { Calendar, Download } from "lucide-react";
import type { MarketingSub } from "./data/marketingData";

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

function DashboardPage() {
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    const now = new Date();
    setCurrentDate(
      now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

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
      {/* Page Title */}
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
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-all">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </motion.div>

      {/* KPI Cards */}
      <KPICards />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="space-y-4">
          <SalesByCategory />
          <WeeklySales />
        </div>
      </div>

      {/* Orders & Products Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <RecentOrders />
        </div>
        <div className="space-y-4">
          <TopProducts />
          <TrafficSources />
        </div>
      </div>

      {/* Footer */}
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

    setSidebarWidth(sidebar.getBoundingClientRect().width);

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
    <div className="min-h-screen bg-slate-950">
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        marketingSub={marketingSub}
        onMarketingNavigate={goToMarketing}
      />

      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
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
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
