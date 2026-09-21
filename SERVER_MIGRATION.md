# ShopFlow'ni boshqa serverga ko'chirish

Bu hujjat production'dagi ShopFlow'ni yangi VPS/serverga **ma'lumotlar yo'qolmasdan**
ko'chirish uchun. Stack Docker Compose orqali boshqariladi:

```text
Caddy (80/443, HTTPS)
  ├── frontend nginx (React SPA + /uploads)
  └── Fastify backend :4000
          └── PostgreSQL 16
```

## 1. Ko'chiriladigan ma'lumotlar

| Ma'lumot | Qayerda | Muhimligi |
|---|---|---|
| PostgreSQL | `postgres_data` volume / `pg_dump` | **Majburiy** — barcha tenant, user, order, sozlama va integratsiyalar |
| Mahsulot rasmlari | `uploads_data` volume | **Majburiy** — rasm arxivi ko'chirilmasa URL'lar ishlamaydi |
| Integratsiya staging fayllari | `onec_exchange_data` volume | 1C almashinuvi ayni paytda davom etayotgan bo'lsa ko'chiring |
| Caddy sertifikat/cache | `caddy_data`, `caddy_config` | Shart emas; Caddy sertifikatni qayta oladi, lekin ko'chirish rate-limit xavfini kamaytiradi |
| Local backup'lar | `backup_data` volume | Shart emas, offsite backup bo'lsa yanada yaxshi |
| `.env` | serverdagi fayl | **Majburiy**, secret'larni yo'qotmang |

`JWT_SECRET` o'zgarsa faol login sessiyalari tugaydi. `SECRETS_ENCRYPTION_KEY`
o'zgarsa MoySklad/1C/Sales Doctor/Click/Payme/Uzum kabi shifrlangan tokenlar
ochilmay qolishi mumkin. Ko'chirishda ikkalasining ham eski qiymatini saqlang.

## 2. Yangi server talablari

