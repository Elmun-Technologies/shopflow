# CLAUDE.md — ShopFlow loyiha konteksti

Bu fayl Claude (AI assistant) uchun loyihaning to'liq holatini saqlaydi.
Yangi sessiya boshlanganda **birinchi shu faylni o'qing** — barcha kontekst
shu yerda.

---

## 🎯 Loyiha qisqacha

**ShopFlow** — Uzbekistan e-commerce uchun multi-tenant CRM platforma.
Asosan **Telegram Mini App** orqali ishlaydigan mijozlar va admin paneli.

| Komponent | Stack | Vazifa |
|---|---|---|
| **Admin panel** | React 19 + TS + Vite + Tailwind 4 | Operator/admin uchun (web app) |
| **Mini App** | Xuddi shu React app, `/store/:slug` route | Telegram WebApp orqali mijoz |
| **Backend** | Fastify 5 + Prisma 5 + Postgres 16 | API va webhooklar |
| **Infra** | Docker Compose + Caddy (HTTPS) | VPS deployment |

**Domain (production):** `shop-flow.uz`
**Repo:** `Elmun-Technologies/shopflow`
**Owner:** Nazir Elmurodov (`elmun-technologies` org)

---

## 🎨 Dizayn tizimi (Commerly UI Kit)

Admin panel — **Commerly E-Commerce Dashboard UI Kit** (UI8) yo'nalishida.
Mini App (storefront) — alohida, dark Telegram-mos dizayn.

### Color tokens (`src/index.css` @theme)

```
cream-50/100/200/300  — off-white app fon, sidebar, hover, border
leaf-50→600           — yorqin lime/leaf green (aksent, CTA)
forest-50→900         — deep forest green (sarlavhalar, text)
slate-50→900          — neutral (Tailwind default)
```

