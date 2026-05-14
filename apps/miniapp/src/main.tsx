import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import WebApp from "@twa-dev/sdk";
import { CatalogPage } from "./pages/CatalogPage.tsx";
import { ProductPage } from "./pages/ProductPage.tsx";
import { CartPage } from "./pages/CartPage.tsx";
import { CheckoutPage } from "./pages/CheckoutPage.tsx";
import "./index.css";

WebApp.ready();
WebApp.expand();

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/:slug" element={<CatalogPage />} />
          <Route path="/:slug/p/:productSlug" element={<ProductPage />} />
          <Route path="/:slug/cart" element={<CartPage />} />
          <Route path="/:slug/checkout" element={<CheckoutPage />} />
          <Route path="*" element={<Navigate to="/demo" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
