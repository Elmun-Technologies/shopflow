# Fly.io deploy

ShopFlow'ni Fly.io'ga ikki app sifatida deploy qilamiz:

```text
shopflow-frontend (public HTTPS, nginx :80)
        │ private Fly network: shopflow-backend.internal:4000
        ▼
shopflow-backend (Fastify + Prisma, :4000)
        │
        ▼
PostgreSQL (Fly Postgres yoki tashqi managed PostgreSQL)
```

Caddy va root `docker-compose.yml` Fly deploy uchun ishlatilmaydi. Frontend
nginx `/api/*` va `/uploads/*` ni backend app'ga private network orqali proxy
qiladi. Shu sababli browser faqat bitta public domainni ko'radi va mavjud
relative API/upload URL'lari ishlashda davom etadi.

## 1. Talablar

- `flyctl` o'rnatilgan va `fly auth login` bajarilgan;
- PostgreSQL tayyor, yoki Fly Postgres cluster yaratilgan;
- PostgreSQL'ning regioni backend regioniga yaqin (default `fra`);
- app nomlari Fly account ichida bo'sh.

Fly app nomlari global bo'lishi mumkin. `fly/backend.toml` va
`fly/frontend.toml` dagi `app` qiymatlarini oldindan o'zgartiring. Frontend
config'dagi `BACKEND_APP` backend app nomi bilan aynan bir xil bo'lishi kerak.

## 2. App'larni yaratish

```bash
fly auth login
fly apps create shopflow-backend
fly apps create shopflow-frontend
```

Agar `app` nomlari config'da o'zgartirilgan bo'lsa, shu nomlardan foydalaning.

## 3. Backend volume yaratish

Dastlabki single-Machine deploy uchun upload va 1C fayllari bitta Fly Volume'da
saqlanadi:

```bash
fly volumes create shopflow_data \
  --app shopflow-backend \
  --region fra \
  --size 10
```

Fly Volume bitta region/server/Machine'ga bog'langan va avtomatik replikatsiya
qilinmaydi. Production'da muntazam offsite backup shart. Katta yoki bir nechta
Machine'li tizim uchun upload'larni Cloudflare R2/S3'ga o'tkazish tavsiya qilinadi.

## 4. Backend secrets

Mavjud production'ni ko'chirayotgan bo'lsangiz, eski `JWT_SECRET` va
`SECRETS_ENCRYPTION_KEY` qiymatlarini saqlang. PostgreSQL dump restore qilinganda
`DATABASE_URL` yangi serverdagi DB'ga ko'rsatiladi.

Minimal konfiguratsiya:

```bash
fly secrets set --app shopflow-backend \
  DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require' \
  JWT_SECRET='OLD_OR_NEW_RANDOM_32_PLUS_CHARS' \
  SECRETS_ENCRYPTION_KEY='OLD_OR_NEW_DIFFERENT_RANDOM_KEY' \
  DOMAIN='shop-flow.uz' \
  PUBLIC_URL='https://shop-flow.uz' \
  CORS_ORIGIN='https://shop-flow.uz' \
  EMAIL='admin@shop-flow.uz'
```

Ixtiyoriy production qiymatlari kerak bo'lsa, o'sha `.env` dan qo'shing:

- `GOOGLE_CLIENT_ID`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, model qiymatlari
- `SENTRY_DSN`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `ESKIZ_LOGIN`, `ESKIZ_PASSWORD`, `ESKIZ_FROM`
- `METRICS_TOKEN`
- `ONEC_*` va payment integration qiymatlari, agar ishlatilsa

`SEED_*` restore qilingan DB uchun kerak emas. Faqat bo'sh database'da birinchi
admin yaratish uchun ishlatiladi.

## 5. Eski database va upload'larni ko'chirish

Eski serverdan `SERVER_MIGRATION.md` bo'yicha:

1. backend va yozuv qabul qiluvchi servislarni to'xtating;
2. `pg_dump` oling;
3. `uploads_data` ni `uploads.tar.gz` qilib oling;
4. arxiv checksum'larini tekshiring.

Yangi PostgreSQL'ga restore qiling. Masalan:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require'
gunzip -c shopflow.sql.gz | psql "$DATABASE_URL"
```

Fly Postgres ishlatilsa, Fly'ning PostgreSQL import usulidan yoki oddiy
`pg_dump`/`psql` orqali restore qiling. Restore tugamaguncha backend deploy
qilmang.

Upload arxivini backend Machine'iga yuboring. Backend deploy qilingan va volume
mount bo'lgan bo'lishi kerak:

```bash
fly ssh sftp put uploads.tar.gz /tmp/uploads.tar.gz --app shopflow-backend
fly ssh console --app shopflow-backend \
  -C 'mkdir -p /data/uploads && tar xzf /tmp/uploads.tar.gz -C /data/uploads && rm -f /tmp/uploads.tar.gz'
