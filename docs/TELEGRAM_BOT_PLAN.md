# ShopFlow — Telegram Bot va integratsiyalar arxitekturasi

**Status:** Plan (kod yozilmagan)
**Maqsad:** Mijozga production-grade ishlaydigan tizim. ShopFlow dashboard bot va integratsiyalarni to'liq boshqaradi. Xaridor Telegram orqali xarid qiladi.

---

## 1. Yuqori darajali tasvir

```
┌─────────────────────────────────────────────────────────────┐
│              SHOPFLOW DASHBOARD (frontend)                   │
│  React 19 + Vite + Tailwind                                  │
│  - Telegram bot konfiguratsiya (token, webhook, Mini App)    │
│  - UIBuilder → bot menu schema yaratadi                      │
│  - MoySklad ulash (OAuth)                                    │
│  - Buyurtmalar real-time (WebSocket orqali)                  │
└─────────────────────────────────────────────────────────────┘
                           ▲
                  REST + WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 SHOPFLOW BACKEND (Node.js)                   │
│  Fastify + grammY + Drizzle ORM                              │
│  - /api/* — dashboard uchun REST                             │
│  - /tg/webhook/:botId — Telegram dan webhook qabul qiladi   │
│  - /miniapp/* — Telegram WebApp uchun static + API           │
│  - /moysklad/webhook — MoySklad sync                         │
│  - WebSocket — real-time order push                          │
└─────────────────────────────────────────────────────────────┘
                ▲                            ▲
                │                            │
        ┌───────┴────────┐         ┌────────┴──────────┐
        ▼                ▼         ▼                   ▼
  ┌──────────┐    ┌──────────┐  ┌──────────┐    ┌──────────────┐
  │PostgreSQL│    │  Redis   │  │ Telegram │    │   MoySklad   │
  │ (orders, │    │(sessions,│  │   Bot    │    │ (catalog,    │
  │ products,│    │  queue)  │  │   API    │    │  inventory)  │
  │  users,  │    └──────────┘  └──────────┘    └──────────────┘
  │  bots)   │
  └──────────┘
```

---

## 2. Texnologiyalar

### Backend
| Komponent | Tanlov | Sabab |
|-----------|--------|-------|
| Runtime | **Node.js 20 + TypeScript** | Frontend bilan bir til, type sharing |
| Web framework | **Fastify** | Express'dan tezroq, schema validation, plugin ekosistemasi |
| Bot framework | **grammY** | Zamonaviy, TS-first, multi-bot support, plugin system |
| ORM | **Drizzle ORM** | Type-safe, lightweight, migration friendly |
| Database | **PostgreSQL 16** | Production-grade, JSON support (UIBuilder schemalar uchun) |
| Cache/queue | **Redis 7** | Bot session, rate limit, BullMQ orqali async tasks |
| Validation | **Zod** | Frontend bilan baham ko'rish mumkin |
| Auth | **Lucia Auth** yoki **JWT + refresh** | Dashboard admin login uchun |
| Logging | **Pino** | Fastify bilan birga keladi |
| Testing | **Vitest + Supertest** | Vite ekosistemasi, frontend bilan bir test runner |

### Frontend qo'shimchalari
| Paket | Vazifa |
|-------|--------|
| `@telegram-apps/sdk-react` | Mini App SDK (haptic, theme, BackButton) |
| `@tanstack/react-query` | Server state (caching, refetch, optimistic updates) |
| `socket.io-client` | Real-time order updates |
| `zod` | API response validation |

### DevOps
- **Docker + Docker Compose** — bir buyruqda butun stack ishga tushadi
- **Migrations**: Drizzle Kit
- **Hosting**: Mijoz tanlaydi — Railway / Render / Hetzner VPS / o'zining serveri

---

## 3. Repo strukturasi

