# Dokploy / Docker Compose bilan deploy

> **Muhim:** ShopFlow faqat frontend emas. Production stack'ida PostgreSQL,
> Fastify backend, nginx frontend, Caddy HTTPS va backup service bor. Root
> `Dockerfile` faqat frontend image'ini quradi; uni Dokploy'da yakka Application
> sifatida deploy qilsangiz, login/API ishlamaydi.

## Tavsiya etiladigan variant

Migratsiya uchun Ubuntu 22.04+/Debian 12+ VPS'da quyidagilarni ishlating:

```bash
cd /opt
# Private repo uchun deploy key yoki GitHub CLI ishlating.
# Tokenni git remote URL'iga yozib qoldirmang.
git clone https://github.com/Elmun-Technologies/shopflow.git
cd shopflow
cp .env.example .env
chmod 600 .env
nano .env

docker compose up -d --build
```

`.env` dagi `DOMAIN`, `PUBLIC_URL`, `CORS_ORIGIN`, PostgreSQL paroli, JWT
secret, `SECRETS_ENCRYPTION_KEY` va seed admin ma'lumotlarini yangi serverga
moslang. Batafsil ko'chirish tartibi: **`SERVER_MIGRATION.md`**.

## Dokploy'da ishlatish shart bo'lsa

Dokploy Compose/Stack sifatida butun `docker-compose.yml` ni ishga tushira
olishi va quyidagilarni ta'minlashi kerak:

1. `postgres`, `backend`, `shopflow`, `caddy`, `backup` servislarining barchasi
   ishga tushadi;
2. `/var/lib/postgresql/data`, `/app/uploads`, `/app/1c-exchange`, Caddy `/data`
   va backup volume'lari **persistent** bo'ladi;
3. 80/443 portlar Caddy'ga beriladi; tashqi reverse-proxy bo'lsa WebSocket/SSE
   va `X-Forwarded-*` headerlari saqlanadi;
4. Docker Compose environment interpolation ishlaydi va `.env` secret'lari
   build/runtime bosqichlariga uzatiladi;
5. PostgreSQL backup'lari yangi deployment bilan o'chib ketmaydi.

Dokploy o'zining HTTPS proxy'sini ishlatsa, Compose ichidagi Caddy bilan 80/443
port to'qnashuvi bo'lmasligi uchun faqat bitta reverse-proxy qoldiriladi. Bunday
holatda Caddyfile routing'ini proxy konfiguratsiyasiga ko'chirish kerak:

- `/api/*` → `backend:4000`
- `/uploads/*` → `shopflow:80`
- qolgan route'lar → `shopflow:80`

## Deploydan keyingi tekshiruv

```bash
docker compose ps
curl -fsS https://YOUR_DOMAIN/health
curl -fsS https://YOUR_DOMAIN/api/health

docker compose logs --tail=100 backend
```

`/api/health` javobida `{"status":"ok","db":"ok"}` bo'lishi kerak. Restore
qilingan database'da `npm run seed` ni ishlatmang; seed faqat yangi, bo'sh DB uchun.
