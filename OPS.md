# ShopFlow Operations Manual

Manual deploy, monitoring, backup va incident response.

## Birinchi marta o'rnatish

```bash
cd /opt && git clone https://github.com/Elmun-Technologies/shopflow.git
cd shopflow
cp .env.example .env
nano .env
# - JWT_SECRET: `openssl rand -hex 32`
# - SECRETS_ENCRYPTION_KEY: yana boshqa `openssl rand -hex 32`
# - POSTGRES_PASSWORD: kuchli parol
# - DOMAIN, EMAIL, PUBLIC_URL: o'z domeningiz

docker compose up -d --build
curl -s https://your-domain.uz/api/health  # {"status":"ok","db":"ok",...}
```

## Manual deploy (yangilanish)

```bash
ssh root@<server>
cd /opt/shopflow
git fetch origin && git reset --hard origin/main
docker compose up -d --build backend shopflow
docker compose logs --tail=20 backend
```

## Schema migration

Backend ishga tushganda `prisma db push` avtomatik (additive schema).
Yangi unique constraint qo'shilsa "data loss" ogohlantirishi chiqishi
mumkin — yangi ustun bo'sh bo'ladi, xavfsiz:

```bash
docker compose run --rm --entrypoint sh backend -c \
  "npx prisma db push --accept-data-loss --skip-generate"
docker compose up -d backend
```

## Backup va restore

**Avtomatik:** `backup` service har 24 soatda `pg_dump | gzip`. 7 kun saqlanadi.

**Lokalga nusxalash:**
```bash
docker run --rm -v shopflow_backup_data:/data alpine tar czf - /data \
  | ssh root@<remote> "cat > /backups/shopflow-$(date +%F).tar.gz"
```

**Restore (DANGER):**
```bash
docker compose stop backend
docker compose exec postgres sh -c \
  "gunzip < /backups/shopflow_YYYYMMDD_HHMMSS.sql.gz | psql -U shopflow shopflow"
docker compose start backend
```

## Monitoring

| Endpoint | Maqsad |
|---|---|
| `GET /health` | Backend + DB ping (200 ok, 503 degraded) |
| `GET /api/health` | Caddy proxy path |

```bash
# Real-time loglar
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f backup

# Container holati
docker compose ps

# Disk usage
du -sh /var/lib/docker/volumes/shopflow_*
```

## Incident playbook

### Backend ishlamayapti
1. `docker compose ps` — backend "unhealthy"mi?
2. `docker compose logs --tail=50 backend` — xato xabari
3. Eng tez-tez sabab: DATABASE_URL noto'g'ri, JWT_SECRET yo'q, schema sync xatosi

### "Database is locked" yoki ulanish xatosi
1. `docker compose logs postgres` — postgres healthy?
2. `docker compose restart postgres backend`

### TLS / sertifikat
1. `docker compose logs caddy` — Let's Encrypt xatosimi?
2. DNS A record + port 80/443 ochiqligini tekshiring

### Yangi feature buzdi
1. `git log --oneline -10` — oxirgi merge
2. Rollback: `git reset --hard <oldingi_commit> && docker compose up -d --build`

## Resurs sozlash

`docker-compose.yml`:
- `backend.mem_limit: 1g, cpus: 1.5`
- `postgres.mem_limit: 1g`
- `backup.mem_limit: 256m`

VPS RAM'iga qarab moslang.

## Monitoring (Prometheus metrics)

Backend `/metrics` endpoint'i Prometheus formatida metrikalarni beradi:
- `http_requests_total`, `http_request_duration_seconds`, `http_requests_in_flight`
- Node default: CPU, xotira, event-loop lag, GC

**Xavfsizlik:** `/metrics` Caddy orqali ommaga ochilmaydi (Caddy faqat `/api/*` ni
proxy qiladi) — faqat ichki Docker tarmog'idan (`backend:4000/metrics`) erishiladi.
Qo'shimcha himoya uchun `METRICS_TOKEN` o'rnating; prod'da token bo'lmasa endpoint
o'chiq (503 qaytaradi).

Prometheus scrape namunasi:

```yaml
scrape_configs:
  - job_name: shopflow
    metrics_path: /metrics
    bearer_token: "<METRICS_TOKEN>"
    static_configs:
      - targets: ["backend:4000"]
```

## Production checklist

- [ ] `.env` da JWT_SECRET 32+ belgi, random
- [ ] `SECRETS_ENCRYPTION_KEY` alohida (JWT'dan farq)
- [ ] `POSTGRES_PASSWORD` kuchli (15+ belgi)
- [ ] Backup volume tashqariga nusxalanadi (rsync/S3)
- [ ] Sentry DSN sozlangan (`SENTRY_DSN`)
- [ ] `METRICS_TOKEN` o'rnatilgan (prod `/metrics` himoyasi)
- [ ] DNS A record va port 80/443 ochiq
- [ ] `docker compose logs caddy` da TLS xato yo'q
- [ ] `/health` 200 qaytaryapti
- [ ] First admin user yaratilgan (seed.ts orqali)