```
shopflow/
├── apps/
│   ├── web/              # Hozirgi React app (ko'chiriladi)
│   │   └── src/
│   └── api/              # Yangi backend
│       ├── src/
│       │   ├── routes/   # Fastify route'lari
│       │   ├── bot/      # grammY bot logikasi
│       │   ├── miniapp/  # Telegram WebApp endpoints
│       │   ├── integrations/
│       │   │   └── moysklad/
│       │   ├── db/       # Drizzle schema + migrations
│       │   ├── services/ # business logic
│       │   └── index.ts
│       └── drizzle.config.ts
├── packages/
│   ├── shared/           # Frontend + backend baham types/schemas
│   │   └── src/
│   │       ├── schemas/  # Zod schemas
│   │       └── types/
│   └── ui/               # Optional: shared UI components
├── docker-compose.yml
├── .env.example
└── package.json          # pnpm workspace
```

**Migratsiya:** hozirgi `src/` → `apps/web/src/`. `package.json` pnpm workspace'ga aylanadi.

---

## 4. Database sxemasi (asosiy jadvallar)

```sql
-- Foydalanuvchilar (shop adminlari)
users (
  id uuid PK,
  email text unique,
  password_hash text,
  name text,
  role enum('owner','manager','staff'),
  created_at timestamptz
)

-- Mijoz do'koni (multi-tenant)
shops (
  id uuid PK,
  owner_id uuid → users,
  name text,
  domain text,
  currency text default 'UZS',
  created_at timestamptz
)

-- Telegram botlar (har shop bir nechta botga ega bo'lishi mumkin)
bots (
  id uuid PK,
  shop_id uuid → shops,
  token text encrypted,        -- pgcrypto bilan shifrlangan
  username text,                -- @username
  bot_id bigint,                -- telegram bot ID
  webhook_secret text,
  status enum('active','paused','error'),
  last_error text,
  miniapp_url text,
  ui_schema jsonb,              -- UIBuilder yaratgan menu schema
  created_at timestamptz
)

-- Telegram foydalanuvchilari (xaridorlar)
tg_users (
  id uuid PK,
  shop_id uuid → shops,
  tg_user_id bigint,
  username text,
  first_name text,
  last_name text,
  phone text,
  language_code text,
  created_at timestamptz,
  UNIQUE (shop_id, tg_user_id)
)

-- Mahsulotlar
products (
  id uuid PK,
  shop_id uuid → shops,
  external_id text,             -- MoySklad ID
  sku text,
  name text,
  description text,
  price numeric(12,2),
  stock int,
  category_id uuid,
  images text[],
  active bool,
  updated_at timestamptz
)

categories (
  id uuid PK,
  shop_id uuid → shops,
  parent_id uuid → categories,
  name text,
  external_id text,
  sort_order int
)

-- Buyurtmalar
orders (
  id uuid PK,
  shop_id uuid → shops,
  order_number text unique,     -- SH-2026-00001
  tg_user_id uuid → tg_users,
  source enum('telegram','miniapp','admin'),
  status enum('pending','confirmed','preparing','shipping','delivered','cancelled'),
  payment_status enum('unpaid','paid','refunded'),
  payment_method text,
  subtotal numeric(12,2),
  delivery_fee numeric(12,2),
  total numeric(12,2),
  delivery_address jsonb,
  customer_phone text,
  notes text,
  external_id text,             -- MoySklad order ID
  created_at timestamptz,
  updated_at timestamptz
)

order_items (
  id uuid PK,
  order_id uuid → orders,
  product_id uuid → products,
  quantity int,
  price numeric(12,2),
  total numeric(12,2)
)

-- Savatlar (savedem savat — telegram session)
carts (
  id uuid PK,
  shop_id uuid → shops,
  tg_user_id uuid → tg_users,
  items jsonb,                  -- [{product_id, qty}]
  updated_at timestamptz
)

-- Integratsiyalar (MoySklad, Click, Payme)
integrations (
  id uuid PK,
  shop_id uuid → shops,
  type enum('moysklad','click','payme'),
  credentials jsonb encrypted,   -- token, secret, etc.
  config jsonb,                  -- mapping, sync settings
  status enum('connected','error','disabled'),
  last_sync_at timestamptz,
  created_at timestamptz
)

-- Sync log (debug uchun)
sync_logs (
  id bigserial PK,
  integration_id uuid,
  direction enum('in','out'),
  entity text,                   -- 'product','order'
  status enum('success','error'),
  payload jsonb,
  error text,
  created_at timestamptz
)

-- Bot xabar log (debug, analytics)
bot_messages (
  id bigserial PK,
  bot_id uuid → bots,
  tg_user_id uuid,
  direction enum('in','out'),
  message_type text,
  payload jsonb,
  created_at timestamptz
)
```

