# shop-flow.uz ishlamay qolganda tiklash tartibi

## Hozirgi aniqlangan holat

- `shop-flow.uz` DNS Cloudflare proxy orqali ishlayapti; public DNS origin
  server IP'sini ko'rsatmaydi.
- GitHub Actions `Production Health` workflow'i ketma-ket muvaffaqiyatsiz
  bo'lyapti va eng so'nggi run frontend/security headers bosqichida to'xtagan.
- Oxirgi ma'lum muvaffaqiyatli VPS deploy — 2026-08-26. Bu Fly'ga ko'chganini
  emas, production hali VPS workflow orqali boshqarilganini ko'rsatadi.
- Shu sababli birinchi qadam Fly'ga ko'chirish emas, avval mavjud VPS/Kamatera
  server holatini **o'zgartirmasdan diagnostika qilish**.

## 1. GitHub Actions orqali xavfsiz diagnostika

Repository'da `.github/workflows/diagnose-vps.yml` workflow'i bor. U restart,
build, pull yoki volume delete qilmaydi; faqat o'qiydi.

GitHub → Actions → **Diagnose VPS** → **Run workflow** ni ishga tushiring.

U quyidagilarni chiqaradi:

- server hostname, uptime, disk va RAM;
- `/opt/shopflow` mavjudligi va oxirgi commit;
- Docker Compose container holati;
- local `/health` va `/api/health` javoblari;
- 80/443/4000/5432 portlari;
- Caddy, backend va Postgres loglarining oxirgi qismi;
- local TLS certificate sanalari.

Bu workflow uchun mavjud VPS secrets kerak:

```text
VPS_HOST
VPS_USER
VPS_SSH_KEY
VPS_PORT (ixtiyoriy)
```

Secret qiymatlarini chatga yoki repository'ga yozmang.

## 2. Agar serverga SSH kira olsa

```bash
ssh root@SERVER_IP
cd /opt/shopflow

# Avval faqat o'qish
hostname -f
uptime
df -h /
free -m
docker compose ps
docker compose logs --tail=100 caddy backend postgres
curl -i http://127.0.0.1/health
curl -i http://127.0.0.1/api/health
```

### Container'lar ishlamayotgan bo'lsa

Avval log va diskni tekshiring. Database volume'ni o'chirmang.

```bash
docker compose up -d postgres
sleep 5
docker compose ps
docker compose up -d backend shopflow caddy backup
```

Keyin:

```bash
curl -fsS http://127.0.0.1/health
curl -fsS http://127.0.0.1/api/health
```

`docker compose down -v`, `docker system prune --volumes` yoki Postgres volume'ni
qo'lda o'chirish **mumkin emas** — ular ma'lumotlarni yo'qotishi mumkin.

## 3. Tashqi HTTPS ishlamasa

Agar local health ishlasa, lekin public domain ishlamasa, quyidagilarni tekshiring:

1. Kamatera/VPS public IP o'zgarganmi;
2. Cloudflare DNS'dagi origin A-record yangi IP'ga qarayaptimi;
3. Cloudflare SSL mode `Full (strict)` bo'lsa, origin'da valid certificate bormi;
4. VPS firewall/security group'da TCP 80 va 443 ochiqmi;
5. 80/443 portlarini boshqa nginx/Apache egallab olmaganmi;
6. Caddy certificate muddati tugamaganmi.

## 4. Local backend ham ishlamasa

```bash
docker compose logs --tail=200 backend postgres

docker compose exec -T postgres sh -c \
  'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Ko'p uchraydigan sabablar:

- disk to'lgan;
- server RAM/OOM sabab container o'chgan;
- Postgres volume yoki filesystem muammosi;
- `.env` yo'q yoki noto'g'ri;
- migration startup'da xato bergan;
- Docker daemon ishlamayapti.

`.env` ni logga chiqarmang. Secret qiymatlarini faqat mavjudligini tekshiring.

## 5. Server yo'qolgan bo'lsa

Fly'ga ko'chirishdan oldin quyidagilarni toping:

- offsite S3/R2 backup;
- `/root/shopflow-migration` arxivlari;
- Kamatera snapshot/backup;
- boshqa serverdagi PostgreSQL dump;
- uploads archive.

Database dump va uploads bo'lmasa, Fly'ga faqat kodni ko'chirish mumkin; mavjud
buyurtmalar, tenantlar va mahsulot rasmlari avtomatik qaytmaydi.

To'liq migration tartibi:

- VPS: `SERVER_MIGRATION.md`
- Fly.io: `FLY.md`

## 6. To'g'ri qaror

| Diagnostika natijasi | To'g'ri yo'l |
|---|---|
| VPS mavjud, DB va volume'lar joyida | Avval VPS'ni tiklash; Fly migration'ni keyin rejalash |
| VPS ishlaydi, faqat Caddy/Docker o'chgan | VPS'da servislarni tiklash |
| VPS disk/host buzilgan, backup bor | Backup'dan yangi VPS yoki Fly'ga restore |
| VPS yo'q, backup yo'q | Avval provider snapshot/recovery; Fly'ga ko'chirish ma'lumotlarni qaytarmaydi |
| VPS tiklandi, lekin uzoq muddatli hosting kerak | Alohida test restore qilib, keyin Fly cutover |
