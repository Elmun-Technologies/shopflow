# Production deploy yo'riqnomasi

Bu hujjat ShopFlow'ni bir nechta tenant uchun yagona VPS'da (Docker Compose +
NGINX + Let's Encrypt) ishga tushirish bo'yicha to'liq amaliyot. Boshlanishda
~50 tenantgacha 4 vCPU / 8 GB RAM yetadi.

## 1. Talablar

- Ubuntu 22.04 LTS (yoki Debian 12) VPS
- 4 vCPU, 8 GB RAM, 80 GB SSD (boshlash uchun)
- Public IP va DNS:
  - `api.shopflow.uz`        → API
  - `admin.shopflow.uz`      → admin SPA (Vite build)
  - `app.shopflow.uz`        → Telegram Mini App (Vite build)
  - `*.shopflow.uz`          → Next.js storefront (wildcard)
- DNS'da `*.shopflow.uz` va sanab o'tilgan host'lar uchun A record
- Docker 26+ va `docker compose` plugin

## 2. Sirlar va env

VPS'da `/opt/shopflow/.env` fayli yarating:

```bash
# Kuchli random sirlar — quyidagi komanda bilan generatsiya qiling
JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SECRETS_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
REVALIDATE_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

`SECRETS_ENCRYPTION_KEY`'ni **hech qachon o'zgartirmang** — bu MoySklad va
Telegram tokenlarini deshifrlash kaliti. O'zgartirilsa, barcha tenantlar
qaytadan token kiritishi kerak.

Postgres backup S3-mos saqlovga (Backblaze B2 / Yandex Object Storage)
yo'naltirilishi tavsiya etiladi.

## 3. NGINX konfiguratsiyasi

`/etc/nginx/sites-enabled/shopflow.conf`:

```nginx
# ---------- API ----------
server {
    listen 443 ssl http2;
    server_name api.shopflow.uz;
    ssl_certificate     /etc/letsencrypt/live/api.shopflow.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.shopflow.uz/privkey.pem;

    client_max_body_size 8m;
    proxy_read_timeout 60s;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Prometheus scrape ko'rsatkichi faqat ichki tarmoqdan
    location /metrics {
        allow 10.0.0.0/8;
        allow 127.0.0.1;
        deny all;
        proxy_pass http://127.0.0.1:4000;
    }
}

# ---------- Admin SPA (Vite static) ----------
server {
    listen 443 ssl http2;
    server_name admin.shopflow.uz;
    ssl_certificate     /etc/letsencrypt/live/admin.shopflow.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.shopflow.uz/privkey.pem;

    root /var/www/shopflow-admin;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}

# ---------- Mini App (Vite static) ----------
server {
    listen 443 ssl http2;
    server_name app.shopflow.uz;
    ssl_certificate     /etc/letsencrypt/live/app.shopflow.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.shopflow.uz/privkey.pem;

    root /var/www/shopflow-miniapp;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
}

# ---------- Storefront (Next.js wildcard) ----------
server {
    listen 443 ssl http2;
    server_name *.shopflow.uz;
    ssl_certificate     /etc/letsencrypt/live/shopflow.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/shopflow.uz/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP -> HTTPS
server {
    listen 80;
    server_name api.shopflow.uz admin.shopflow.uz app.shopflow.uz *.shopflow.uz;
    return 301 https://$host$request_uri;
}
```

Let's Encrypt sertifikatlari:

```bash
sudo certbot --nginx -d api.shopflow.uz -d admin.shopflow.uz -d app.shopflow.uz
# Wildcard uchun DNS-01 challenge kerak:
sudo certbot certonly --manual --preferred-challenges dns -d "*.shopflow.uz" -d shopflow.uz
```

## 4. Docker Compose (production)

`/opt/shopflow/docker-compose.prod.yml`:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: shopflow
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: shopflow
    volumes:
      - /opt/shopflow/data/pg:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shopflow"]
      interval: 10s

  redis:
    image: redis:7-alpine
    command: redis-server --save 60 1000 --appendonly yes
    volumes:
      - /opt/shopflow/data/redis:/data
    restart: unless-stopped

  api:
    image: ghcr.io/elmun-technologies/shopflow-api:${VERSION}
    env_file: .env
    ports: ["127.0.0.1:4000:4000"]
    depends_on: [postgres, redis]
    restart: unless-stopped

  worker:
    image: ghcr.io/elmun-technologies/shopflow-worker:${VERSION}
    env_file: .env
    depends_on: [postgres, redis]
    restart: unless-stopped
    deploy:
      replicas: 2

  bot:
    image: ghcr.io/elmun-technologies/shopflow-bot:${VERSION}
    env_file: .env
    depends_on: [postgres, redis]
    restart: unless-stopped

  storefront:
    image: ghcr.io/elmun-technologies/shopflow-storefront:${VERSION}
    env_file: .env
    ports: ["127.0.0.1:3000:3000"]
    restart: unless-stopped
```

Ishga tushirish:

```bash
cd /opt/shopflow
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec api pnpm db:migrate:deploy
docker compose -f docker-compose.prod.yml exec api pnpm db:seed
```

## 5. Backup va monitoring

**Postgres backup** (har kuni 02:00 UZT):

```cron
0 2 * * * docker exec shopflow-postgres-1 pg_dump -U shopflow shopflow | gzip | aws --endpoint=https://s3.eu-central-003.backblazeb2.com s3 cp - s3://shopflow-backups/$(date +\%F).sql.gz
```

**Monitoring**:
- Prometheus `http://api.shopflow.uz/metrics` (faqat ichki IP'dan)
- Grafana dashboard: `docs/grafana-dashboard.json` (yangilanmoqda)
- Sentry: `.env`'da `SENTRY_DSN` o'rnatilgandan keyin api, worker va bot
  avtomatik xato'larni yuboradi
- Telegram alert bot uchun PR keyingi sprintda

## 6. CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml` — keyingi PR'da):

1. `main` branch'ga push'da har bir servis uchun Docker image quriladi va
   `ghcr.io/elmun-technologies/shopflow-*:<sha>`'ga push qilinadi
2. VPS'da Watchtower yoki SSH orqali `docker compose pull && up -d`

## 7. Tenant onboarding

Yangi mijoz ulanganda hech qanday VPS o'zgarishi kerak emas:

1. Mijoz `https://admin.shopflow.uz`'da ro'yxatdan o'tadi (tenantSlug tanlaydi)
2. Admin paneldan MoySklad token va Telegram bot tokenini kiritadi
3. `<slug>.shopflow.uz`'da uning storefronti avtomatik mavjud bo'ladi
4. Bot @BotFather'da yaratilgan bot tokeni orqali ulanadi

## 8. Yuk testi

Productionga chiqarishdan oldin:

```bash
k6 run -e API_URL=https://api.shopflow.uz \
       -e TENANTS=demo,test1,test2 \
       scripts/k6-storefront.js
```

SLO'lar:
- `p95(http_req_duration) < 400ms`
- `errors_rate < 0.5%`
- cross-tenant leak yo'q (testlarda tenant A JWT bilan tenant B mahsuloti
  so'ralganda → 404)

## 9. Xavfsizlik tekshiruvi

- [ ] `.env` fayli `chmod 600`
- [ ] PostgreSQL faqat localhost'dan ulanish (firewall yoki `listen_addresses`)
- [ ] Redis `requirepass` o'rnatilgan
- [ ] NGINX'da Real IP ehromi (`X-Forwarded-For` to'g'ri sozlangan)
- [ ] Telegram va Click/Payme webhook URL'lari `https://`
- [ ] Sertifikatlar avtomatik yangilanadi (`certbot --dry-run`)