---

## 5. Bot konfiguratsiya oqimi (BotFather → ishlaydi)

### Foydalanuvchi nuqtai nazaridan
1. Mijoz ShopFlow'ga login qiladi
2. **Settings → Integratsiyalar → Telegram Bot → Ulash**
3. Modal ochiladi:
   - "BotFather'ga o'ting → /newbot → tokenni shu yerga yopishtiring"
   - Token kiritiladi va "Tekshirish va ulash" bosiladi
4. Backend tokenni tekshiradi (`getMe` chaqiriladi), botni DB'ga saqlaydi
5. Backend webhook o'rnatadi: `setWebhook(https://api.shopflow.uz/tg/webhook/{botId})`
6. Mini App URL avtomatik o'rnatiladi: `setChatMenuButton(web_app: https://shop.shopflow.uz/mini/{botId})`
7. ✅ Bot ishlaydi — admin yashil "Connected" badge ko'radi

### Texnik oqim (backend)
```typescript
POST /api/bots
body: { token: string }
1. await tg.getMe(token) → bot info olamiz
2. webhookSecret = randomBytes(32).hex
3. INSERT INTO bots (...)
4. await tg.setWebhook({
     url: `${PUBLIC_URL}/tg/webhook/${botId}`,
     secret_token: webhookSecret,
     allowed_updates: ['message','callback_query','pre_checkout_query','web_app_data']
   })
5. await tg.setChatMenuButton({
     menu_button: { type: 'web_app', text: 'Do\'kon', web_app: { url: miniappUrl } }
   })
6. return bot
```

---

## 6. Bot funksionalligi (xaridor uchun)

### Asosiy oqim
```
/start
  ↓
Welcome xabar + 2 ta tugma:
  [📱 Do'konni ochish (Mini App)]
  [📋 Buyurtmalarim]
  ↓
Mini App'da: kategoriya → mahsulot → savat → checkout
  ↓
Telegram WebApp.sendData() bilan order ma'lumoti backend'ga yuboriladi
  ↓
Backend buyurtmani DB'ga yozadi
  ↓
1. Foydalanuvchiga: "✅ Buyurtma #SH-2026-00123 qabul qilindi"
2. Adminga (dashboard): WebSocket orqali real-time push
3. MoySklad: yangi buyurtma yaratiladi
```

### Inline tugmalar / klassik bot menu
UIBuilder'dan kelgan schema asosida fallback menyu (Mini App ishlamasa):
- Kategoriyalar ko'rsatiladi → callback_query orqali navigatsiya
- Mahsulot tugmasi → photo + name + price + "Savatga qo'shish"

### To'lov
- **Telegram Payments** (Stripe/Click via @ShopBot tokeni)
- Yoki: buyurtma → operator qo'ng'iroq qiladi → naqd / karta orqali to'lash

---

## 7. Telegram Mini App (frontend)

### Struktura
```
apps/web/src/miniapp/
├── App.tsx          # Telegram theme, BackButton, MainButton
├── pages/
│   ├── Home.tsx
│   ├── Categories.tsx
│   ├── ProductList.tsx
│   ├── ProductDetail.tsx
│   ├── Cart.tsx
│   └── Checkout.tsx
└── lib/
    ├── tg.ts        # Telegram SDK wrapper
    └── api.ts       # Backend API client
```

