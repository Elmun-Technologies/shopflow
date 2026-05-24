# 🛍️ ShopFlow — Multi-tenant E-commerce CRM

<div align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=for-the-badge&logo=fastify)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=for-the-badge&logo=prisma)
![Postgres](https://img.shields.io/badge/Postgres-16-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**Ko'p kanalli CRM va e-commerce boshqaruv paneli**

</div>

---

## 📋 Loyiha haqida

**ShopFlow** — multi-tenant CRM. Har bir tashkilot o'zining alohida ma'lumotlar bazasi,
foydalanuvchilari va kanallariga ega. Lidlar va buyurtmalar Instagram, Telegram, WhatsApp,
veb-sayt va boshqa kanallardan webhook orqali avtomatik qabul qilinadi.

### ✨ Asosiy xususiyatlar

#### Platforma
- 🏢 **Multi-tenant** — har bir tashkilot uchun izolyatsiya qilingan ma'lumotlar
- 🔐 **JWT auth + refresh tokens** — argon2 parol hash, role-based access (OWNER/ADMIN/MANAGER/AGENT)
- 📱 **Telegram Mini App** — mijoz tomon `/store/:slug` route, Telegram WebApp integratsiyasi
- 🌍 **i18n** — Uzbek + Russian (530+ kalit), istalgan paytda almashtirish
- 🎨 **Commerly UI Kit dizayni** — light theme cream + leaf green, modern e-commerce look
- 📲 **Mobile responsive** — desktop table → mobile card view avtomatik
- ⚡ **Sentry** error tracking + structured logs

#### Admin operatsiyalar
- 📊 **Real dashboard** — KPI sparkline'lar, daromad trendi, kategoriya/kanal taqsimoti, recent orders avatar list, low-stock alert
- 🎯 **Lidlar CRM** — status pipeline, interaksiyalar tarixi, tayinlash, filtrlash
- 🛒 **Buyurtmalar** — desktop table + mobile card view, status pills, print invoice (A4 PDF), CSV export
- 👥 **Mijozlar** — teglar, izohlar, sotib olishlar tarixi, CSV export
- 🛠️ **Mahsulotlar** — SKU/kategoriya/narx/ombor, **bulk import (CSV/Excel paste)**, bulk actions
- 🔔 **Notifications** — Header bell panel, 15s polling, **audio "ding"** + browser notification, mute toggle
- 🎵 **3 ovoz turi** — Ding / Bell / Chime, per-event prefs (orders/leads/chat alohida)
- ⌨️ **Keyboard shortcuts** — `g d/o/p/c/l/h/m/a/v/s` vim-uslubida + `?` help + ⌘K palette
- 🧩 **Integratsiyalar markazi** — 28 ta (Click, Payme, Uzum, Yandex Go, Eskiz SMS, Google Analytics, MoySklad...)

#### Mijoz tomon (Telegram Mini App)
- 🛍 **Premium dark UI** — Uzum-uslubidagi, smooth animatsiyalar
- 🎁 **Combo addons** — har mahsulot uchun "Bularni ham qo'shing"
- ⭐ **Sharhlar** — ✓ purchase qilgan mijoz yozadi, admin moderatsiyadan o'tkazadi
- 📍 **GPS yetkazib berish** — joriy joylashuv olish + saqlangan manzillar
- 💳 **Click / Payme / Uzum** webhook integratsiyalari (backend)
- 🎟 **Promo kodlar** — checkout vaqtida avtomatik qo'llaniladi
- 🤝 **Referral tizimi** — har do'st uchun bonus
- 🔔 **Telegram bildirishnomalar** — buyurtma status'i o'zgarganda
- 🛒 **Abandoned cart** eslatmalari — 1 soatdan keyin avtomatik

#### Infratuzilma
- 🚀 **Docker Compose** — Postgres 16 + Backend + Frontend + Caddy (HTTPS) bir buyruqda
- 🛠 **VPS bootstrap** — `bash bootstrap.sh` bilan to'liq setup
- 🔄 **DB backup** + restore

---

## 🏗 Arxitektura

```
┌──────────────────┐         ┌──────────────────┐
│  Frontend (Vite) │ ──────► │     Caddy        │
│  React + TS      │         │  /  + /api/*     │
└──────────────────┘         └────────┬─────────┘
                                      │
                                      ├──► nginx (static React)
                                      │
                                      └──► Backend (Fastify + Prisma)
                                                  │
                                                  ▼
                                             Postgres 16

    Tashqi kanallar (Telegram bot, Instagram webhook, ...)
                    │
                    └──► POST /api/webhooks/lead/{webhookKey}
```

### Texnologiyalar

| Qatlam | Texnologiya |
|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind 4, Recharts, Framer Motion |
| Backend | Fastify 5, TypeScript, Zod (validatsiya), Argon2, JWT |
| ORM / DB | Prisma 5, PostgreSQL 16 |
| Infra | Docker Compose, Caddy (HTTPS), GitHub Actions |

---

## 🚀 Ishga tushirish

### Mahalliy (development)

```bash
# 1. Postgres'ni ko'taring
docker compose up -d postgres

# 2. Backend
cd backend
cp .env.example .env  # DATABASE_URL, JWT_SECRET to'ldiring
npm install
npx prisma migrate dev
npm run seed  # birinchi tenant va admin
npm run dev

# 3. Frontend (boshqa terminalda)
cd ..
npm install
npm run dev
```

Login: `.env`dagi `SEED_EMAIL` va `SEED_PASSWORD`.

### Production (VPSda)

Bir buyruq bilan:

```bash
ssh root@<vps-ip>
curl -fsSL https://raw.githubusercontent.com/Elmun-Technologies/shopflow/main/scripts/bootstrap.sh | bash -s -- main shopflow.example.com admin@example.com
```

Bootstrap skripti:
- Docker o'rnatadi
- `.env` ni avtomatik generatsiya qiladi (POSTGRES parol va JWT secret xavfsiz)
- Postgres + Backend + Frontend + Caddy konteynerlarini ko'taradi
- Prisma migrate va seed bajaradi
- Birinchi admin akkauntni terminalga chiqaradi

---

## 📡 Kanal webhook ulash

Yangi kanal qo'shilgach (Platformalar sahifasi), tizim unga unikal `webhookKey` beradi.
URL: `https://your-domain.com/api/webhooks/lead/{webhookKey}`

### Veb-sayt forma uchun

```html
<form action="https://shopflow.example.com/api/webhooks/lead/CHANNEL_KEY" method="POST">
  <input name="name" required />
  <input name="phone" />
  <input name="email" />
  <button type="submit">Yuborish</button>
</form>
```

### Telegram bot uchun

BotFather'da webhook URL ni quying:
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://shopflow.example.com/api/webhooks/telegram/CHANNEL_KEY
```

### Generic JSON

```bash
curl -X POST https://shopflow.example.com/api/webhooks/lead/CHANNEL_KEY \
  -H "Content-Type: application/json" \
  -d '{"name":"Aliyor","phone":"+998901234567","value":500000}'
```

---

## 🔑 Auth flow

1. Frontend `POST /api/auth/register` (yangi tashkilot) yoki `POST /api/auth/login`
2. Backend JWT qaytaradi (`{tenantId, userId, role}` payload)
3. Frontend tokenni `localStorage` saqlaydi
4. Har bir API so'rovi `Authorization: Bearer <token>` qo'shadi
5. Backend tokendan `tenantId` ni chiqaradi va barcha querylarni shu tenant bilan cheklaydi
6. 401 da frontend avtomatik logout qiladi

---

## 📁 Loyiha tuzilmasi

```
shopflow/
├── src/                          # Frontend (React + Vite)
│   ├── api/
│   │   ├── client.ts             # JWT + fetch wrapper
│   │   └── endpoints.ts          # Typed API client (leads, orders, ...)
│   ├── contexts/
│   │   └── AuthContext.tsx       # JWT/tenant context
│   ├── hooks/
│   │   ├── useAsync.ts           # Loading/error/refetch hook
│   │   └── useFocusTrap.ts
│   ├── types/
│   │   └── api.ts                # Backend bilan moslashgan tiplar
│   ├── components/
│   │   ├── LoginPage.tsx
│   │   ├── Sidebar.tsx           # Grupp + collapsible
│   │   ├── Header.tsx
│   │   ├── DashboardPage komponentlari (KPICards, RevenueChart, ...)
│   │   ├── LeadsPage.tsx + LeadDetailModal.tsx
│   │   ├── OrdersPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── CustomersPage.tsx
│   │   ├── PlatformsPage.tsx     # Kanal CRUD + webhook URL
│   │   └── pages/                # Hali API'ga ulanmagan modullar (marketing)
│   └── utils/format.ts           # Pul, sana formatlash
├── backend/                       # Fastify backend
│   ├── prisma/
│   │   ├── schema.prisma         # Multi-tenant schema (Tenant, User, Lead, ...)
│   │   └── seed.ts
│   ├── src/
│   │   ├── server.ts             # Fastify entry
│   │   ├── plugins/{auth,prisma}.ts
│   │   ├── lib/codes.ts          # LID-2025001, ORD-7523 generatorlari
│   │   └── routes/
│   │       ├── auth.ts           # /api/auth/{register,login,me}
│   │       ├── tenants.ts        # /api/tenant
│   │       ├── leads.ts          # /api/leads + interactions
│   │       ├── orders.ts
│   │       ├── products.ts
│   │       ├── customers.ts
│   │       ├── channels.ts
│   │       ├── dashboard.ts      # KPIs, charts uchun aggregatsiyalar
│   │       └── webhooks.ts       # Lid qabul qilish endpointlari
│   └── Dockerfile
├── docker-compose.yml             # Postgres + Backend + Frontend + Caddy
├── Caddyfile                      # HTTPS + reverse proxy
├── Dockerfile                     # Frontend (nginx)
└── scripts/bootstrap.sh           # VPS bir-buyruqli setup
```

---

## 🛣 Yo'l xaritasi

### Bajarilgan (27+ PR, 2026 may)

**Platforma:**
- [x] Multi-tenant Prisma schema + JWT (refresh tokens) + RBAC
- [x] Docker Compose + Caddy HTTPS + VPS bootstrap
- [x] Sentry error tracking
- [x] DB backup/restore

**Dizayn:**
- [x] **Commerly UI Kit light theme** (cream + leaf green)
- [x] Mobile responsive (desktop table → mobile card)
- [x] Loading skeletons (spinners o'rniga)
- [x] Capsule-shape bar charts
- [x] Avatar circles + status pills + sparklines

**Funksiyalar:**
- [x] **i18n** uz/ru (530+ kalit, har joyda)
- [x] **Notifications panel** + audio ding + browser notification
- [x] **3 ovoz turi** + per-event preferences (orders/leads/chat)
- [x] **CSV export** Orders/Customers/Leads
- [x] **Print invoice** A4 PDF
- [x] **Bulk product import** CSV/Excel paste
- [x] **Keyboard shortcuts** (vim-uslubida `g d/o/p/...` + `?` help)
- [x] **⌘K command palette** (search + nav)
- [x] **Integratsiyalar markazi** — 28 ta (Click/Payme/Uzum/Yandex Go/Eskiz/...)
- [x] **MoySklad** real OAuth ulanish
- [x] **Low Stock Alert** dashboard widget

**Mini App:**
- [x] Premium Uzum-uslubidagi dark UI
- [x] Complete cart redesign
- [x] Trust badges, sharhlar, referral graph
- [x] GPS manzil + saqlangan manzillar
- [x] Promo kodlar

**Backend:**
- [x] Click/Payme/Uzum webhook handlers
- [x] Delivery module + tracking
- [x] Multi-tenant webhook URLs (security)
- [x] initData security (Telegram WebApp)

### Kelajakda

- [ ] Onboarding wizard (yangi tenant uchun)
- [ ] Reports — Daily/weekly/monthly PDF + email
- [ ] Real-time SSE/WebSocket (15s polling o'rniga)
- [ ] Team management (Invite teammates)
- [ ] Reviews moderation UI
- [ ] Order timeline view (visual journey)
- [ ] Customer segments — RFM analysis
- [ ] Bulk actions on Orders
- [ ] PWA + push notifications
- [ ] Sales Overview half-donut gauge ("85% Sales Growth")
- [ ] Backend real ulanish — Click/Payme setup UI bog'lash, Eskiz SMS API, Yandex Go delivery
- [ ] Google Analytics / Yandex Metrika auto-injection
- [ ] Custom Webhook (POST order.created)

---

## 🧪 Testing

```bash
npm run test           # frontend testlar
npm run typecheck      # TS tekshiruvi
cd backend && npx tsc --noEmit  # backend TS
```

---

## 📜 Litsenziya

MIT
