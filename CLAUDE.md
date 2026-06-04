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
│   │   ├── OrdersPage.tsx         # Desktop table + mobile card + bulk status
│   │   ├── OrderDetailDrawer.tsx  # + print invoice + status timeline stepper
│   │   ├── ProductsPage.tsx       # Bulk actions + import + restock modal
│   │   ├── ProductImportModal.tsx # CSV/Excel paste import
│   │   ├── CustomersPage.tsx      # Card view mobile
│   │   ├── CustomerDetailDrawer.tsx
│   │   ├── LeadsPage.tsx          # Card view + statuses
│   │   ├── LeadDetailModal.tsx
│   │   ├── ChatPage.tsx           # Conversation list + funnel chart
│   │   ├── AnalyticsPage.tsx      # KPI strip + charts (capsule bars)
│   │   ├── DeliveryPage.tsx       # Delivery orders + tracking
│   │   ├── PaymentsPage.tsx       # Payment methods + transactions
│   │   ├── PlatformsPage.tsx      # Channel CRUD + AddChannelModal
│   │   ├── UIBuilderPage.tsx      # Vitrina editor (drag/drop blocks)
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
│       │                          # moysklad, salesdoctor, ...
│       └── lib/                   # audit, telegram-notify, secret-cipher,
│                                  # cart-abandonment, salesdoctor-client/push/worker
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
- ✅ JWT refresh tokens + API keys + AES-256-GCM secret encryption
- ✅ initData security (Telegram WebApp + storefront mutation endpoints)
- ✅ SSRF himoyasi (outbound webhooks)
- ✅ Per-tenant rate limit, mem_limit, deep healthcheck (DB ping)
- ✅ Real-time SSE (15s polling o'rniga)
- ✅ PWA — installable + offline shell (Service Worker, manifest)
- ✅ Avtomatik kunlik DB backup (docker service, 7 kun retention)
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

### Marketing
- ✅ Sale campaigns (aksiyalar)
- ✅ Promokod system
- ✅ Popup'lar
- ✅ Abandoned carts (1h reminder)
- ✅ Rassilka, SMS

---

## 🛣 Kelajakda (TODO / ideas)

### Qolgan
- [ ] **Prisma migrations folder** — hozir `db push` (production risk, alohida coordinated migration)
- [ ] **Push notifications** — Service Worker bor, VAPID setup qoldi
- [ ] **Email reports** — PDF tayyor, SMTP credentials kerak
- [ ] **Eskiz SMS real API** — tenant credential kerak
- [ ] **Yandex Go delivery** — tashqi hisob kerak
- [ ] **API access logs UI** — Settings → API tab'da audit ko'rsatish
- [ ] **Tenant data export** — Settings'da "Yuklab olish" tugmasi (JSON/CSV)
- [ ] **List virtualization** — agar 1000+ qator sekin scroll bo'lsa (hozir pagination 20)
- [ ] **Bundle size optimization** — recharts vendor 395kb (lazy chunk yoki light chart lib)

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
cd /opt/shopflow && git fetch origin && git reset --hard origin/main && docker compose up -d --build shopflow
```

**Production server:** `83.229.86.232` (root)
**Domain:** `shop-flow.uz`

---

## ⚙️ Convention / qoidalar

### Branch
Hozirgi ish branch: `claude/sync-pr-to-server-MaNhk`.
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
8. **Branch:** `claude/sync-pr-to-server-MaNhk`.
9. **CLAUDE.md ni yangilang** — yangi feature yoki o'zgarish bo'lsa.

Tilim: **Uzbek (lotin)** — user shu tilda. Ba'zan rus aralashma bo'lishi mumkin.
