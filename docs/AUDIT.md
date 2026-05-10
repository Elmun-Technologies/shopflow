# ShopFlow Audit — 2026.05.10

To'liq holat hisoboti: nima bor, nima yo'q, nima qilish kerak.

## 📊 Umumiy raqamlar

- **18 ta katta commit** (audit/fix → multi-tenant SaaS)
- **Backend:** ~3,500 qator TypeScript
- **Frontend:** ~21,000 qator TSX
- **DB jadvallar:** 17 ta
- **API endpoints:** 60+
- **PR #2:** open, +20K qator

---

## ✅ TAYYOR (production-ready)

### 🔧 Backend infrastructure
- [x] Fastify server + JWT auth + bcryptjs
- [x] Drizzle ORM + SQLite (Postgres-ready)
- [x] AES-256-GCM bot/credentials shifrlash
- [x] WebSocket real-time push
- [x] Generic event bus
- [x] Pino logger
- [x] CORS + sensible plugin
- [x] 17 ta DB jadval (users, shops, bots, products, orders, ...)

### 🤖 Telegram bot (multi-tenant)
- [x] Token kiritish → avtomatik validatsiya
- [x] Webhook va polling rejimlar
- [x] Mini App URL avtomatik aniqlanadi (window.location.origin)
- [x] `setChatMenuButton` avtomatik
- [x] grammY session middleware (cart + checkout state)
- [x] `/start`, `/help`, `/catalog`, `/cart`, `/orders`, `/contact`
- [x] Rich /start: persistent ReplyKeyboard (6 tugma)
- [x] Mahsulot rasmlar bilan, eski narx, chegirma %, reyting
- [x] Inline buttons: "Savatga qo'shish", qty +/-
- [x] Search (matn yozilsa)
- [x] FSM checkout (5 qadam: telefon, ko'cha, uy, xonadon, izoh)
- [x] Bot orqali avtomatik tasdiq xabarlari
- [x] Order status o'zgarsa - mijozga xabar

### 📱 Mini App (Telegram WebApp)
- [x] `initData` HMAC-SHA-256 validatsiya
- [x] Yorug' tema (oq fon, e-commerce style)
- [x] BottomNav (5 tab: Bosh, Katalog, Savat, Sevimli, Profil)
- [x] HomePage (search + categories + featured + banners)
- [x] Catalog (filter, qidiruv)
- [x] ProductCard (eski narx, chegirma %, ❤️, ⭐, "Sotib olish")
- [x] Product detail
- [x] Cart (+ tejov ko'rsatkichi)
- [x] Checkout (telefon, manzil, to'lov turi)
- [x] Favorites (toggle, ro'yxat)
- [x] Profile (statistika, buyurtma tarixi)
- [x] Telegram theme + BackButton + HapticFeedback

### 📊 Admin Dashboard
- [x] Login/Register page (proper auth)
- [x] Dashboard (Robosell-style):
  - Period selector (Bugun/Hafta/Oy/Chorak/Yil)
  - 3 katta KPI (Tushum, Buyurtmalar, Mijozlar) breakdown bilan
  - Earning statistics chart
  - Order statistics (manba bo'yicha)
  - Traffic source donut
  - Top 10 mahsulot
  - Orders peak chart (soat bo'yicha)
  - Top 10 mijoz table
- [x] LiveOrdersPanel (real-time, drawer, status)
- [x] LiveCatalogPanel (CRUD modal)
- [x] LiveCustomersPanel (Telegram mijozlar)
- [x] LiveAnalyticsPanel
- [x] LivePaymentsPanel
- [x] LiveDeliveryPanel (kanban)
- [x] LiveLeadsPanel (omnichannel)
- [x] WebSocket real-time + toast + ovoz signal
- [x] Header logout tugmasi

### 🎨 Bot UI Editor
- [x] Banner CRUD (rasm, sarlavha, action)
- [x] Sectionlar (kategoriyalar, mahsulotlar, matn)
- [x] Schema bilan saqlanadi
- [x] Mini App schema'ga ko'ra render

### 🔌 MoySklad integratsiya (TO'LIQ)
- [x] Bearer token / Login-parol auth
- [x] Avtomatik organisation/store tanlash
- [x] Mahsulot import (kategoriya, narx, rasmlar)
- [x] Stock import (jonli qoldiqlar)
- [x] Buyurtma push (counterparty avto-yaratish)
- [x] Webhook receiver (real-time)
- [x] Cron: 15 daq full sync, 5 daq stock sync
- [x] Order auto-push listener
- [x] Sync logs (admin UI'da ko'rinadi)

### 💳 To'lov tizimlari
- [x] Click Merchant API (prepare/complete, MD5 sign)
- [x] Payme JSON-RPC (5 method, Basic auth)
- [x] payments table (provider, txnId, state)
- [x] Avtomatik order paymentStatus yangilanish
- [x] Admin'da to'lovlar ro'yxati

### 📡 Omnichannel CRM (Lidlar)
- [x] 13 ta manba (telegram, miniapp, web_form, instagram, ...)
- [x] 5 ta status (new → contacted → qualified → converted → lost)
- [x] Telegram /start → avtomatik lid
- [x] Order kelganda → lid "converted"
- [x] Public form endpoint (web saytdan)
- [x] LeadDrawer (status, prioritet, izoh)

### 🐳 DevOps
- [x] Dockerfile (frontend + backend)
- [x] docker-compose.yml
- [x] nginx.conf (SPA fallback, /api proxy, WebSocket)
- [x] .env.example
- [x] GitHub Actions CI (TS check + build + Docker)
- [x] Drizzle migrations (auto on start)
- [x] Health endpoint /health
- [x] PostgreSQL migration guide
- [x] Deploy.md (to'liq qo'llanma)

### 🔐 Xavfsizlik
- [x] JWT auth (15 daq + refresh)
- [x] Bot tokenlari shifrlangan (AES-256-GCM)
- [x] MoySklad/Click/Payme credentials shifrlangan
- [x] Telegram webhook secret_token tekshiruv
- [x] Mini App initData HMAC tekshiruv
- [x] Click signature MD5 tekshiruv
- [x] Payme Basic auth tekshiruv
- [x] CSRF (SameSite cookies)
- [x] ErrorBoundary (UI xato'lari uchun)

---

## ⚠️ MOCK DATA (UI bor, lekin backend yo'q)

Bu sahifalar UI tayyor, lekin haqiqiy backend bilan to'liq ulanmagan.
Eski mock fayllar `src/data/*.ts` da turibdi:

### Mock holatda qolgan komponentlar
| Komponent | Status | Imkoniyat |
|-----------|--------|-----------|
| `ChatPage` | 🟡 Mock | Operator chat (real-time bot xabarlari kerak) |
| `PlatformsPage` | 🟡 Mock | Instagram/Facebook/WhatsApp integration kartalari |
| `SettingsPage` (asosiy qism) | 🟡 Mock | Profile, security, API keys (Telegram qism ulangan) |
| `UIBuilderPage` | 🟡 Mock | Mavjud Tilda-style page builder |

### Marketing 9 sahifa (in-memory)
Hammasi CRUD ishlaydi, lekin **sahifa yangilansa yo'qoladi** (DB'ga saqlanmaydi):
- RassilkaPage (email kampaniyalar)
- PromoPage (promo kodlar)
- SovgalarPage (sovg'alar)
- SmsPage (SMS kampaniyalar)
- KanalPage (kanal postlari)
- BannerPage (bannerlar)
- IzohlarPage (sharhlar)
- SodiqlikPage (sodiqlik dasturi)
- GiveawayPage (giveaway)
- ManbaPage (marketing manbalari)
- TranzaksiyalarPage (ball tranzaksiyalari)
- SegmentsPage

### Eski dashboard widgetlari (foydalanilmaydi)
- `KPICards.tsx`, `RevenueChart.tsx`, `SalesByCategory.tsx`,
  `WeeklySales.tsx`, `RecentOrders.tsx`, `TopProducts.tsx`,
  `TrafficSources.tsx` — yangi `Dashboard/*` bilan almashtirildi

---

## ❌ HALI YO'Q (kelajak iteratsiyalar)

### Texnik infrastruktura
- [ ] **PostgreSQL prod konfiguratsiya** (kod tayyor, faol emas)
- [ ] **Redis** (sessions, queue, BullMQ) — production scaling uchun
- [ ] **S3/R2 image upload** — hozir faqat URL kiritish
- [ ] **Sentry monitoring** (DSN env'da)
- [ ] **Rate limiting** (`@fastify/rate-limit`)
- [ ] **Webhook IP whitelist** (Telegram IP'lari)
- [ ] **Logging persistent** (Pino → Loki yoki fayl)
- [ ] **Backup automation** (cron)
- [ ] **Multi-shop bir admin** uchun (hozir 1 admin = 1 shop)
- [ ] **Multi-language** (faqat O'zbek)

### Test
- [ ] **Unit testlar** (Vitest skeleton tayyor)
- [ ] **Integration testlar** (Supertest)
- [ ] **E2E testlar** (Playwright)

### To'lov
- [ ] **Telegram Payments** (Stripe/Click via @ShopBot)
- [ ] **Uzum/Apelsin** (qo'shimcha tizimlar)
- [ ] **Refund/return** flow

### Bot funksionalligi
- [ ] **Order status tracking** xaridor uchun (link bilan)
- [ ] **Promo kod kiritish** savatda
- [ ] **Mijoz sharhi** yozish (after delivery)
- [ ] **Loyalty points** ishlatish (yig'ish bor, yechish yo'q)
- [ ] **SMS yuborish** (Eskiz, Playmobile API)
- [ ] **Email yuborish** (Sendgrid, SES)

### Marketing modullari (DB persistence)
- [ ] **9 ta marketing sahifa** → backend DB'ga saqlash
- [ ] **Email rassilka** real yuborish
- [ ] **SMS rassilka** real yuborish
- [ ] **Kanal posting** Telegram'ga real publish
- [ ] **Promo kod tekshirish** Mini App checkout'da
- [ ] **Sovg'a aksiyasi** real ishlash (cart'da)
- [ ] **Sodiqlik ballari** ishlatish (savatda discount)
- [ ] **Giveaway** mijozlar ro'yxati bilan
- [ ] **Reviews moderation** (admin qabul qiladi/rad etadi)

### Boshqa integratsiyalar
- [ ] **Instagram Direct API** (Meta Graph)
- [ ] **Facebook Messenger** integration
- [ ] **WhatsApp Business API**
- [ ] **Yandex Maps** (yetkazib berish marshrutlari)
- [ ] **Google Maps** (mahsulot manzili)
- [ ] **Yandex.Metrica / GA** analytics
- [ ] **1C** integratsiyasi
- [ ] **Avtomatik chiqim** (E-faktura, soliq)

### Admin pagelar (live ulash)
- [ ] **ChatPage** real-time operator chat (bot_messages dan)
- [ ] **PlatformsPage** real Instagram/FB/WhatsApp ulanish
- [ ] **SettingsPage** profile + API keys persistent
- [ ] **UIBuilderPage** real ko'p sahifali builder

### Bot kengaytirish
- [ ] **Til o'zgartirish** (uz/ru/en)
- [ ] **Voice xabarlar** qabul qilish
- [ ] **Inline mode** (boshqa chatlardan)
- [ ] **Group bot** mode (savdo guruhlari uchun)
- [ ] **Scheduler** (taklif xabarlari)

### Mijozga ko'rinmas qism (super-admin)
- [ ] **Multi-tenant boshqaruv** paneli (super-admin: do'konlar ro'yxati)
- [ ] **Subscription billing** (Free/Basic/Pro tarif rejalari)
- [ ] **Usage limits** (har shop uchun bot soni, mahsulot soni)
- [ ] **Tariff cheklovlari** UI (locks)
- [ ] **Audit log** (admin actionlari)
- [ ] **Impersonation** (super-admin har shop'ga kira oladi)

---

## 🎯 PRIORITET BO'YICHA TAVSIYA

### Bosqich 11 — Marketing modullari ishga tushirish (1-2 sessiya)
**Eng katta ta'sir.** 9 ta sahifani persistent qilish + 4 ta real yuborish:
- DB jadvallar (yoki shop_settings JSON)
- Email rassilka backend (Sendgrid)
- SMS rassilka (Eskiz/Playmobile)
- Promo kod Mini App'da tekshiruv
- Loyalty ballar savatda

### Bosqich 12 — Operator chat (1 sessiya)
- ChatPage'ni `bot_messages` jadvali bilan ulash
- Real-time WebSocket
- Bot orqali admin → mijoz xabar yuborish

### Bosqich 13 — Image upload (1 sessiya)
- S3/R2/Cloudinary bilan
- Mahsulot rasm yuklash UI
- Mini App'da tezkor rasmlar

### Bosqich 14 — Tests (1 sessiya)
- Vitest critical path
- Supertest API testlari
- CI'da test bosqichi

### Bosqich 15 — Multi-tenant boshqaruv (2-3 sessiya)
- Super-admin paneli
- Subscription tariff rejalari
- Usage tracking
- Auto-billing

### Bosqich 16 — Production hardening (1 sessiya)
- Redis + BullMQ
- Rate limiting
- Sentry
- Backup cron
- PostgreSQL'ga ko'chirish
- Stress test

---

## 🐛 MA'LUM MUAMMOLAR

### Eski fayllarni tozalash kerak
- `src/components/{KPICards,RevenueChart,SalesByCategory,WeeklySales,RecentOrders,TopProducts,TrafficSources}.tsx` — endi foydalanilmaydi, lekin import qilingan bo'lishi mumkin
- `src/miniapp/pages/{CartPage,CatalogPage,CheckoutPage,ProductPage}.tsx` — eski versiyalar (NewX bilan almashtirildi)
- `src/data/*.ts` — mock data fayllar (kelajakda backend bilan ulashda kerak emas)

### TODO'lar / hack'lar kodda
- `cost of sales = 60% revenue` (taxminiy) — `costPrice` field qo'shish kerak
- Mock data hali ham ba'zi sahifalarda referenced
- `webhook secret rotation` yo'q (manual qilish kerak bo'lsa)

### UX masalalar
- Server o'chsa frontend xato beradi, lekin reconnect logikasi WebSocket'da bor
- Mobile responsive ba'zi joylar tekshirilmagan
- Loading skeletonlar yo'q (faqat spinner)

---

## 📈 STATISTIKA

| Metrika | Qiymat |
|---------|--------|
| Backend fayllar | 30+ |
| Frontend tsx fayllar | 50+ |
| DB jadvallar | 17 |
| API endpoints | 60+ |
| Migrations | 5 |
| Commits | 18 (PR'da) |
| Bundle size | 1.57 MB (gzip 384 KB) |
| Loyiha hajmi | ~25K qator |

---

## 💡 XULOSA

### Mijoz hozir nima qila oladi
1. ✅ Ro'yxatdan o'tib do'kon ochish
2. ✅ Telegram bot ulash (token bilan)
3. ✅ Mahsulot katalogi (qo'lda yoki MoySklad'dan)
4. ✅ Telegram bot'ga + Mini App orqali xarid
5. ✅ Real-time admin dashboard
6. ✅ MoySklad sync
7. ✅ Click + Payme to'lov
8. ✅ Buyurtma boshqaruvi
9. ✅ Mijozlar va lidlar CRM
10. ✅ Bot UI editor

### Mijoz hali qila olmaydi
1. ❌ Email/SMS marketing rassilka **real yuborish**
2. ❌ Promo kod / sodiqlik ballar **real ishlatish**
3. ❌ Operator bilan **real-time chat**
4. ❌ Instagram/Facebook integration
5. ❌ Telegram Payments (faqat Click/Payme)
6. ❌ Bir do'konda bir nechta admin
7. ❌ Subscription tarif rejalari

### Tavsiya
**Hozir holati bilan mijozga topshirsa bo'ladi** — asosiy e-commerce flow to'liq ishlaydi. Marketing modullari real ishlashi uchun yana 1-2 ta sessiya kerak.