### Auth
- Telegram WebApp `initData` ni backend'ga yuboradi
- Backend `validateInitData(initData, botToken)` qiladi (HMAC-SHA-256)
- ✅ Validatsiyadan o'tsa → `tg_user` yaratiladi/topiladi → JWT qaytariladi

### URL
- `https://shop.shopflow.uz/mini/{botSlug}` — har shop o'z slug'i
- Telegram MainButton sticky `Buyurtma berish` (savatda mahsulot bo'lsa)

---

## 8. UIBuilder ↔ Bot interfeys integratsiyasi

### Konsepsiya
UIBuilder hozir mavjud (`UIBuilderPage.tsx`). Uni kengaytirayman: bot menu/Mini App'ning ko'rinishini drag-drop bilan qurish.

### Schema misol
```jsonc
{
  "version": 1,
  "screens": [
    {
      "id": "home",
      "title": "Bosh sahifa",
      "blocks": [
        { "type": "banner", "image": "...", "link": "category:perfumes" },
        { "type": "category_grid", "limit": 6 },
        { "type": "featured_products", "tag": "new" }
      ]
    },
    {
      "id": "product",
      "title": "Mahsulot",
      "blocks": [
        { "type": "image_gallery" },
        { "type": "title_price" },
        { "type": "description" },
        { "type": "add_to_cart_button", "label": "Savatga qo'shish" }
      ]
    }
  ],
  "theme": {
    "primary": "#10b981",
    "background": "var(--tg-theme-bg-color)"
  }
}
```

### Render strategiyasi
- **Mini App**: schema'ni react renderer interpretatsiya qiladi (mavjud bloklar)
- **Klassik bot menu**: `screens[].blocks` → Telegram inline keyboard'ga aylantiriladi (limited blocks)

### Versiya boshqaruvi
- Drafts vs Published (UIBuilder'da `Saqlash` → draft, `Publish` → live)
- Rollback tugmasi

---

## 9. MoySklad integratsiyasi

### OAuth oqimi
1. Mijoz "MoySklad ulash" bosadi
2. `/api/integrations/moysklad/oauth/start` → MoySklad authorize URL
3. MoySklad'da ruxsat beradi → callback `/api/integrations/moysklad/oauth/callback?code=...`
4. Backend access_token oladi, `integrations` jadvaliga shifrlab saqlaydi

### Sync
- **Pull (MoySklad → ShopFlow):**
  - Mahsulotlar (har 15 daqiqada cron yoki webhook)
  - Stock balance (real-time webhook)
- **Push (ShopFlow → MoySklad):**
  - Yangi buyurtma → MoySklad'da `customerorder` yaratiladi
  - Status o'zgarganda sync

### Webhook
MoySklad webhook'lari `/moysklad/webhook` ga keladi:
```typescript
POST /moysklad/webhook
body: { events: [{ action: 'CREATE'|'UPDATE'|'DELETE', meta: {...} }] }
```

### Mapping
- ShopFlow `products.external_id` ↔ MoySklad assortment ID
- ShopFlow `orders.external_id` ↔ MoySklad customerorder ID
- Konflikt strategiyasi: MoySklad master (stock uchun), ShopFlow master (custom field'lar uchun)

---

## 10. Xavfsizlik

- **Bot tokenlari**: PostgreSQL `pgcrypto` bilan shifrlangan saqlash
- **Webhook**: Telegram `secret_token` header tekshiriladi
- **Mini App auth**: `validateInitData` HMAC tekshiruv
- **Dashboard auth**: JWT (15 daq) + refresh token (httpOnly cookie)
- **Rate limiting**: Fastify rate-limit plugin (har bot uchun alohida)
- **CSRF**: SameSite cookies + state parameter OAuth uchun
- **Audit log**: muhim actionlar (token o'zgartirish, integration ulash) loglanadi

---

## 11. Hosting va deploy (mijoz uchun)

### Eng oddiy variant — Railway / Render
1. Mijoz Railway hisob ochadi
2. ShopFlow repo'sini ulaydi
3. PostgreSQL + Redis qo'shiladi (bir bosishda)
4. Environment variables qo'yiladi
5. Deploy bosiladi
**Narxi:** ~$15-30/oy

### O'rta — VPS (Hetzner / Contabo)
- Docker Compose bilan 1 ta VPS'da hammasi (~$5-10/oy)
- Caddy reverse proxy + auto HTTPS
- Backup script

### Production-grade — managed
- Backend: AWS ECS / DigitalOcean App Platform
- Database: managed Postgres (RDS / Supabase / Neon)
- CDN: Cloudflare
- Monitoring: Sentry + UptimeRobot

**.env.example:**
```bash
PUBLIC_URL=https://api.shopflow.uz
DATABASE_URL=postgres://...
REDIS_URL=redis://...
JWT_SECRET=...
ENCRYPTION_KEY=... # bot tokenlarni shifrlash uchun (32 byte)
SENTRY_DSN=...
```

---

## 12. Bosqichlar (real timeline)

| Bosqich | Mazmuni | Ish hajmi | Sessiya |
|---------|---------|-----------|---------|
| **0. Plan tasdig'i** | Bu hujjat ko'rib chiqilsin | — | hozir |
| **1. Backend fundament** | Monorepo, Fastify, DB schema, auth, basic CRUD | 1-2 sessiya | keyingi |
| **2. Bot ulash** | Token validation, webhook setup, basic /start | 1 sessiya | |
| **3. Mini App MVP** | Catalog, cart, checkout, initData auth | 2 sessiya | |
| **4. Order flow** | Order create, status, real-time push (WS) | 1 sessiya | |
| **5. UIBuilder schema** | Schema format, renderer, save/publish | 2 sessiya | |
| **6. MoySklad** | OAuth, product sync, order push, webhooks | 2 sessiya | |
| **7. To'lov** | Click + Payme + Telegram Payments | 1-2 sessiya | |
| **8. Polish + deploy** | Docker, env, monitoring, mijozga topshirish | 1 sessiya | |

**Jami:** ~12-14 sessiya (productive sessiyalar bo'lganda).

---

## 13. Plandagi ochiq savollar (mijozdan tasdiqlash kerak)

1. **Domain**: ShopFlow uchun real domen bormi? (`shopflow.uz`?)
2. **Brand**: bot WebApp ichida ShopFlow brending bo'ladimi yoki har mijoz alohida brand?
3. **Multi-shop**: bir admin bir nechta do'konni boshqaradimi?
4. **Til**: faqat O'zbek tili yoki ru/en ham?
5. **To'lov tizimlari**: birinchi kim — Click? Payme? Stripe (xalqaro)?
6. **MoySklad tariff**: hozirgi Plan-mi yoki Trial?
7. **Hosting**: mijoz qaerda hosting qilmoqchi?
8. **Statistika**: Yandex.Metrica / Google Analytics integratsiyasi kerak emasmi?

---

## 14. Risk register

| Risk | Ehtimollik | Ta'sir | Yumshatish |
|------|-----------|--------|------------|
| Telegram Bot API limitlari (30 msg/s) | O'rta | Yuqori | Queue + rate limiter |
| MoySklad API o'zgarishi | Past | Yuqori | Versioned client, contract tests |
| Bot tokeni leaked bo'lishi | O'rta | Yuqori | Encryption at rest, rotation tugmasi |
| Webhook downtime | O'rta | O'rta | Update queue, retry logic |
| UIBuilder schema breaking change | Past | Yuqori | Schema versioning + migration scripts |

---

## 15. Keyingi qadam

Agar bu plan tasdiqlansa, **Bosqich 1 — Backend fundament**'dan boshlaymiz:
1. Monorepo'ga ko'chirish (frontend `apps/web/`)
2. `apps/api/` skeleton + Fastify + Drizzle
3. PostgreSQL Docker Compose
4. Migrations + asosiy CRUD endpoints
5. Dashboard auth (login sahifa qo'shamiz)

Tasdiqlasangiz — boshlayman.
