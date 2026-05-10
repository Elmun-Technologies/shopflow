# ShopFlow Deploy qo'llanmasi

ShopFlow — **multi-tenant SaaS platforma**. Bir marta deploy qiling, har mijoz
o'zining bot tokenini kiritsa avtomatik ishlaydi.

Production'da ishga tushirish uchun:
- ✅ HTTPS bilan domen (Telegram webhook va Mini App talab qiladi)
- ✅ Docker + docker-compose (yoki har xil orkestratsiya)
- ✅ Reverse proxy (Caddy / nginx / Cloudflare Tunnel)

## 🎯 Multi-tenant arxitektura — qanday ishlaydi

```
1. SIZ (super-admin) ShopFlow'ni bir marta deploy qilasiz
   → https://app.shopflow.uz (frontend)
   → https://api.shopflow.uz (backend)

2. Har mijoz dashboard'ga kiradi → ro'yxatdan o'tadi → o'z do'konini yaratadi

3. Mijoz BotFather'dan o'z tokenini oladi → dashboard'da "Telegram Bot → Ulash"
   bosadi → tokenni yopishtiradi

4. Backend AVTOMATIK:
   ✓ Tokenni Telegram'da tekshiradi
   ✓ Mini App URL'ni qiladi: https://app.shopflow.uz/mini/{botId}
   ✓ Telegram'da bot menyusiga "Do'kon" tugmasini o'rnatadi
   ✓ Webhook'ni o'rnatadi: https://api.shopflow.uz/tg/webhook/{botId}

5. Mijoz xaridorlari botni ochib /start bossa - to'liq do'kon tayyor
```

**Mijozdan boshqa hech narsa talab qilinmaydi** — token yetarli.

## 1. Domenni sozlash

Ikki subdomen kerak:
- **app.shopflow.uz** — frontend (Mini App + admin dashboard)
- **api.shopflow.uz** — backend (REST + Telegram webhook + WebSocket)

Yoki bitta domen ostida path bo'yicha ham bo'ladi:
- `https://shopflow.uz/` — frontend
- `https://shopflow.uz/api/` — backend (nginx orqali proxy)
- `https://shopflow.uz/tg/webhook/` — Telegram webhook
- `https://shopflow.uz/mini/{botId}` — Mini App
- `https://shopflow.uz/api/ws` — WebSocket

## 2. .env tayyorlash

```bash
cp .env.example .env

# JWT_SECRET va ENCRYPTION_KEY uchun random qiymat:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# .env'da to'ldiring:
WEB_URL=https://app.shopflow.uz
PUBLIC_URL=https://api.shopflow.uz
JWT_SECRET=<yuqorida olingan>
ENCRYPTION_KEY=<boshqa random 64 hex>
```

## 3. Docker Compose bilan ishga tushirish

```bash
docker-compose up -d --build
```

Containerlar:
- `shopflow-server` — backend (port 4000 ichkarida)
- `shopflow-web` — frontend nginx (port 80)

## 4. HTTPS uchun Caddy (eng oson)

`Caddyfile`:

```
app.shopflow.uz {
    reverse_proxy localhost:80
}

api.shopflow.uz {
    reverse_proxy localhost:4000
}
```

Caddy avtomatik Let's Encrypt sertifikat oladi.

## 5. Bot ulashda tekshirish

1. ShopFlow'ga login qiling: `https://app.shopflow.uz`
2. **Settings → Telegram Bot → Ulash**
3. BotFather tokenini yopishtiring
4. Backend avtomatik:
   - Tokenni Telegram'da tekshiradi (`getMe`)
   - Webhook o'rnatadi (`https://api.shopflow.uz/tg/webhook/{botId}`)
   - Mini App tugmasini sozlaydi (`https://app.shopflow.uz/mini/{botId}`)

## 6. MoySklad ulash

**Settings → Integratsiyalar → MoySklad → Ulash**

Variantlar:
- **Bearer token** (tavsiya etiladi): MoySklad → Sozlamalar → API → Token yarating
- **Login/parol**: Hisob ma'lumotlari (xavfsizroq emas)

Mahsulotlar avtomatik sinxronlanmaydi — "Sync" tugmasini bosing yoki cron ishga tushiring.

## 7. Click ulash

**Click merchant kabineti** → Service yarating:

- **Service URL**: `https://api.shopflow.uz/api/payments/click/{shopId}`
- **Tahminiy hodisalar**: Prepare, Complete

ShopFlow → Settings → Integratsiyalar → Click → ulash:
- Merchant ID
- Service ID
- Secret key

## 8. Payme ulash

**Payme merchant kabineti** → Yangi merchant:

- **Endpoint**: `https://api.shopflow.uz/api/payments/payme/{shopId}`
- **Auth**: Basic (Payme avtomatik)

ShopFlow → Settings → Integratsiyalar → Payme → ulash:
- Merchant ID
- Merchant key

## 9. Database backup

SQLite holatida:
```bash
# Backup
docker-compose exec server cp /data/shopflow.db /data/shopflow-$(date +%Y%m%d).db

# Yoki host'ga
docker cp shopflow-server:/data/shopflow.db ./backups/
```

Postgres'ga ko'chirish (kelajakda):
1. `server/drizzle.config.ts` da `dialect: "postgresql"` qiling
2. `pg` driver o'rnating
3. `DATABASE_URL=postgres://...` env'da
4. `pnpm db:generate && pnpm db:migrate`

## 10. Monitoring (tavsiya)

- **Sentry** — `SENTRY_DSN=...` env'ga qo'shing
- **Uptime Robot** — `https://api.shopflow.uz/health` ni tekshiradi
- **Logs** — `docker-compose logs -f server`

## 11. Yangilash

```bash
git pull
docker-compose build
docker-compose up -d
```

Migrations avtomatik ishga tushadi (server start'da).

## 12. Xavfsizlik tekshiruvi

- ✅ JWT_SECRET random va sir
- ✅ ENCRYPTION_KEY random va sir
- ✅ HTTPS o'rnatilgan
- ✅ Telegram webhook secret_token tekshiriladi
- ✅ Mini App initData HMAC tekshiriladi
- ✅ Click signature md5 tekshiriladi
- ✅ Payme Basic auth tekshiriladi
- ⚠️ Bot tokenlari DB'da AES-256-GCM bilan shifrlangan
- ⚠️ Production'da ENCRYPTION_KEY **hech qachon** o'zgartirmang — eski bot tokenlari decode bo'lmaydi

## 13. Tezkor checklist

- [ ] Domen sozlangan (DNS A record)
- [ ] HTTPS sertifikat (Let's Encrypt yoki Cloudflare)
- [ ] `.env` to'liq to'ldirilgan
- [ ] `docker-compose up -d` muvaffaqiyatli
- [ ] `https://api.shopflow.uz/health` qaytaradi `{ok:true}`
- [ ] `https://app.shopflow.uz` ochiladi
- [ ] Settings → Telegram Bot → ulash ishlaydi
- [ ] BotFather'da Mini App URL ko'rinadi (menyu tugmasi)
- [ ] Test buyurtma → admin dashboard'da ko'rinadi

Agar muammo bo'lsa: `docker-compose logs -f server`