- Ubuntu 22.04+ yoki Debian 12+
- Docker Engine va Docker Compose v2
- kamida 2 vCPU, 4 GB RAM (resurs limitlari yig'indisi taxminan 2.7 GB)
- DB va upload hajmiga yetadigan disk; kamida 20 GB bo'sh joy tavsiya qilinadi
- tashqaridan ochiq TCP 80 va 443; SSH faqat kerakli IP'lar uchun
- yangi server IP'siga DNS A-record (va ishlatilsa AAAA-record) tayyor

Portlar band emasligini tekshiring:

```bash
ss -lntp | grep -E ':(80|443)\\b' || true
```

Agar boshqa nginx/Apache ishlayotgan bo'lsa, Caddy bilan bir xil 80/443 portni
ishlatmasin.

## 3. Yangi serverni tayyorlash

Repo private bo'lsa, deploy key yoki GitHub CLI'dan foydalaning. PAT'ni Git remote
URL'iga yozib qoldirmang.

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl git ufw openssl
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

mkdir -p /opt/shopflow
cd /opt/shopflow
# Repo'ni xavfsiz usul bilan clone qiling, so'ng origin tokenless bo'lsin.
git clone https://github.com/Elmun-Technologies/shopflow.git .
```

Kerakli branch'ni tanlang:

```bash
git fetch origin
git checkout -B main origin/main
```

Agar private repo clone qilishda HTTPS token ishlatilsa, command tugagach remote'ni
tekshiring va token qolmaganiga ishonch hosil qiling:

```bash
git remote -v
git remote set-url origin https://github.com/Elmun-Technologies/shopflow.git
```

## 4. `.env` ni tayyorlash

Eski serverdagi `.env` ni secret'lar bilan birga xavfsiz kanal orqali ko'chiring.
Agar domain o'zgarsa quyidagilarni **yangi domain**ga almashtiring:

```dotenv
DOMAIN=shopflow.new-domain.uz
PUBLIC_URL=https://shopflow.new-domain.uz
CORS_ORIGIN=https://shopflow.new-domain.uz
EMAIL=admin@example.com
```

Quyidagilarni esa ko'chirish davrida odatda o'zgartirmang:

```dotenv
JWT_SECRET=<eski qiymat>
SECRETS_ENCRYPTION_KEY=<eski qiymat>
POSTGRES_DB=shopflow
POSTGRES_USER=shopflow
POSTGRES_PASSWORD=<yangi yoki eski DB paroli>
SEED_EMAIL=<eski admin email>
SEED_PASSWORD=<faqat yangi bo'sh DB seed qilinsa kerak>
```

Google OAuth ishlatilsa, bir xil client ID'ni ikkala joyga yozing:

```dotenv
GOOGLE_CLIENT_ID=<google client id>
VITE_GOOGLE_CLIENT_ID=<shu client id>
```

So'ng:

```bash
chmod 600 .env
```

**Eslatma:** `.env.example` dagi `SEED_PASSWORD` placeholder'ini production
parol sifatida qoldirmang. Restore qilingan DB uchun seed kerak emas.

## 5. Eski serverdan final backup olish

Eng xavfsiz cutover: yozuvlarni vaqtincha to'xtatib, worker/backend'ni to'xtatish,
keyin DB va uploads'ni olish. Bu ikki nusxa o'rtasidagi farqni yo'qotadi.

### 5.1. Yozuvlarni to'xtatish

Eski serverda:

```bash
cd /opt/shopflow
docker compose stop backend shopflow caddy backup
```

PostgreSQL ishlashda qoladi, shuning uchun undan dump olinadi.

### 5.2. PostgreSQL dump

```bash
mkdir -p /root/shopflow-migration

docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
  | gzip > /root/shopflow-migration/shopflow.sql.gz

gzip -t /root/shopflow-migration/shopflow.sql.gz
sha256sum /root/shopflow-migration/shopflow.sql.gz \
  > /root/shopflow-migration/shopflow.sql.gz.sha256
```

Dump hajmini tekshiring:

```bash
ls -lh /root/shopflow-migration/shopflow.sql.gz*
```

### 5.3. Upload volume'ni arxivlash

`uploads_data` nomi Compose project nomiga bog'liq bo'lishi mumkin. Aniq volume'ni
backend konteyneridan oling:

```bash
UPLOAD_VOLUME="$(docker inspect shopflow-backend --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}')"
echo "$UPLOAD_VOLUME"

docker run --rm \
  -v "$UPLOAD_VOLUME:/data:ro" \
  -v /root/shopflow-migration:/backup \
  alpine:3.20 tar czf /backup/uploads.tar.gz -C /data .

sha256sum /root/shopflow-migration/uploads.tar.gz \
  > /root/shopflow-migration/uploads.tar.gz.sha256
```

Agar 1C almashinuvi ayni paytda staging'da bo'lsa, shu usulda `/app/1c-exchange`
mount'ini ham arxivlang. Caddy va local backup volume'larini faqat kerak bo'lsa
ko'chiring; offsite backup bo'lsa ular shart emas.

## 6. Arxivlarni yangi serverga o'tkazish

Yangi serverda `/root/shopflow-migration` yarating. Eski serverdan `scp` yoki
rsync orqali quyidagilarni o'tkazing:

- `shopflow.sql.gz`
- `shopflow.sql.gz.sha256`
- `uploads.tar.gz`
- `uploads.tar.gz.sha256`
- kerak bo'lsa `onec-exchange.tar.gz`
- yangi serverga mo'ljallangan `.env`

Yangi serverda tekshiring:

```bash
cd /opt/shopflow
sha256sum -c /root/shopflow-migration/shopflow.sql.gz.sha256
sha256sum -c /root/shopflow-migration/uploads.tar.gz.sha256
```

## 7. Yangi serverda restore qilish

> Quyidagi tartib yangi serverdagi **bo'sh** Docker volume'lar uchun. Oldindan
> ishlatilgan DB'ga plain SQL dump'ni qayta yuklamang.

Avval faqat PostgreSQL'ni ishga tushiring:

```bash
cd /opt/shopflow
docker compose up -d postgres
until docker compose exec -T postgres sh -c \
  'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; do
  sleep 2
done
```

SQL dump'ni yangi, bo'sh database'ga yuklang:

```bash
gunzip -c /root/shopflow-migration/shopflow.sql.gz \
  | docker compose exec -T postgres sh -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Keyin backend va frontend'ni build qilib ishga tushiring. Backend startup runner
migratsiyalarni tekshiradi; restore qilingan DB'da `_prisma_migrations` tarixi
bo'lsa, faqat kutilayotgan migration'lar qo'llanadi.

```bash
docker compose up -d --build backend shopflow
docker compose ps
```

Uploads volume backend konteyneri yaratilgandan keyin aniq bo'ladi. Arxivni
extract qilish vaqtida qisman rasmlar ko'rinmasligi uchun ikki servisni qisqa
muddat to'xtating:

```bash
docker compose stop backend shopflow
UPLOAD_VOLUME="$(docker inspect shopflow-backend --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}')"
docker run --rm \
  -v "$UPLOAD_VOLUME:/data" \
  -v /root/shopflow-migration:/backup \
  alpine:3.20 tar xzf /backup/uploads.tar.gz -C /data
```

Agar 1C staging arxivi bo'lsa, backend mount'ini xuddi shu tarzda `/app/1c-exchange`
volume'ga extract qiling. So'ng barcha servislarni ishga tushiring:

```bash
docker compose up -d --build --remove-orphans
```

**Restore qilingan DB'da `docker compose exec backend npm run seed` ni ishlatmang.**
Seed faqat yangi, bo'sh database uchun.

## 8. DNS va HTTPS cutover

1. Yangi serverda `/health` va `/api/health` ni avval loopback orqali tekshiring.
2. DNS `@` A-record'ni yangi IP'ga o'zgartiring. Caddyfile `www.DOMAIN` uchun
   redirect ham yaratadi, shuning uchun `www` uchun A yoki CNAME record ham kerak.
   AAAA-record bo'lsa, u ham to'g'ri IP'ga ko'rsatsin yoki vaqtincha olib tashlansin.
3. Caddy sertifikat olishi uchun TCP 80/443 tashqaridan ochiq bo'lsin.
4. Caddy logini kuzating:

```bash
docker compose logs -f caddy
```

Domain o'zgargan bo'lsa, `.env` o'zgarishidan keyin Caddy'ni recreate qiling:

```bash
docker compose up -d --force-recreate caddy
```

Tekshiruv:

```bash
curl -fsS https://YOUR_DOMAIN/health
curl -fsS https://YOUR_DOMAIN/api/health
curl -I https://YOUR_DOMAIN/
curl -I https://YOUR_DOMAIN/vendor/telegram-web-app.js
```

## 9. Tashqi integratsiyalar checklist'i

Domain yoki IP o'zgarganda quyidagilarni tekshiring:

- [ ] Telegram bot webhook'lari yangi URL'ga o'rnatildi:
      `/api/webhooks/telegram/<webhookKey>`
- [ ] Telegram Mini App URL / BotFather sozlamasi yangilandi
- [ ] Google OAuth'da yangi Authorized JavaScript origin qo'shildi
- [ ] Click / Payme / Uzum callback URL'lari yangilandi
- [ ] 1C CommerceML almashinuvi yangi `/api/1c/exchange` URL'ga o'tkazildi
- [ ] MoySklad webhook subscription yangi public URL bilan tekshirildi
- [ ] SMTP, Eskiz, AI, Sentry, VAPID va backup S3 credential'lari `.env` da bor
- [ ] GitHub Actions `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` secret'lari yangi serverga
      moslandi
- [ ] GitHub repository variable `PRODUCTION_DOMAIN` yangi domain bo'lsa o'rnatildi

Telegram webhook'ni qo'lda tekshirish:

```bash
curl -s "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

Eski domain saqlansa, webhook URL o'zgarmasligi mumkin, lekin yangi serverga DNS
cutover'dan keyin Telegram so'rovlarini albatta test qiling.

## 10. Smoke test va monitoring

```bash
cd /opt/shopflow
docker compose ps
docker compose logs --tail=100 backend

df -h /
docker system df
```

Brauzerda quyidagilarni sinang:

- admin login va refresh-token bilan qayta ochish;
- mahsulot rasmlari va `/uploads/...` URL'lari;
- `/store/<tenant-slug>` storefront;
- test lead/order yaratish;
- Telegram'dan test webhook;
- payment callback'ni test mode'da;
- SSE/chat va browser notification;
- 1C/MoySklad sync kerak bo'lsa, bitta nazorat sinxronizatsiya.

Backup ishlayotganini tekshiring:

```bash
docker compose logs --tail=100 backup
# kerak bo'lsa qo'lda sinov:
docker compose exec backup sh /scripts/backup.sh
```

## 11. Rollback

Eski serverni darhol o'chirmang; kamida bir necha kun **yozuvlarni to'xtatilgan
holda** saqlang. Yangi serverda muammo bo'lsa:

1. yangi serverdagi webhook/yozuvlarni to'xtating;
2. DNS'ni eski IP'ga qaytaring;
3. eski serverda servislarni ishga tushiring:

```bash
cd /opt/shopflow
docker compose up -d
```

Eski server va yangi server bir vaqtda Telegram/payment webhook'larini qabul
qilmasin — aks holda buyurtma/lead dublikatlari paydo bo'lishi mumkin.

## 12. Keyingi avtomatik deploy

Muvaffaqiyatli cutover'dan keyin GitHub Actions deploy workflow'i yangi serverdagi
`/opt/shopflow` checkout'ini ishlatadi. `PRODUCTION_DOMAIN` repository variable'ini
moslang; `deploy-vps.yml` va `production-health.yml` endi domainni shu variable'dan
oladi. `.env` serverda qoladi va git orqali overwrite qilinmaydi.