| Joy | Color |
|---|---|
| App bg | `cream-50` (#FAFAF5) |
| Sidebar bg | `cream-100` (#F4F4ED) |
| Card bg | `white` |
| Border | `cream-300` (#E5E5DA) |
| Active pill | `bg-leaf-100 + text-forest-700` |
| Primary CTA | `bg-leaf-400 + text-forest-800` (yorqin lime) |
| Dark CTA | `bg-forest-700 + text-white` |
| Headings | `text-forest-800` (#1F3327) |
| Body text | `text-slate-700` |
| Secondary | `text-slate-500` |
| Muted | `text-slate-400` |

### Komponent uslubi

- Cards: `rounded-2xl` + `border-cream-300/80` + subtle shadow
- Bar grafiklar: **capsule shape** `radius={[12,12,12,12]}` (Commerly pill style)
- Status pills: pastel pill (`bg-{color}-100 text-{color}-600`), border'siz
- Avatar: rangli initials (hash-aware) — `bg-leaf-100 text-forest-700` va boshqa pastel
- Empty state ikonkalari: `text-cream-300` (yumshoq, qattiq emas)

### Mini App (storefront) — DAXLSIZ
`src/components/storefront/*` va `StorePage.tsx` o'z dark dizaynini saqlaydi.
Telegram WebApp uchun Uzum-uslubidagi UI. Bularni light theme'ga o'tkazmang.

---

## 🌐 i18n — Uzbek + Russian

**~530 ta kalit** `src/i18n/dictionary.ts` da.

```ts
import { useT } from "../i18n";
const { t, lang, setLang } = useT();
t("orders.title");
t("kpi.revenue");
t("products.count", { count: 142 });   // interpolation
```

**Til o'zgartirish:**
1. Admin sidebar pasidagi UZ/RU segmented control
2. Mini App → Profile → Ilova tili

Saqlash: `localStorage["shopflow.lang"]` + Customer.language (server).

**Status terminologiyasi 2 xil:**
- Storefront: `order.status.*` — "Yangi", "Tayyorlanmoqda" (mijoz tushunchasi)
- Admin: `order.adminStatus.*` — "Kutilmoqda", "Bajarildi" (operator tushunchasi)

---

## 📁 Loyiha tuzilmasi

```
shopflow/
├── src/                          # Frontend
│   ├── App.tsx                   # Router + AppShell + DashboardPage
│   ├── index.css                 # @theme tokens (cream/leaf/forest)
│   ├── i18n/
│   │   ├── index.tsx             # LangProvider + useT()
│   │   └── dictionary.ts         # ~530 ta uz/ru kalit
│   ├── api/
│   │   ├── client.ts             # JWT fetch wrapper
│   │   └── endpoints.ts          # ordersApi, productsApi, dashboardApi...
│   ├── contexts/
│   │   └── AuthContext.tsx       # JWT/tenant
│   ├── hooks/
│   │   ├── useAsync.ts
│   │   └── useGlobalShortcuts.ts # g d / g o / ? / Esc
│   ├── utils/
│   │   ├── format.ts             # Pul, sana, relative time
│   │   ├── notifSound.ts         # Web Audio API ding (3 variant)
│   │   ├── notifPrefs.ts         # Per-event prefs persist
│   │   ├── printOrder.ts         # A4 invoice generator
│   │   ├── exportCsv.ts          # RFC 4180 CSV with BOM
│   │   └── chart.ts              # Recharts type helper
│   ├── components/                # Admin pages + widgets (41 ta)
│   │   ├── Sidebar.tsx            # Cream bg + lime active + promo card
│   │   ├── Header.tsx             # Search + NotificationsPanel + profile
│   │   ├── KPICards.tsx           # Accent stripe + sparkline + trend chip
│   │   ├── RevenueChart.tsx       # Area chart + hero stats
│   │   ├── RecentOrders.tsx       # Avatar list (hash-color)
│   │   ├── TopProducts.tsx        # Numbered list + gradient progress
│   │   ├── TrafficSources.tsx     # Pure-CSS progress bars
│   │   ├── SalesByCategory.tsx    # Donut + center "Jami"
│   │   ├── WeeklySales.tsx        # Capsule bars
│   │   ├── LowStockAlert.tsx      # Amber accent — stock < 5
│   │   ├── NotificationsPanel.tsx # 15s polling + audio ding + mute
│   │   ├── BrowserNotifSection.tsx# Settings → per-event prefs + 3 sounds
│   │   ├── ShortcutsHelp.tsx      # ? overlay listing g-shortcuts
│   │   ├── IntegrationsHub.tsx    # 29 ta integration markaz (+ CRM kategoriya)
│   │   ├── MoyskladIntegrationCard.tsx # Real OAuth flow
│   │   ├── SalesDoctorIntegrationCard.tsx # SD CRM — connect/defaults/pull/retry
│   │   ├── OneCIntegrationCard.tsx # 1C CommerceML — URL/login/parol + import tarixi
│   │   ├── OrdersPage.tsx         # Desktop table + mobile card + bulk status
│   │   ├── OrderDetailDrawer.tsx  # + print invoice + status timeline stepper
│   │   ├── ProductsPage.tsx       # Bulk actions + import + restock modal
│   │   ├── ProductImportModal.tsx # CSV/Excel paste import
│   │   ├── ProductVariantsEditor.tsx # Variantlar (o'lcham/rang) muharriri
│   │   ├── CustomersPage.tsx      # Card view mobile
│   │   ├── CustomerDetailDrawer.tsx
│   │   ├── LeadsPage.tsx          # Card view + statuses
│   │   ├── LeadDetailModal.tsx
│   │   ├── ChatPage.tsx           # Conversation list + funnel chart
│   │   ├── AnalyticsPage.tsx      # KPI strip + charts (capsule bars)
│   │   ├── DeliveryPage.tsx       # Delivery orders + tracking
│   │   ├── PaymentsPage.tsx       # Payment methods + transactions
│   │   ├── PlatformsPage.tsx      # Channel CRUD + AddChannelModal
│   │   ├── UIBuilderPage.tsx      # Vitrina editor (drag/drop blocks + single-product konstruktor)
│   │   ├── BotBuilderPage.tsx     # Bot konstruktori (ekran/anketa editori + Telegram preview + AI)
│   │   ├── SettingsPage.tsx       # 7 tab: profile/store/team/notify/integrations/security/api
│   │   ├── TeamSection.tsx        # Jamoa — invite + rol + deaktiv
│   │   ├── OnboardingWizard.tsx   # 5 qadamli sehrgar (yangi tenant)
│   │   ├── LoginPage.tsx
│   │   ├── pages/                 # Marketing sub-pages (12 ta)
│   │   │   ├── RassilkaPage.tsx
│   │   │   ├── PromoPage.tsx
│   │   │   ├── SovgalarPage.tsx
│   │   │   ├── SmsPage.tsx
│   │   │   ├── KanalPage.tsx
│   │   │   ├── BannerPage.tsx
│   │   │   ├── IzohlarPage.tsx    # Reviews moderation
│   │   │   ├── SodiqlikPage.tsx   # Loyalty
│   │   │   ├── GiveawayPage.tsx
│   │   │   ├── ManbaPage.tsx
│   │   │   ├── TranzaksiyalarPage.tsx
│   │   │   └── SegmentsPage.tsx
│   │   ├── storefront/            # Mini App (DAXLSIZ, dark theme)
│   │   │   ├── BottomNav.tsx
│   │   │   ├── ProfilePage.tsx    # Info/Orders/Addresses/Refs/Promo/Notify
│   │   │   └── storefront-theme.ts
│   │   ├── StorePage.tsx          # Mini App entry (dark!)
│   │   └── ui/                    # Toast, ConfirmDialog, Skeleton
│   └── data/
│       ├── chatData.ts            # Demo data (mocks)
│       ├── settingsData.ts
│       ├── integrationsData.ts    # 28 ta integration metadata
│       ├── marketingData.ts
│       └── ...
├── backend/                       # Fastify
│   ├── prisma/
│   │   ├── schema.prisma          # Tenant, User, Lead, Order, Product, Customer, Channel, ...
│   │   └── seed.ts
│   └── src/
│       ├── routes/                # auth, leads, orders, products, customers, channels,
│       │                          # dashboard, webhooks, payments, delivery, vitrina,
│       │                          # moysklad, salesdoctor, onec, onec-exchange, ...
│       └── lib/                   # audit, telegram-notify, secret-cipher,
│                                  # cart-abandonment, salesdoctor-client/push/worker,
│                                  # onec-commerceml/onec-import/onec-exchange,
│                                  # bot-flow-schema/templates/ai, bot-engine,
│                                  # variant-shape
├── docker-compose.yml             # Postgres + Backend + Frontend + Caddy
├── Caddyfile
├── scripts/bootstrap.sh           # VPS one-shot setup
└── CLAUDE.md                      # ← Bu fayl
```

---

## 🚀 Bajarilgan ishlar (chronological)

### Texnik infratuzilma
- ✅ Multi-tenant Prisma schema + JWT auth + RBAC + integration tests
- ✅ Docker Compose: Postgres + Backend + Frontend + Caddy (HTTPS) + Backup
- ✅ VPS bootstrap skripti + OPS.md / SECURITY.md
- ✅ Sentry error tracking + Pino log redaction
- ✅ Prometheus metrics — `/metrics` (HTTP counter/histogram/in-flight + Node default: CPU/xotira/event-loop/GC). Prod'da `METRICS_TOKEN` himoya, Caddy'dan tashqarida (ichki). Hujjat: `OPS.md` → Monitoring
- ✅ JWT refresh tokens + API keys + AES-256-GCM secret encryption
- ✅ initData security (Telegram WebApp + storefront mutation endpoints)
- ✅ SSRF himoyasi (outbound webhooks)
- ✅ Per-tenant rate limit, mem_limit, deep healthcheck (DB ping)
- ✅ Real-time SSE (15s polling o'rniga)
- ✅ PWA — installable + offline shell (Service Worker, manifest)
- ✅ Avtomatik kunlik DB backup (docker service, 7 kun retention) + **offsite** (S3/R2/B2/MinIO, `BACKUP_S3_*` — `scripts/backup.sh`)
- ✅ Graceful shutdown (SIGTERM → workers stop)
- ✅ Multi-tenant webhook URLs

### Admin panel UI
- ✅ **Commerly light theme** (Phase 1 + polish)
- ✅ Sidebar: cream bg + leaf active pill + Promo card
- ✅ KPI cards: accent stripe + sparkline + trend chip
- ✅ Mobile responsive (desktop table → mobile card view)
- ✅ Loading skeletons (spinners o'rniga)
- ✅ Capsule bars (rounded-full both ends)
- ✅ Avatar circles (hash-aware pastel colors)

### Mini App (storefront)
- ✅ Telegram WebApp integration
- ✅ Premium dark UI (Uzum-uslubidagi)
- ✅ Complete cart redesign
- ✅ Trust badges, sharhlar form
- ✅ Profile sub-pages (Info/Orders/Addresses/Refs/Promo/Notify)

### Funksiyalar
- ✅ **i18n** — uz/ru, ~530 kalit
- ✅ **Notifications panel** (Header bell)
- ✅ **Audio "ding"** + browser notification (15s polling)
- ✅ **3 ovoz turi** — Ding / Bell / Chime + per-event preferences
- ✅ **CSV export** — Orders / Customers / Leads
- ✅ **Print invoice** — A4 hujjat OrderDetailDrawer'dan
- ✅ **Bulk product import** — CSV/Excel paste orqali
- ✅ **Keyboard shortcuts** — `g d/o/p/c/l/h/m/a/v/s` + `?` help + `Esc`
- ✅ **Global ⌘K palette** (allaqachon bor edi)
- ✅ **Integratsiyalar markazi** — 29 ta (Click/Payme/Uzum/Yandex Go/Eskiz/...)
- ✅ **MoySklad** real OAuth integration
- ✅ **Sales Doctor CRM** — two-way sync (push order/status, pull catalog, retry worker)
- ✅ **1C: Buxgalteriya** — CommerceML 2 «Обмен с сайтом» katalog importi (pastda batafsil)
- ✅ **Low Stock Alert** — Dashboard widget
- ✅ **Click/Payme/Uzum** webhook handlers (backend)
- ✅ Promo codes, loyalty, SMS admin pages
- ✅ **Bulk order status** — OrdersPage'da bir vaqtda N ta buyurtma
- ✅ **Order status timeline** — OrderDetailDrawer'da vizual stepper
- ✅ **Reviews moderation** — photos, reject reason, bulk, rejected tab
- ✅ **Team management** — Settings → Jamoa (invite + rol + deaktiv)
- ✅ **Onboarding wizard** — yangi tenant uchun 5 qadam
- ✅ **Inventory restock** — kam qolgan mahsulotga tezkor stok
- ✅ **RFM segments** — CustomersPage (champion/loyal/atRisk/lost/...)
- ✅ **Click + Payme** full checkout (admin one-click setup, webhook URL ko'rsatish)
- ✅ **To'lov persistence** — webhook → PaymentTransaction + order.paid
- ✅ **Custom Outbound Webhooks** — HMAC, SSRF himoyasi, auto-disable
- ✅ **GA4 + Yandex Metrika** — Vitrina brand'dan auto-inject
- ✅ **Sales Overview gauge** — yarim doira growth chart
- ✅ **Reports PDF** — AnalyticsPage'dan hisobot generatori
- ✅ **Order/Customer/Lead create modallari** (admin tugmalari)
- ✅ **Single-product do'kon rejimi** — Vitrina'da "Do'kon turi: Ko'p mahsulotli / Bitta mahsulot" toggle. Single rejimda bitta mahsulotga qaratilgan landing (galereya/sharhlar/badge/taymer toggle), savatsiz to'g'ridan-to'g'ri "Buyurtma berish". `Storefront.storeMode` + `singleProductId`. Bot `/start` o'zgarmaydi — storefront rejimga qarab render qiladi.
- ✅ **Public API v1** — tashqi mijoz websaytlari uchun barqaror, API-kalit himoyalangan kontrakt (`/api/v1`). 6 endpoint: `GET /categories`, `/products` (filtr/sort/sahifalash), `/products/{slug}`, `/products/{id}/upsells` (ProductAddon), `/promotions` (free shipping), `POST /orders` (server-side narx, atomik stock, WEBSITE kanali, SSE/webhook). Bearer `sf_...` → tenant (`authenticateApiKey`). `?locale=uz|ru|en`. Pul butun UZS, rasm absolyut HTTPS, GET'lar 300s kesh. Shakl: `lib/public-shape.ts`, kontrakt: **`PUBLIC_API.md`**. Kalit: Sozlamalar → API yoki `npm run create-api-key -- <slug>`.
  - Schema o'zgarishi: `Product.slug` (tenant ichida unique, URL identifikatori) + `Product.origin` (filtr) + `Product.content` (JSON — tagline/highlights/benefits/ingredients/howToUse/faq/servings/bespoke). Slug create'da avto-generatsiya + `npm run backfill-slugs` (mavjudlar). **Deploy'da `prisma db push` kerak.** Boy kontent admin UI — ✅ bajarildi (`ProductContentEditor`, mahsulot formasida).
- ✅ **Mahsulot variantlari** — marketplace mantiqi (Uzum/WB): bitta karta, ichida 50 gr / 1 kg / 5 kg, har birida o'z narxi, zaxirasi, rasmi va xarakteristikasi. `Product.options` (o'qlar, max 3) + `ProductVariant` jadvali. **Ixtiyoriy** — varianti yo'q mahsulot avvalgidek ishlaydi, migratsiya/backfill yo'q. Karta narxi = eng arzon **sotib olinadigan** variant, PDP ochilganda o'sha tanlangan (`lib/variant-shape.ts` — storefront/admin/public API/bot uchun yagona qoida manbai). Zaxira variantda turadi va uchala buyurtma yo'lida (Mini App / admin / Public API) atomik yechiladi; bekor qilishda ham variantga qaytadi. `OrderItem.variantId` + `variantLabel` snapshot. Public API v1 ga `options[]`/`variants[]` qo'shildi, variantli mahsulotda `variantId` majburiy. **1C «Характеристика» (guid#guid) endi alohida mahsulot emas, variant bo'lib import qilinadi.** Admin: mahsulot formasida variant muharriri (o'q → kombinatsiyalarni avto-generatsiya → narx/zaxira/rasm/xarakteristika). Hujjat: **`VARIANTS.md`**. **Deploy'da migratsiya kerak** (`20260804140000_add_product_variants`).
- ✅ **Bot konstruktori (BotFlow)** — tenant Telegram botining suhbat oqimini kodsiz quradi. `BotFlow.definition` JSON (ekranlar + tugmalar + anketalar + sozlamalar), `bot-engine.ts` runtime, `BotSession` DB'da holat (ilgari xotiradagi `Map` edi — restartda yo'qolardi va tenantlar orasida chatId bo'yicha to'qnashardi). Tugma amallari: ekran / anketa / matn / Mini App / URL / katalog / buyurtma kuzatish / operator / til. Anketa javoblari `mapTo` orqali Lead ustunlariga tushadi, qolgani izohga. **Opt-in** — `enabled=false` bo'lsa eski standart bot ishlaydi. Shablonlar: `retail` (hozirgi botning ekvivalenti) / `b2b` (ishlab chiqaruvchilar: sohalar, yechim tanlash anketasi, namuna/narx so'rovi) / `blank`. **AI generator**: mijoz brifini qo'yasiz → model to'liq oqim qaytaradi (zod tekshiradi, admin tasdiqlaydi). Provayder kalitga qarab tanlanadi — `OPENAI_API_KEY` yoki `ANTHROPIC_API_KEY` (`ai-provider.ts`), model `.env` orqali almashadi. Admin: Kanallar → Bot (`g b`). Hujjat: **`BOT_BUILDER.md`**. **Deploy'da migratsiya kerak** (`20260804120000_add_bot_flow`).
- ✅ **Single-product landing konstruktori** — multi rejimdek to'liq seksiya builder. `SingleConfig` endi tartiblangan `sections[]` (eski 5-boolean shaklga backward-compat `normalizeSingleConfig`). Editor: doimiy "skelet" (galereya → narx → CTA, qulflangan) + qo'shimcha bo'limlar (ishonch belgilari / sharhlar / haftalik xaridorlar / tezkor info / aksiya taymeri / tavsif / yetkazib berish / combo) — drag + strelka bilan tartiblanadi, eye toggle bilan yoqiladi. **Storefront'ga to'liq ulangan**: `StorePage` single PDP body bo'limlarni saqlangan tartib + holatga qarab chizadi (multi rejim PDP o'zgarmagan). Yangi `CountdownBanner` (kun oxirigacha jonli ortga hisob).

### Marketing
- ✅ Sale campaigns (aksiyalar)
- ✅ Promokod system
- ✅ Popup'lar
- ✅ Abandoned carts (1h reminder)
- ✅ Rassilka, SMS

---

## 🛣 Kelajakda (TODO / ideas)

### Qolgan (faqat tashqi credential/hisob kerak — kod tayyor)
Har biri uchun ulanish yo'riqnomasi: **`INTEGRATIONS.md`**.
- [ ] **Push notifications** — kod to'liq (VAPID lib + SW + UI + DB). `.env`'ga VAPID kalitlar kerak. Buyurtmada avto-trigger hali yo'q (qo'lda test bor).
- [ ] **Email reports** — kod to'liq (nodemailer + soatlik scheduler + UI). SMTP kerak. Eslatma: O'zbekistonda email marketing kuchsiz.
- [ ] **Eskiz SMS** — kod to'liq (token auth + bulk + UI). `.env`'ga login/parol kerak. Avto-trigger yo'q; per-tenant credential rejalashtirilgan.
- [ ] **Yandex Go delivery** — **faqat STUB**: umumiy delivery CRUD bor, lekin Yandex API kodi YO'Q. Provayder klient + webhook + Yandex Pro hisob kerak (qurilishi lozim).

### 1C — keyingi bosqichlar (kod bazasi tayyor, qamrov ataylab cheklangan)
- [ ] **`offers.xml` — narx va qoldiq.** Hozir fayl qabul qilinadi, lekin qo'llanmaydi.
      Qo'shilsa `createInactive` default'ini `false` ga o'zgartirish mantiqiy bo'ladi.
      Parser `onec-commerceml.ts` ga `<ПредложениеТовара>` (Цены/Количество) qo'shiladi.
- [ ] **Buyurtmalarni 1C'ga eksport** (`type=sale&mode=query`). Hozir bo'sh, lekin
      yaroqli CommerceML qaytadi. `Заказ` hujjatini generatsiya qilish kerak.
- [ ] **Xarakteristikali tovarlar** — `Ид` "guid#guid" bo'lsa hozir alohida mahsulot
      bo'lib tushadi. Variant/modifikatsiya modeli kerak bo'lsa qayta ko'rib chiqiladi.

### Ixtiyoriy
- [ ] **List virtualization** — agar 1000+ qator sekin scroll bo'lsa (hozir pagination 20)
- [ ] **StorePage to'liq dedup** — reviews/combo ham ulashilgan komponentga (hozir ataylab StorePage'da, chunki async/interaktiv)

### 🔒 Xavfsizlik hardening (audit topdi — product/ops qaror kerak, shuning uchun avtomatik qilinmadi)
Bular haqiqiy, lekin tuzatish integratsiya/URL kontraktini yoki auth oqimini
o'zgartiradi (buzilish xavfi bor) — user qaroriga qoldirildi:
- [ ] **MoySklad webhook autentifikatsiyasi** (`webhooks.ts` `POST /moysklad/:tenantId`) — hozir imzosiz: tenant UUID'ni bilган har kim `WebhookEvent` yozishi mumkin (storage/DoS, MVP faqat saqlaydi). Tuzatish: URL/header'ga per-tenant sirli token. **Eslatma:** MoySklad'dagi webhook URL'ini qayta ro'yxatdan o'tkazish kerak (kontrakt o'zgaradi).
- [ ] **JWT query-string orqali** (`tenant-export.ts`, `events.ts`) — `?token=` proxy/Sentry loglariga tushadi. SSE (EventSource) header yubora olmaydi, shuning uchun qisqa muddatli maxsus download/SSE token kerak (auth oqimi o'zgaradi).
- [ ] **SSRF DNS-rebind (TOCTOU)** (`outbound-webhook.ts`, `salesdoctor-client.ts`) — `isUrlSafe` DNS'ni bir marta hal qiladi, `fetch` yana hal qiladi (qisqa TTL bilan private IP'ga rebind mumkin). Tuzatish: hal qilingan IP'ni pin qilish (custom lookup/agent) — legitimate load-balanced host'larni buzmaslik uchun ehtiyotkorlik kerak.

### ✅ Yaqinda bajarilgan
- ✅ **Mini App "do'kon ochilmayapti" (iPhone) — barqarorlik tuzatishlari.** Bot ishlab
  turgani holda `🛍 Do'kon` tugmasi ba'zi qurilmalarda oq ekran berardi. Uchta
  mustaqil sabab bartaraf qilindi:
  1. **Telegram SDK endi o'z domenimizdan.** `index.html` `https://telegram.org/js/telegram-web-app.js`
     ni yuklardi. O'zbekistonda ayrim mobil operatorlar `telegram.org` domenini
     bloklaydi (Telegram'ning o'zi MTProto orqali ishlayveradi — shuning uchun bot
     ishlaydi, Mini App esa yo'q). Skript yuklanmasa `window.Telegram` bo'lmaydi,
     `ready()`/`expand()` chaqirilmaydi va Telegram yuklanish ekranida qotadi.
     Endi `/vendor/telegram-web-app.js` — Docker build vaqtida yuklab olinadi
     (`Dockerfile`), repoda CDN'ga qaytadigan stub turadi.
  2. **Service Worker do'konga aralashmaydi.** Kesh nomi hech qachon o'zgarmasdi
     (`shopflow-v1`); navigatsiya offline'ga tushsa eski `index.html` beriladi, u
     esa allaqachon o'chirilgan hash'li asset'larga murojaat qiladi → oq ekran,
     va mijoz Telegram WebView'ida keshni tozalay olmaydi. Endi `/store/*` SW'dan
     butunlay chetda, kesh `shopflow-v2`, xato javoblar keshlanmaydi, va do'kon
     ochilganda eski SW/kesh o'chiriladi (mavjud qurilmalar o'zini davolaydi).
  3. **Boot watchdog.** Bundle umuman ishga tushmasa (oq ekran) endi o'qiladigan
     panel chiqadi: sabab + diagnostika (SDK holati, online, SW, yuklanmagan fayl,
     UA) + "Qayta urinish". Telegram'da devtools yo'q — bu yagona ko'rinadigan iz.
  - Bonus: `X-Frame-Options: SAMEORIGIN` olib tashlandi (Caddy + nginx).
    Clickjacking himoyasi CSP `frame-ancestors`da qoladi; XFO esa Telegram Web
    (`web.telegram.org` iframe) ni bloklardi — WebKit uni `frame-ancestors` bilan
    birga bo'lganda ham qo'llaydi. `frame-ancestors`/`frame-src` endi
    `https://*.telegram.org` (webk/webz ham).
- ✅ **1C integratsiyasi (CommerceML 2 «Обмен с сайтом»)** — 1C: Buxgalteriya/UT dan
  katalog importi. **Yo'nalish teskari**: 1C on-prem va NAT ortida bo'lgani uchun *biz*
  1C'ga ulanmaymiz — 1C o'zi bizga murojaat qiladi (oq IP/VPN/OData publikatsiyasi
  kerak emas). Endpoint: `POST|GET /api/1c/exchange`, HTTP Basic auth (per-tenant
  login/parol; login global unique → tenant shu orqali topiladi, URL'da tenant ID
  ochilmaydi). Protokol: `checkauth` → `init` → `file` (bo'laklab) → `import`.
  Katta katalog **`progress` protokoli** bilan 300 tadan bo'lib import qilinadi —
  1C bir so'rovda timeout bo'lmaydi (oraliq holat xotirada, `onec-import.ts`).
  - **Qamrov: faqat katalog** — kategoriya daraxti + mahsulot kartochkasi (nom,
    artikul, tavsif, guruh, rasm, davlat). **Narx/qoldiq (`offers.xml`) qo'llanmaydi** —
    fayl qabul qilinadi va jurnalga yoziladi, xolos. Shu sababli yangi mahsulot
    default **yashirin** (`createInactive`) yaratiladi — narxsiz holda vitrinada
    0 so'mga chiqmasligi uchun.
  - **Xavfsizlik:** staging katalogi `ONEC_EXCHANGE_DIR` (default `/app/1c-exchange`),
    **ataylab** `/app/uploads` dan tashqarida — uploads nginx orqali ochiq beriladi,
    `import.xml` esa butun katalogni oshkor qilardi. `safeRelPath` path traversal'ni
    to'sadi; sessiya cookie'si HMAC bilan imzolangan (stateless, restart'ga chidamli);
    exchange route'da rate limit o'chirilgan (almashinuv yuzlab so'rov yuboradi).
  - **Ataylab qilinmagan:** mahsulot hech qachon o'chirilmaydi (faqat `active=false`);
    `mode=deactivate` bajarilmaydi (qisman yuklamada butun katalogni yashirib qo'yardi);
    buyurtma eksporti yo'q (`type=sale` ga bo'sh, lekin yaroqli CommerceML qaytadi —
    1C tomonida almashinuv xatosiz yakunlanadi).
  - Fayllar: `routes/onec.ts` (admin API), `routes/onec-exchange.ts` (protokol),
    `lib/onec-commerceml.ts` (parser + 19 test), `lib/onec-import.ts`, `lib/onec-exchange.ts`,
    `components/OneCIntegrationCard.tsx`. Operator yo'riqnomasi: **`INTEGRATIONS.md` §5**.
  - Schema: `OneCAccount`, `OneCImportLog`, `Product.oneCId/oneCUpdated`,
    `Category.oneCId`, `ProductSource.ONEC`. **Deploy'da migratsiya kerak**
    (`20260804090000_add_1c_commerceml_integration`).
- ✅ **Prisma migrations** — versiyalangan `prisma migrate` + drift-check (`MIGRATIONS.md`)
- ✅ **API access logs UI** — Settings → API tab real backend (`ApiKeysSection`) + "oxirgi ishlatilgan" audit
- ✅ **Tenant data export** — Settings → Do'kon → JSON eksport
- ✅ **Bundle optimization** — recharts initial bundle'dan chiqarildi (lazy + function-form `manualChunks`); `index` 502→309kb
- ✅ **To'liq admin audit** — soxta data / o'lik tugma / tarjima tuzatishlari; **double-encode API bug** (bot sekanslar + API kalitlar runtime'da buzilgan edi)
- ✅ **Single-product sayqal** — WYSIWYG konstruktor preview (real mahsulot ma'lumoti), grip drag-drop, single sahifa polish; ulashilgan **`src/components/storefront/SingleProductSections.tsx`** (konstruktor preview + live storefront bir komponentdan — WYSIWYG kafolati)
- ✅ **Boy kontent admin UI** — mahsulot formasida "Public API va boy kontent" kengaytiriladigan bo'limi: slug (jonli sanitatsiya), origin, va bilingual (UZ/RU) editor (tagline/highlights/benefits/ingredients/howToUse/faq/servings/bespoke). `src/components/ProductContentEditor.tsx` flat va per-locale `{uz,ru}` kontentni o'qiydi/yozadi, noma'lum kalitlarni (`_extra`) saqlaydi. Backend `toJsonInput` → `Prisma.JsonNull` (tozalash). Endi `content` DB/seed emas, UI orqali. **Public API v1 va single-product landing shu kontentni render qiladi.**
- ✅ **Mahsulot filtrlari** — ProductsPage: holat (sotuvda/yashirin) + zaxira (kam qolgan <5 / tugagan) filtrlari; filtr-aware bo'sh holat ("Filtrlarni tozalash"). Yashirin mahsulot kartada opacity/grayscale + "Yashirin" belgisi bilan ajratiladi.
- ✅ **Xavfsizlik/barqarorlik auditi (read-only bug hunt → fix)**:
  - **Promo perUserLimit** checkout'da tekshirilmasdi — mijoz promo tekshiruvidan oldin aniqlanadigan qilib tuzatildi ("har mijoz uchun 1 marta" endi haqiqatda ishlaydi).
  - **Order kod race** — storefront + public-api concurrent checkout'da bir xil `ORD-NNNN` → P2002 → 500 edi. Endi `createOrderCodeWithRetry` (admin yo'li kabi).
  - **Payme CheckTransaction/GetStatement** — ilgari qattiq (state:1 / bo'sh) edi. Endi saqlangan tranzaksiyadan haqiqiy state/vaqt qaytadi (`paymeStateForStatus`, `payment-reconcile.ts`da testlangan).

---

## 🔧 Development

```bash
# Local dev
npm install
docker compose up -d postgres
cd backend && npm install && npx prisma migrate dev && npm run seed && npm run dev
cd .. && npm run dev   # frontend

# Quality checks
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest
npm run build       # vite build

# Production deploy
ssh root@83.229.86.232
cd /opt/shopflow && git fetch origin && git reset --hard origin/main && docker compose up -d --build
# MUHIM: xizmat nomisiz — frontend (shopflow) VA backend ikkalasi ham qayta quriladi.
# Faqat `--build shopflow` desangiz backend (DB migratsiya/drift-heal) yangilanmaydi!
```

**Production server:** `83.229.86.232` (root)
**Domain:** `shop-flow.uz`

---

## ⚙️ Convention / qoidalar

### Branch
Hozirgi ish branch: `claude/1c-integration-h5fcnb`.
Har PR shu branch'ga commit qiladi, user merge qiladi, branch reset bo'ladi.

### Commit message
Conventional Commits — `feat(scope):`, `fix(scope):`, `chore:`.
Tilning birinchi qatori — qisqa va aniq. Body — nima/nima uchun, kerakli faylar.

### PR
Draft sifatida ochiladi. User review qilib **draft → ready → merge** qiladi.
Eslatma: **bitta sessiyada bitta active branch**. Eski PR yopilmaguncha
yangisi ochilmaydi.

### Sed mass-replace
40+ component bir vaqtda o'zgartirishda qo'l bilan yozish o'rniga `sed` ishlatildi
(masalan, dark → light theme migration). Foydali pattern.

### Storefront
Admin va Mini App **alohida design system**. Admin'da o'zgartirish qilsangiz
storefront'ga teging emas: `src/components/storefront/*` va `StorePage.tsx`.

---

## 📊 PR statistikasi

Bugungi sessiyada **27+ PR** main'ga merge qilindi (#46–#67):
- i18n (uz/ru) — 7 PR
- Mobile responsive — 1 PR
- Commerly light theme — 2 PR (+ polish)
- Notifications + sound + prefs — 3 PR
- CSV export, print invoice, bulk import — 3 PR
- Shortcuts + palette — 1 PR
- Integratsiyalar markazi — 1 PR
- Backend (payments, delivery, security, Sentry) — 5+ PR

---

## 🤖 Claude uchun ko'rsatmalar

Bu loyiha bilan ishlashda:

1. **Storefront'ga teging emas** — Mini App alohida dark dizayn.
2. **i18n kalitlar qo'shing** — yangi UI string yozsangiz, `dictionary.ts` ga
   uz + ru kalit qo'shing.
3. **Light theme classes** — `bg-white`, `text-forest-800`, `border-cream-300`,
   `bg-leaf-400` CTA. Dark slate ishlatmang admin'da.
4. **Capsule bars** — yangi bar chart yozsangiz `radius={[12,12,12,12]}`.
5. **Empty state ikonkasi** — `text-cream-300`, qora dot emas.
6. **Status pills** — pastel `bg-{color}-100 text-{color}-600`, border yo'q.
7. **PR'ni draft sifatida oching**. User merge qiladi.
8. **Branch:** `claude/1c-integration-h5fcnb`.
9. **Bot mantiqi** — `webhooks.ts` dagi qattiq kodlangan botga yangi tugma
   qo'shmang. Bot xatti-harakati endi **BotFlow** orqali (`bot-flow-schema.ts`
   kontrakti). Yangi tugma turi kerak bo'lsa: sxemaga action qo'shing →
   `bot-engine.ts` `runAction` → admin UI `ACTION_TYPES` → i18n
   `botflow.action.*`. Qarang: `BOT_BUILDER.md`.
10. **CLAUDE.md ni yangilang** — yangi feature yoki o'zgarish bo'lsa.

Tilim: **Uzbek (lotin)** — user shu tilda. Ba'zan rus aralashma bo'lishi mumkin.
