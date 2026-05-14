import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import { CatalogPage } from "./pages/CatalogPage.tsx";
import { ProductPage } from "./pages/ProductPage.tsx";
import { CartPage } from "./pages/CartPage.tsx";
import { CheckoutPage } from "./pages/CheckoutPage.tsx";
import { OrderPage } from "./pages/OrderPage.tsx";
import { MyOrdersPage } from "./pages/MyOrdersPage.tsx";
import { useEnsureAuth } from "./auth.ts";
import "./index.css";

WebApp.ready();
WebApp.expand();

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

function AuthedShell({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const { ready, error } = useEnsureAuth(slug);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500">
        Yuklanmoqda…
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center text-red-600">
        Xatolik: {error}
      </div>
    );
  }
  return <>{children}</>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/:slug" element={<AuthedShell><CatalogPage /></AuthedShell>} />
          <Route path="/:slug/p/:productSlug" element={<AuthedShell><ProductPage /></AuthedShell>} />
          <Route path="/:slug/cart" element={<AuthedShell><CartPage /></AuthedShell>} />
          <Route path="/:slug/checkout" element={<AuthedShell><CheckoutPage /></AuthedShell>} />
          <Route path="/:slug/order/:orderId" element={<AuthedShell><OrderPage /></AuthedShell>} />
          <Route path="/:slug/my-orders" element={<AuthedShell><MyOrdersPage /></AuthedShell>} />
          <Route path="*" element={<Navigate to="/demo" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
