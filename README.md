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

- 🏢 **Multi-tenant** — har bir tashkilot uchun izolyatsiya qilingan ma'lumotlar
- 🔐 **JWT auth** — argon2 parol hash + JWT token + role-based access (OWNER/ADMIN/MANAGER/AGENT)
- 📥 **Kanal webhooklari** — Telegram bot, Instagram, web forma, WhatsApp va boshqalar uchun
  tenantga xos webhook URL
- 📊 **Real dashboard** — KPIlar, daromad trendi, kanal bo'yicha sotuvlar — barchasi DBdan
- 🎯 **Lidlar CRM** — status pipeline, interaksiyalar tarixi, tayinlash, filtrlash
- 🛒 **Buyurtmalar** — items, status, kanal, mijoz aloqasi
- 👥 **Mijozlar bazasi** — teglar, izohlar, sotib olishlar tarixi
- 🛠️ **Mahsulot katalogi** — SKU, kategoriya, narx, ombor
- 🚀 **Docker Compose** — Postgres + Backend + Frontend + Caddy (HTTPS) bir buyruqda

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

Ushbu PR'da bajarilgan:

- [x] Multi-tenant Prisma schema (Tenant, User, Lead, Order, Product, Customer, Channel, Interaction)
- [x] JWT auth + role guards + tenant scoping
- [x] CRUD: leads, orders, products, customers, channels
- [x] Dashboard aggregatsiyalari (KPI, trendlar, kanal bo'yicha sotuvlar)
- [x] Webhook endpointlar (umumiy lead + Telegram)
- [x] Frontend: AuthContext, API client, Login sahifasi
- [x] Frontend: Dashboard, Leads, Orders, Products, Customers, Platforms — barchasi API'dan
- [x] Sidebar refactor — grupplangan, collapsible, localStorage state, user info, logout
- [x] Demo raqamlar olib tashlandi — bo'sh holatlar va loading'lar bilan
- [x] Docker Compose: Postgres + Backend
- [x] Bootstrap skript: avto-generatsiya, seed

Kelajakda:

- [ ] Marketing modullari (rassilka, promokod, sovgalar, sms va h.k.) API integratsiyasi
- [ ] Analytics sahifasi — chuqurroq hisobotlar
- [ ] Settings sahifasi — tenant sozlamalari (currency, timezone, foydalanuvchilarni boshqarish)
- [ ] Chat: real-time WebSocket + kanal xabarlari
- [ ] Instagram/Facebook/WhatsApp Cloud API to'liq webhook integratsiyalari
- [ ] Payment provider'lar (Click, Payme, Uzcard)
- [ ] Yetkazib berish API'lari (Yandex, BTS, Express24)
- [ ] Export (CSV/Excel), email rassilka cron jobs

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
