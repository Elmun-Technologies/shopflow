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

// Telegram Mini App (/store/:slug) — admin paneldan farqli o'laroq PWA emas.
// U Telegram WebView'ida ochiladi va u yerda eskirgan Service Worker keshi
// "do'kon ochilmayapti" (oq ekran) bo'lib chiqadi, mijoz esa uni tozalay
// olmaydi. Shu sababli do'konda SW ro'yxatdan o'tkazilmaydi va ilgari
// yozilgan SW/kesh bo'lsa — o'chiriladi (mavjud qurilmalar o'zini davolaydi).
const isMiniApp = window.location.pathname.startsWith("/store/");

if ("serviceWorker" in navigator) {
  if (isMiniApp) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .then(() => (window.caches ? caches.keys() : []))
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => null);
  } else if (import.meta.env.PROD) {
    // PWA Service Worker — faqat production'da (dev'da Vite HMR bilan to'qnashadi)
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    });
  }
}

// index.html dagi boot-watchdog uchun: bundle shu yergacha yetib keldi.
// (Panel diagnostikasida "bosqich" shu bayroq orqali aniqlanadi.)
const boot = (window as unknown as { __sfBoot?: { react: boolean } }).__sfBoot;
if (boot) boot.react = true;

// Render yiqilsa index.html dagi boot-watchdog paneli ko'rsatiladi — mijoz
// oq ekran o'rniga sababni ko'radi (Telegram'da devtools ochib bo'lmaydi).
try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (err) {
  const show = (window as unknown as { __shopflowBootFailed?: (m: string) => void })
    .__shopflowBootFailed;
  show?.(err instanceof Error ? err.message : "Ilovani ishga tushirib bo'lmadi.");
  throw err;
}