```

Agar `onec_exchange_data` ham ko'chirilsa, ikkinchi arxivni `/data/1c-exchange`
katalogiga xuddi shu tarzda extract qiling. Bu usul single-Machine migration uchun;
keyinchalik R2/S3 ishlatilsa arxivni object storage'ga import qilish kerak.

## 6. Backend deploy

Backend Dockerfile build context sifatida `backend/` katalogini kutadi:

```bash
cd backend
fly deploy --config ../fly/backend.toml
cd ..
```

Tekshiring:

```bash
fly status --app shopflow-backend
fly logs --app shopflow-backend
fly checks list --app shopflow-backend
```

Backend private network'da ham `/health` endpoint'iga javob berishi kerak. Prisma
migration runner container startup'da ishlaydi. Restore qilingan database'da
migration tarixi bo'lsa, faqat yetishmayotgan migration'lar qo'llanadi.

## 7. Frontend deploy

`fly/frontend.toml` dagi quyidagi qiymatlarni tekshiring:

```toml
[build.args]
  BACKEND_APP = "shopflow-backend"
  VITE_GOOGLE_CLIENT_ID = ""
  VITE_SENTRY_DSN = ""
```

`BACKEND_APP` backend app bilan bir xil bo'lishi shart. Keyin root katalogdan:

```bash
fly deploy --config fly/frontend.toml
```

Nginx `/api` va `/uploads` ni quyidagiga yo'naltiradi:

```text
http://shopflow-backend.internal:4000
```

Backend app frontend'dan oldin deploy qilingan bo'lishi kerak.

## 8. Domain va HTTPS

Fly frontend app'ga domain qo'shing:

```bash
fly certs add shop-flow.uz --app shopflow-frontend
fly certs add www.shop-flow.uz --app shopflow-frontend
fly certs show shop-flow.uz --app shopflow-frontend
```

Fly ko'rsatgan DNS A/AAAA/CNAME record'larini domain panelida yarating. DNS
aktiv bo'lgach:

```bash
curl -fsS https://shop-flow.uz/health
curl -fsS https://shop-flow.uz/api/health
curl -I https://shop-flow.uz/vendor/telegram-web-app.js
```

`/api/health` javobida `db: "ok"` bo'lishi kerak.

## 9. Google OAuth build sozlamasi

Google login ishlatilsa, `fly/frontend.toml` dagi
`VITE_GOOGLE_CLIENT_ID` qiymatini to'ldiring va qayta deploy qiling. Backend'da
ham aynan shu qiymat `GOOGLE_CLIENT_ID` sifatida secret bo'lishi kerak.

Google Cloud Console'da yangi frontend domainini Authorized JavaScript origins
ro'yxatiga qo'shing.

## 10. Integratsiyalarni tekshirish

Bitta public frontend domain ishlatilgani uchun quyidagi endpoint'lar URL'i
odatda o'zgarmaydi:

- Telegram: `/api/webhooks/telegram/<webhookKey>`
- 1C: `/api/1c/exchange`
- Click/Payme/Uzum callback'lari
- public API: `/api/v1`

Domain o'zgargan bo'lsa, barcha provayder dashboard'laridagi callback URL'larni
almashtiring. Telegram `getWebhookInfo`, test order, test payment va 1C test
exchange bajarilsin.

## 11. Backup va worker cheklovi

Hozirgi backend process quyidagi scheduler/worker'larni ishga tushiradi:

- abandoned cart notifications;
- email reports;
- SalesDoctor worker;
- bot sequence worker.

Shuning uchun backend'ni dastlab **bitta Machine** bilan qoldiring. Bir nechta
Machine kerak bo'lsa worker'larni alohida app/job yoki distributed lock bilan
ajratish kerak, aks holda xabarlar takror yuborilishi mumkin.

Fly Volume snapshot'larini yagona backup deb qabul qilmang. PostgreSQL uchun
muntazam `pg_dump` va offsite S3/R2 backup sozlang; uploads uchun ham R2/S3
backup yoki volume archive qiling.

## 12. Rollback

```bash
fly releases --app shopflow-frontend
fly releases --app shopflow-backend
fly deploy --image <OLD_IMAGE> --app shopflow-frontend
```

Database migration'lari down-migration emas. Schema o'zgarishidan oldin backup
oling; rollback zarur bo'lsa tuzatuvchi migration yoki database restore ishlating.

Eski VPS'ni DNS cutover'dan keyin darhol o'chirmang. Webhook dublikatlaridan
qochish uchun eski va yangi backend bir vaqtning o'zida production webhook'larni
qabul qilmasin.
