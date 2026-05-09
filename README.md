# 🛍️ ShopFlow — Telegram E-commerce Platform

<div align="center">

![ShopFlow](https://img.shields.io/badge/ShopFlow-Telegram%20Commerce-10b981?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5.1-000?style=for-the-badge&logo=fastify)
![grammY](https://img.shields.io/badge/grammY-1.32-26A5E4?style=for-the-badge&logo=telegram)

**Telegram bot + Mini App + admin dashboard. Bitta tizim ostida.**

</div>

---

## 📋 Loyiha haqida

**ShopFlow** — Telegram orqali sotuvni to'liq boshqarish uchun **production-grade** platforma:

- 🤖 **Telegram bot** — xaridor bot tokenini kiritsa avtomatik ulanadi (BotFather)
- 📱 **Mini App** — bot ichida ochiladigan to'liq do'kon (catalog, savat, checkout)
- 📊 **Admin dashboard** — real-time orderlar, analitika, mijozlar
- 🎨 **Bot UI editor** — bannerlar va sectionlar admin paneldan boshqariladi
- 🔌 **MoySklad sync** — mahsulotlar va buyurtmalar
- 💳 **Click + Payme** — onlayn to'lov tizimlari
- 🐳 **Docker deploy** — bitta `docker-compose up` bilan

---

## ⚡ Tezkor boshlash

```bash
git clone https://github.com/Elmun-Technologies/shopflow.git
cd shopflow
cp .env.example .env

# Random secrets generatsiya:
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))" >> .env

# Domain (production):
# echo "WEB_URL=https://app.shopflow.uz" >> .env
# echo "PUBLIC_URL=https://api.shopflow.uz" >> .env

docker-compose up -d --build
```

To'liq deploy qo'llanmasi: [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## 🏗️ Arxitektura

```
┌─────────────────────────────────────────────────────────────┐
│  ShopFlow Dashboard (React + Vite + Tailwind)                │
│  - KPI, analytics, orders, customers (real-time)             │
│  - Telegram bot ulash, UI editor                             │
│  - MoySklad / Click / Payme sozlash                          │
└─────────────────────────────────────────────────────────────┘
                  │ REST + WebSocket
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend (Node.js 22 + Fastify + grammY + Drizzle)           │
│  - JWT auth, AES-256-GCM token encryption                    │
│  - 12 ta jadval (users, shops, bots, products, orders, ...)  │
│  - Telegram webhook + polling fallback                       │
│  - Mini App initData HMAC validatsiya                        │
│  - WebSocket real-time event push                            │
└─────────────────────────────────────────────────────────────┘
       │                                          │
       ▼                                          ▼
  SQLite (dev) / PostgreSQL (prod)         Telegram + MoySklad + Click + Payme
```

---

## ✅ Nima bor (to'liq ishlaydi)

### Telegram Integration
- [x] Bot ulash BotFather token orqali (UI'dan, real-time validatsiya)
- [x] Webhook avtomatik o'rnatiladi (`PUBLIC_URL` bo'lsa)
- [x] Polling rejimi development uchun
- [x] `setChatMenuButton` Mini App URL bilan avtomatik
- [x] `/start`, `/help`, `/catalog` komandalar
- [x] Inline keyboard navigatsiya
- [x] Bot tokenlari DB'da AES-256-GCM bilan shifrlangan

### Mini App (xaridor uchun)
- [x] `initData` HMAC-SHA-256 validatsiya
- [x] Telegram theme + BackButton + HapticFeedback
- [x] Catalog (kategoriya filteri, qidiruv)
- [x] Mahsulot tafsiloti
- [x] Savat (stock validatsiya)
- [x] Checkout (telefon, manzil, to'lov turi)
- [x] Buyurtma tasdig'i bot orqali
- [x] Buyurtma tarixi
- [x] Schema-driven home screen (banner, kategoriya grid, top products)

### Admin Dashboard (real-time)
- [x] **KPICards** — bugungi tushum, buyurtma, yangi mijoz, mahsulot
- [x] **RevenueChart** — daromad chart (7/30/90/365 kun)
- [x] **TopProducts** — eng ko'p sotilayotgan
- [x] **RecentOrders** — so'nggi buyurtmalar widget
- [x] **LiveOrdersPanel** (OrdersPage) — to'liq buyurtma boshqaruvi:
  - Status o'zgartirish (drawer)
  - Mahsulotlar, manzil, telefon
  - Bot orqali xaridorga avtomatik xabar
  - Yashil flash effect yangi buyurtmada
- [x] **LiveCatalogPanel** (ProductsPage) — mahsulot CRUD:
  - Qo'shish/tahrirlash modal
  - Kategoriya tanlash, rasm URL, narx, qoldiq, faol
- [x] **LiveCustomersPanel** (CustomersPage) — Telegram mijozlar:
  - Qidiruv, sort (yangilari/eng ko'p xarajat/eng ko'p buyurtma)
  - Telegram link, telefon link
  - Buyurtma soni, jami xarajat
- [x] **LiveAnalyticsPanel** (AnalyticsPage):
  - 4 ta KPI card (delta % bilan)
  - Daromad chart
  - Manbalar pie chart (mini-app vs bot vs admin)
  - Top products bar chart
- [x] WebSocket real-time push hammasiga
- [x] Toast popup + ovoz signal yangi buyurtmada

### Bot UI Editor
- [x] Settings → Telegram Bot → ✨ tugmasi
- [x] Salomlashish xabari tahrir
- [x] Bannerlar (qo'shish/o'chirish/tartib o'zgartirish):
  - Sarlavha, subtitle, rasm URL
  - Action: kategoriya/mahsulot/URL
- [x] Sectionlar (3 turli: kategoriyalar, mahsulotlar, matn)
- [x] Mahsulot filterida aniq mahsulot tanlash imkoniyati
- [x] Mini App schema'ga qarab render qiladi

### MoySklad
- [x] Connection: Bearer token yoki Login/parol
- [x] `/api/integrations/moysklad/test` — kalit tekshirish
- [x] Mahsulot import (sahifalab, idempotent yangilash)
- [x] Kategoriya import (productfolder)
- [x] Buyurtma push (customerorder yaratish)
- [x] UI ulash modali

### To'lov tizimlari
- [x] **Click** Merchant API:
  - Merchant ID + Service ID + Secret Key
  - Prepare + Complete handlers
  - MD5 signature tekshiruvi
  - Buyurtma to'lov holatini avtomatik yangilash
- [x] **Payme** JSON-RPC:
  - 5 ta method (CheckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction, CheckTransaction)
  - Basic auth tekshiruvi
  - tiyin/so'm konversiya

### DevOps
- [x] Docker + docker-compose
- [x] Nginx config (SPA fallback, /api proxy, WebSocket upgrade)
- [x] `.env.example` namuna
- [x] Drizzle migrations (auto on container start)
- [x] AES-256-GCM token encryption at rest

### Mavjud admin pagelar (UI tayyor)
- [x] 9 ta marketing pages (Rassilka, Promo, Sovg'alar, SMS, Kanal, Banner, Sodiqlik, Giveaway, Manbalar) — to'liq CRUD save flow (in-memory)
- [x] Tilda-style UIBuilder (mavjud sahifa)
- [x] Dashboard sidebar, header, search
- [x] 100+ component, framer-motion animatsiyalar

---

## ⚠️ Hali yo'q (kelajak iteratsiyalar)

### Backend bilan ulanmagan sahifalar (mock data ishlatadi)
Bu sahifalar UI tayyor, lekin haqiqiy backend ma'lumoti emas:
- `LeadsPage` — lid CRM (kelajakda Telegram lead'lardan)
- `ChatPage` — operator-mijoz suhbat (kelajakda bot orqali)
- `PlatformsPage` — Instagram/Facebook integratsiyalari
- `PaymentsPage` — to'lov tarixi (Click/Payme transactionlardan)
- `DeliveryPage` — kuryer/yetkazib berish boshqaruvi
- 9 ta marketing pages — mahalliy state, sahifa yangilansa yo'qoladi
- `WeeklySales`, `SalesByCategory`, `TrafficSources` — eski mock dashboard widgetlar

### Hali ishlamaydigan funksiyalar
- [ ] Multi-shop (1 admin → bir nechta do'kon)
- [ ] Multi-language (faqat O'zbek tili)
- [ ] PostgreSQL ishga tushishi (kod tayyor, lekin SQLite default)
- [ ] Redis (sessions, queue) — production uchun kerak
- [ ] Image upload (rasmlar URL orqali, S3/CDN yo'q)
- [ ] Telegram Payments (faqat Click/Payme)
- [ ] Push notification mijoz uchun (faqat bot xabarlari)
- [ ] Operator chat real-time (mavjud ChatPage mock)
- [ ] Lid trekingi (mavjud LeadsPage mock)
- [ ] Email yuborish (Rassilka mock holatda)
- [ ] SMS yuborish (Eskiz/Playmobile API integratsiyasi)
- [ ] Yandex.Metrica / Google Analytics
- [ ] Sentry monitoring (kod tayyor, dsn yo'q)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Test suite (Vitest skeleton tayyor, lekin testlar yozilmagan)

### Production checklist
- [x] Bot tokeni shifrlash
- [ ] HTTPS sertifikat (mijoz tomon)
- [ ] Domain DNS (mijoz tomon)
- [ ] Webhook rate limiting (Fastify rate-limit qo'shish)
- [ ] Database backup avtomatik
- [ ] Logging persistent (Pino → file/Loki)
- [ ] Uptime monitoring (`/health` ga ping)

---

## 📦 Tech Stack

### Frontend (`src/`, `dist/`)
- React 19 + TypeScript 5.9
- Vite 7 (singlefile plugin — bitta `index.html`)
- Tailwind CSS 4
- Framer Motion (animatsiyalar)
- Recharts (grafiklar)
- Lucide icons

### Backend (`server/`)
- Node.js 22 + TypeScript
- Fastify 5 (web framework)
- grammY (Telegram bot framework)
- Drizzle ORM + better-sqlite3
- @fastify/jwt + bcryptjs
- @fastify/websocket
- Zod (validatsiya)

### Infrastructure
- Docker + docker-compose
- nginx (SPA fallback, reverse proxy)
- Caddy (HTTPS auto, tavsiya etiladi)

---

## 📁 Repo strukturasi

```
shopflow/
├── server/                       # Backend
│   ├── src/
│   │   ├── bot/                  # grammY runtime + handlers
│   │   ├── db/                   # Drizzle schema + migrations
│   │   ├── integrations/         # MoySklad, Click, Payme
│   │   ├── lib/                  # crypto, events, uiSchema
│   │   ├── routes/               # auth, bots, orders, products,
│   │   │                         # miniapp, payments, integrations,
│   │   │                         # analytics, customers, ws, webhook
│   │   └── services/             # business logic
│   ├── drizzle/                  # SQL migrations
│   ├── Dockerfile
│   └── package.json
│
├── src/                          # Frontend
│   ├── miniapp/                  # Telegram WebApp pages
│   │   ├── pages/                # Catalog, Cart, Checkout, Orders
│   │   └── lib/                  # tg, api, format
│   ├── components/
│   │   ├── LiveOrdersPanel.tsx   # Real-time orders
│   │   ├── LiveCatalogPanel.tsx  # Real-time products
│   │   ├── LiveCustomersPanel.tsx # Real-time customers
│   │   ├── LiveAnalyticsPanel.tsx # Real-time analytics
│   │   ├── BotUiEditor.tsx       # Bot UI schema editor
│   │   ├── TelegramBotModal.tsx  # Bot connection
│   │   ├── IntegrationModal.tsx  # MoySklad/Click/Payme
│   │   └── ...                   # KPICards, RevenueChart, etc.
│   ├── lib/
│   │   ├── api.ts                # Backend client
│   │   └── notifications.tsx     # Toast + WebSocket
│   ├── App.tsx
│   └── main.tsx                  # /mini/* → MiniApp, else Dashboard
│
├── docs/
│   ├── TELEGRAM_BOT_PLAN.md      # To'liq arxitektura plani
│   └── DEPLOY.md                 # Deploy qo'llanmasi
│
├── docker-compose.yml
├── Dockerfile                    # Frontend
├── nginx.conf
├── .env.example
└── README.md                     # ushbu fayl
```

---

## 🚀 Deploy oqimi (mijoz uchun)

1. **Domain sozlash:** `app.shopflow.uz` + `api.shopflow.uz` DNS
2. **HTTPS:** Caddy yoki Cloudflare Tunnel
3. **`.env` to'ldirish:** JWT_SECRET, ENCRYPTION_KEY (random 64 hex)
4. **Build & up:** `docker-compose up -d --build`
5. **Login:** `https://app.shopflow.uz` → register
6. **Bot ulash:** Settings → Telegram Bot → BotFather token yopishtirish
7. **MoySklad ulash (ixtiyoriy):** Settings → MoySklad → Bearer token
8. **Click/Payme (ixtiyoriy):** Settings → har birini alohida sozlash

To'liq qadam-baqadam: [`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## 🧪 Endpoint xulasasi

### Public API (admin JWT bilan)
- `POST /api/auth/{register,login}` — admin auth
- `GET /api/auth/me` — joriy admin
- `POST /api/bots` — bot ulash (BotFather token)
- `GET /api/bots`, `DELETE /api/bots/:id`
- `GET/PUT /api/bots/:id/ui-schema` — bot UI editor
- `GET /api/orders`, `PATCH /api/orders/:id` — order boshqaruv
- `GET /api/orders/:id`, `GET /api/orders/stats`
- `GET /api/products`, `POST/PATCH/DELETE` — mahsulot CRUD
- `GET /api/products/categories`, `POST/PATCH/DELETE`
- `GET /api/customers`, `GET /api/customers/:id`
- `GET /api/analytics/{dashboard,revenue,top-products,sources,recent-orders,low-stock}`
- `POST /api/integrations/moysklad`, `POST /api/integrations/moysklad/sync`
- `POST /api/payments/{click,payme}` (admin sozlash)

### Mini App API (initData JWT bilan)
- `POST /api/miniapp/auth` — initData → JWT
- `GET /api/miniapp/catalog`, `GET /api/miniapp/products/:id`
- `GET /api/miniapp/ui-schema`
- `GET/PUT /api/miniapp/cart`
- `POST /api/miniapp/orders`, `GET /api/miniapp/orders`

### Webhooks (provider tomondan keladi)
- `POST /tg/webhook/:botId` — Telegram bot updates
- `POST /api/payments/click/:shopId` — Click prepare/complete
- `POST /api/payments/payme/:shopId` — Payme JSON-RPC

### WebSocket
- `GET /api/ws?token=...` — admin real-time event'lari (order.created, order.updated, product.updated)

---

## 🤝 Kelgusi rejalar

1. **PostgreSQL'ga ko'chirish** (drizzle config + driver)
2. **Operator chat** real-time (WebSocket + bot orqali)
3. **Multi-tenant SaaS** — bir ShopFlow instance, ko'p shop
4. **AI assistant** — buyurtma kelganda chat AI mijozga avtomatik javob
5. **Mobile admin app** (React Native)
6. **Yandex.Maps** integratsiyasi yetkazib berish uchun
7. **Telegram Stars** — Telegram'ning o'z to'lovi

---

## 📝 Litsenziya

Privat loyiha. Elmun Technologies.
