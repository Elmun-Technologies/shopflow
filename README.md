# ShopFlow

**Multi-tenant SaaS e-commerce platform with MoySklad integration, Telegram Mini App and public storefront — all controlled from a single admin panel.**

## Loyihaning maqsadi

Bir nechta kompaniya (tenant) o'z do'konini ShopFlow ustida boshqaradi:

- **MoySklad** — yagona mahsulot/qoldiq/narx manbai. Ikki tomonlama sync (webhook + 10 daq. fallback cron).
- **Telegram bot** — har tenant @BotFather'dan o'zining bot tokenini kiritadi. Bitta jarayon yuzlab botlarni boshqaradi.
- **Telegram Mini App + ommaviy sayt + katalog** — uchalasi ham bir API'dan ishlaydi, mijoz uchun mo'ljallangan.
- **Admin SPA** — to'liq nazorat: mahsulotlar, buyurtmalar, mijozlar, integratsiya sozlamalari, sync holati, storefront mavzusi.

## Monorepo strukturasi

```
apps/
  admin/        — Boshqaruv paneli (React + Vite + TailwindCSS — mavjud SPA)
  api/          — REST API (NestJS + Prisma)
  worker/       — BullMQ background jobs (sync, outbound order, schedulers)
  bot/          — Multi-tenant Telegram bot runner (grammY)
  miniapp/      — Telegram Mini App (Vite + React)
  storefront/   — Ommaviy do'kon va katalog (Next.js 15 SSR/ISR)
packages/
  db/           — Prisma schema, client, tenant-scope extension
  shared-types/ — Backend ↔ frontend o'rtasidagi DTO interfeyslari
```

## Texnologiyalar

- **Backend**: Node.js 20 + NestJS 11 + Prisma 6 + PostgreSQL 16 + Redis 7 + BullMQ
- **Bot**: grammY (multi-bot, Redis sessions, Telegram stream consumer)
- **Frontend**: React 19, Vite 7, TanStack Query, TailwindCSS 4, Next.js 15 (storefront)
- **Auth**: JWT (argon2id parol) + RBAC (OWNER / MANAGER / OPERATOR / READONLY)
- **Tenant izolatsiya**: Prisma `$extends` har bir query'ga `tenantId` qo'shadi (cross-tenant leak'ni bloklaydi)

## Dev sozlash

Talablar: Node 20.10+, pnpm 9, Docker.

```bash
# 1. Dependencies
pnpm install

# 2. Infra (postgres + redis + mailhog)
docker compose up -d

# 3. .env tayyorlash
cp .env.example .env
# SECRETS_ENCRYPTION_KEY ni generatsiya qiling:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. DB migration + seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Hammasini parallel ishga tushirish (Turborepo)
pnpm dev
```

Default portlar:
- `4000` — API (`http://localhost:4000/health`)
- `5173` — Admin SPA
- `5174` — Mini App
- `3000` — Storefront (Next.js)
- `5432` — Postgres
- `6379` — Redis

Demo login (seed bilan): `demo@shopflow.uz` / `demo1234` (tenant slug: `demo`).

## Asosiy oqimlar

### MoySklad ulanishi
1. Admin → Sozlamalar → Integratsiyalar → MoySklad token kiritiladi.
2. `POST /api/integrations/moysklad` — token tekshiriladi (`/context/employee`), shifrlangan holda saqlanadi.
3. `MoyskladInitialImportJob` queue'ga tushadi: PriceType → Warehouse → Category → Product → Variant → Stock → Customer (har biri 1000'lik sahifa).
4. `SubscribeWebhooksJob` MoySklad'ga webhook'larni ro'yxatdan o'tkazadi.
5. Sync tugaganda `MoyskladAccount.status = CONNECTED`.

### MoySklad webhook
1. MoySklad → `POST /webhooks/moysklad/:tenantId`.
2. `WebhookEvent` yoziladi, `process-moysklad-event` queuesi.
3. Worker `GET /entity/${type}/${id}` qiladi, `version` (`updated.getTime()`) bo'yicha last-write-wins upsert.

### Buyurtma yaratish (bot/storefront/admin)
1. Frontend `POST /api/storefront/orders` yoki `/api/orders` (admin) → `Order` yaratiladi (`channel` maydoni bilan).
2. `outbound-sync:order-to-moysklad` queuesi → MoySklad'da `customerorder` yaratiladi → `Order.moyskladId` saqlanadi.
3. MoySklad order status'ini o'zgartirsa, webhook orqali `Order.status` yangilanadi → Telegram orqali mijozga bildirishnoma.

### Telegram bot
1. Admin tenant token'ini joylaydi → `setWebhook` chaqiriladi → Redis pub/sub `bot:reload`.
2. `apps/bot` yangi `Bot` instansiyasini hot-load qiladi.
3. Telegram update → `apps/api` `/tg/:tenantId/:secret` → Redis stream `tg:updates`.
4. `apps/bot` consumer group orqali stream'dan o'qiydi va to'g'ri tenant bot'iga yo'naltiradi.

## Tenant izolatsiyasi qanday ishlaydi

Har bir HTTP request boshida `TenantContextMiddleware` `JWT → :tenantId → Host`
ketma-ketligida tenantni aniqlaydi va CLS context'ga yozadi. `TenantPrismaService`
shu kontekstdan foydalanib **har bir** tenant-scoped jadval'ga `where: { tenantId }`
qo'shadi (`packages/db/src/tenant-context.ts`). Kontekst yo'q bo'lsa — Prisma so'rovi
`TenantContextRequiredError` bilan to'xtaydi. Bu cross-tenant leak'larning oldini oladi.

System ishchilari (`apps/worker`) Tenant context'siz ishlaydi va Prisma'ni
to'g'ridan-to'g'ri ishlatadi — `tenantId` har bir job payload'ida keladi.

## Joriy holat

Bu PR rejaning **Faza 1-5 skeletini** olib keladi: monorepo struktura, to'liq Prisma schema,
NestJS API (auth + tenant + products + orders + integrations + webhooks + sync),
worker (initial import + webhook handler + outbound order), Telegram bot manager,
Mini App va Next.js storefront skeleti. Admin SPA da API client va React Query
hook'lari qo'shilgan — sahifalarni mocks'dan API'ga ko'chirish keyingi PR'da (Faza 6).

## Build / typecheck

```bash
pnpm build
pnpm typecheck
pnpm lint
```
