// ShopFlow Service Worker — install + offline shell. Push'siz (VAPID kelgusida).
// Strategy:
//  - HTML navigation: network-first, fallback cache
//  - Static assets (JS/CSS/SVG): cache-first
//  - API: hech qachon cache (har doim tarmoq)

const CACHE = "shopflow-v1";
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Faqat o'z origin
  if (url.origin !== self.location.origin) return;
  // API hech qachon cache qilinmaydi
  if (url.pathname.startsWith("/api/")) return;
  // SSE stream'ni ham cache qilmaslik
  if (url.pathname.includes("/events/stream")) return;
  // POST/PATCH/DELETE — service worker tegmaydi
  if (req.method !== "GET") return;

  // HTML navigation — network-first
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
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
