import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./index.css";
import App from "./App";

// Sentry — faqat VITE_SENTRY_DSN env berilgan bo'lsa init qilinadi
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    tracesSampleRate: 0.1,
    // Foydalanuvchi ma'lumotlarini Sentry'ga yubormaslik
    beforeSend(event) {
      // Shaxsiy ma'lumotlarni o'chirib tashlash
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}

// PWA Service Worker — faqat production'da ro'yxatdan o'tkazamiz
// (dev'da Vite HMR bilan to'qnashmaslik uchun)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => null);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
