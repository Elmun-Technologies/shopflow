# Dokploy orqali deploy qilish

Bu hujjat ShopFlow stack'ini sizning Dokploy instance'ingizga qadam-baqadam
yuklash bo'yicha amaliy yo'riqnoma. Hozircha umumiy Dokploy sub-domeni
bilan ishlatamiz; o'z domeningiz bo'lganda ham keyin oson sozlanadi.

## 1. Dokploy'da PostgreSQL va Redis yaratish

**Dashboard → Project → Create Service → Database**

| Service | Engine | Version | Saqlash kerak |
|---|---|---|---|
| `shopflow-pg`    | PostgreSQL | 16   | DATABASE_URL'ni eslab qoling |
| `shopflow-redis` | Redis      | 7    | REDIS_URL'ni eslab qoling |

Database service'lar yaratilgandan keyin Dokploy "Connections" tab'ida
ichki connection URL'larini ko'rsatadi — masalan:

```
DATABASE_URL=postgresql://postgres:****@shopflow-pg-postgres:5432/postgres
REDIS_URL=redis://shopflow-redis-redis:6379
```

> Postgres'ning default DB'si `postgres` bo'lishi mumkin — `postgres` o'rniga
> `shopflow` deb yaratishni tavsiya etamiz (Database settings → Database
> name).

## 2. Compose application yaratish

**Dashboard → Project → Create Service → Compose**

