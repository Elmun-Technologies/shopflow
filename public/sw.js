// ShopFlow Service Worker — install + offline shell. Push'siz (VAPID kelgusida).
// Strategy:
//  - HTML navigation: network-first, fallback cache
//  - Static assets (JS/CSS/SVG): cache-first
//  - API: hech qachon cache (har doim tarmoq)
//  - /store/* (Telegram Mini App): SW umuman aralashmaydi — pastdagi izohga qarang

// DIQQAT: yangi deploy keshni butunlay yangilashi uchun bu nomni oshiring.
// v1 da nom hech qachon o'zgarmagan edi: navigatsiya offline'ga tushib eski
// index.html ni bersa, u allaqachon o'chirilgan hash'li asset'larga murojaat
// qilardi → mijozda OQ EKRAN (bir qurilmada ishlaydi, boshqasida yo'q).
const CACHE = "shopflow-v2";
const CORE = ["/", "/manifest.webmanifest", "/icon-192.svg", "/icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Web Push — backend yuborgan xabarni OS notification sifatida ko'rsatish
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = { title: "ShopFlow", body: "Yangi xabar", url: "/" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      tag: "shopflow-notif",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Mavjud tab bo'lsa — uni faollashtirish, yo'q bo'lsa yangi tab
      for (const c of clients) {
        if (c.url.endsWith(url) && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Faqat o'z origin
  if (url.origin !== self.location.origin) return;
  // API hech qachon cache qilinmaydi
  if (url.pathname.startsWith("/api/")) return;
  // Telegram Mini App — SW butunlay chetda turadi.
  // Mini App Telegram'ning WebView'ida ochiladi; u yerda eskirgan kesh
  // "do'kon ochilmayapti" (oq ekran) sifatida namoyon bo'ladi va mijoz uni
  // brauzerdagidek "hard reload" bilan tuzata olmaydi. Do'kon har doim
  // to'g'ridan-to'g'ri tarmoqdan yuklansin.
  if (url.pathname === "/store" || url.pathname.startsWith("/store/")) return;
  // SSE stream'ni ham cache qilmaslik
  if (url.pathname.includes("/events/stream")) return;
  // POST/PATCH/DELETE — service worker tegmaydi
  if (req.method !== "GET") return;

  // HTML navigation — network-first
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Faqat sog'lom javobni saqlaymiz — deploy paytidagi 502/503 ni
          // keshlab qo'ysak, mijoz uzoq vaqt buzilgan sahifani ko'rardi.
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached ?? caches.match("/")) as Promise<Response>),
    );
    return;
  }

  // Static — cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
        }
        return res;
      });
    }),
  );
});
