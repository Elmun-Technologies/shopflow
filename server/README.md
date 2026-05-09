# ShopFlow Server

Telegram bot + integratsiyalar uchun backend.

## Stack
- Node.js 20 + TypeScript
- Fastify (HTTP)
- grammY (Telegram bot framework)
- Drizzle ORM + SQLite (development)
- JWT auth, bcryptjs hashing
- AES-256-GCM bilan bot tokenlarni shifrlash

## Ishga tushirish

```bash
cd server
pnpm install
cp .env.example .env
# .env'da JWT_SECRET va ENCRYPTION_KEY ni o'zgartiring (yoki avto generatsiya):
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))" >> .env

pnpm db:migrate
pnpm dev          # http://localhost:4000
```

## Endpoints

### Auth
- `POST /api/auth/register` — `{ email, password, name, shopName }` → `{ token, user, shop }`
- `POST /api/auth/login` — `{ email, password }` → `{ token, user, shop }`
- `GET /api/auth/me` — JWT bilan, `{ userId, shopId }` qaytaradi

### Botlar
JWT kerak (Authorization: Bearer ...).
- `GET /api/bots` — ulanagn botlar ro'yxati
- `POST /api/bots` — `{ token: "BotFather'dan olgan token" }` → bot validatsiya, ulash, polling/webhook ishga tushirish
- `GET /api/bots/:id/status` — Telegram'dan jonli holat
- `DELETE /api/bots/:id` — botni uzish

### Webhook
- `POST /tg/webhook/:botId` — Telegram'dan keladi (PUBLIC_URL bo'lsa avtomatik ulanadi)

## Bot rejimlari

- **`PUBLIC_URL` bo'sh** → bot **polling** rejimida ishlaydi (development)
- **`PUBLIC_URL=https://api.shopflow.uz`** → webhook avtomatik o'rnatiladi

## DB

SQLite fayl `data/shopflow.db` da. Production'da `DATABASE_URL` ni Postgres'ga o'zgartiring va Drizzle config'da `dialect: 'postgresql'` qiling.

## Production tayyorlash

1. PostgreSQL'ga o'tish (drizzle config + driver)
2. Redis qo'shish (session, queue)
3. Webhook secret rotation
4. Rate limiting plugin
5. Sentry/Pino transport
6. Docker + docker-compose