- Source: **GitHub** (yoki Git URL — kirish berilgan bo'lishi kerak)
- Repository: `Elmun-Technologies/shopflow`
- Branch: `claude/moysklad-integration-mdwY7` (yoki keyin `main`)
- Compose path: `docker-compose.dokploy.yml`

## 3. Environment variables

**Application → Environment tab** — quyidagilarni qo'shing:

```bash
# DB / Redis (Dokploy Connections tab'idan)
DATABASE_URL=postgresql://postgres:****@shopflow-pg-postgres:5432/shopflow
REDIS_URL=redis://shopflow-redis-redis:6379

# Auth sirlari (random generatsiya qiling, 32 belgi minimum)
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>

# Token shifrlash (32 bayt = 64 hex)
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SECRETS_ENCRYPTION_KEY=<64 hex>

# Public URL'lar — domen biriktirgandan keyin yangilang
PUBLIC_API_URL=https://api-shopflow.<your-dokploy-domain>
PUBLIC_ADMIN_URL=https://admin-shopflow.<your-dokploy-domain>
PUBLIC_MINIAPP_URL=https://app-shopflow.<your-dokploy-domain>
CORS_ORIGINS=https://admin-shopflow.<your-dokploy-domain>,https://app-shopflow.<your-dokploy-domain>,https://shopflow.<your-dokploy-domain>

# Sentry (ixtiyoriy)
SENTRY_DSN=
LOG_LEVEL=info

# SMS provider (ixtiyoriy, bo'sh = console log)
ESKIZ_EMAIL=
ESKIZ_PASSWORD=

# Storefront ISR revalidation
STOREFRONT_REVALIDATE_URL=http://storefront:3000/api/revalidate
STOREFRONT_REVALIDATE_SECRET=<openssl rand -hex 32>
```

## 4. Birinchi deploy

**Application → Deploy** tugmasini bosing. Dokploy quyidagini bajaradi:

1. Repo'ni clone qiladi
2. Har servis uchun Docker image quradi (~3-8 daqiqa birinchi safar)
3. `api` container'i startup'da `prisma migrate deploy` yurgizadi
4. `worker` (2 replica) va `bot` ishga tushadi
5. `admin`, `miniapp` va `storefront` HTTP'da turishadi

Logni Dokploy'ning "Logs" tab'ida real vaqtda ko'ring.

## 5. Domen biriktirish

Har servis uchun **Service → Domains** tab'ida:

| Servis | Tavsiya etilgan host | Port |
|---|---|---|
| `api`        | `api-shopflow.<dokploy-domain>`   | 4000 |
| `admin`      | `admin-shopflow.<dokploy-domain>` | 80   |
| `miniapp`    | `app-shopflow.<dokploy-domain>`   | 80   |
| `storefront` | `shopflow.<dokploy-domain>`       | 3000 |

Dokploy avtomatik:
- Traefik label'larini qo'shadi
- Let's Encrypt sertifikatini oladi
- HTTPS redirect sozlaydi

> **Wildcard storefront keyin**: bir nechta tenant bir necha subdomen
> bilan ishlatish uchun (`shop1.shopflow.uz`, `shop2.shopflow.uz`) sizga
> wildcard DNS + wildcard TLS kerak bo'ladi. Hozircha yagona host'da
> testlash mumkin — birinchi tenant uchun ishlaydi.

## 6. Boshlang'ich foydalanuvchi yaratish

Birinchi tenant'ni admin'da bevosita ro'yxatdan o'tkazish:

1. Browser'da `https://admin-shopflow.<dokploy-domain>` ochiladi
2. Login formada **Ro'yxatdan o'tish** havolasi bosiladi
3. Do'kon nomi + slug + email + parol kiritiladi
4. Avtomatik dashboard'ga olib boriladi

Yoki seed orqali demo tenant qo'shish:

```bash
# Dokploy'ning Console feature'i bilan api container'ga ulanib:
pnpm --filter @shopflow/db seed
```

Demo login: `demo@shopflow.uz` / `demo1234` (slug: `demo`).

## 7. CORS va public URL'larni to'g'rilash

Birinchi deploy'dan keyin Dokploy'dagi domenlarni eslab qoling va `.env`
o'zgaruvchilarini yangilang:

- `PUBLIC_API_URL` — admin va miniapp shu manzilga so'rov yuboradi
- `CORS_ORIGINS` — admin, miniapp va storefront manzillari (vergul bilan)

O'zgartirgandan keyin **Application → Restart**.

## 8. Tekshirish

```bash
# Health
curl https://api-shopflow.<dokploy-domain>/health
# {"status":"ok","db":"ok","redis":"ok",...}

# Admin
open https://admin-shopflow.<dokploy-domain>

# Mahsulot endpoint'i (auth talab qilinadi)
curl -H "Authorization: Bearer $TOKEN" \
  https://api-shopflow.<dokploy-domain>/api/products
```

## 9. Tez-tez uchraydigan muammolar

**`prisma migrate deploy` xato beradi**
→ DATABASE_URL noto'g'ri yoki Postgres hali yuklanmagan. `depends_on`
mavjud, lekin healthcheck ishlamaydi (Dokploy database service). Birinchi
deploy'da `api` container'i 1-2 marta restart bo'lishi mumkin.

**Vite static fronend'da `Network Error`**
→ Build vaqtida `VITE_API_URL` to'g'ri o'rnatilmagan. Application → Env
o'zgartirsangiz, **rebuild** kerak (Dokploy → Deploy → Force rebuild).

**Telegram webhook ishlamayapti**
→ Bot Telegram tokenini admin'ga kiritganingizda webhook'ni Telegram'ga
ro'yxatdan o'tkazadi. Token noto'g'ri yoki bot'ga `setWebhook` permission
yo'q bo'lsa, Sync Status sahifasida xato ko'rinadi.

**Image build sekin**
→ Birinchi build ~5-8 daq. Keyingilari pnpm-store cache tufayli ~1-2 daq.

## 10. Yangilanish

Git'ga push qiling → Dokploy webhook orqali avtomatik qayta deploy qiladi
(agar "Auto deploy on push" yoqilgan bo'lsa). Aks holda dashboard'da
**Deploy** tugmasini qo'lda bosing.

`prisma/migrations/` ichida yangi migration bo'lsa, api container avtomatik
ishlatadi.
