# Contabo VPS'da deploy qilish

ShopFlow'ni Contabo VPS'ga deploy qilish bo'yicha qadam-baqadam qo'llanma. Caddy avtomatik Let's Encrypt sertifikatlari bilan HTTPS taqdim etadi.

## Talablar

- Contabo VPS (yoki har qanday Linux VPS — DigitalOcean, Hetzner, AWS EC2 va h.k.)
- Ubuntu 22.04+ yoki Debian 12+ (boshqa distrolarda ham ishlaydi)
- Domain nomi (DNS A-record VPS IP'siga ko'rsatilgan)
- Port 80 va 443 ochiq

## 1. VPS'ni tayyorlash

SSH orqali serverga ulaning:

```bash
ssh root@<vps-ip>
```

Tizimni yangilang:

```bash
apt update && apt upgrade -y
```

Docker va Docker Compose'ni o'rnating:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker compose version  # tekshirish
```

Firewall (faqat zaruriy portlar):

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 2. DNS sozlash

Domain registrator panelida A-record qo'shing:

| Tur | Nomi | Qiymat |
|-----|------|--------|
| A | `@` yoki `shopflow` | VPS IP manzili |

DNS tarqalishini kuting (1-30 daqiqa):

```bash
dig +short shopflow.example.com
# VPS IP qaytishi kerak
```

## 3. Loyihani serverga ko'chirish

```bash
cd /opt
git clone https://github.com/Elmun-Technologies/shopflow.git
cd shopflow
```

Environment fayl yarating:

```bash
cp .env.example .env
nano .env
```

`.env` faylida:

```
DOMAIN=shopflow.example.com
EMAIL=admin@example.com
```

## 4. Deploy

Build va ishga tushirish:

```bash
docker compose up -d --build
```

Statusni tekshirish:

```bash
docker compose ps
docker compose logs -f caddy
```

Caddy avtomatik Let's Encrypt sertifikatini olishi kerak (1-2 daqiqa). Loglar:

```
shopflow-caddy | obtained certificate for shopflow.example.com
```

Tekshiring: `https://shopflow.example.com`

## 5. Yangilash

Yangi versiya chiqqanda:

```bash
cd /opt/shopflow
git pull
docker compose up -d --build
```

## 6. Monitoring

**Logs:**

```bash
docker compose logs -f shopflow   # nginx logs
docker compose logs -f caddy       # Caddy access/error logs
```

**Resource ishlatilishi:**

```bash
docker stats
```

**Healthcheck:**

```bash
curl https://shopflow.example.com/health
# javob: ok
```

## 7. Backup (ixtiyoriy)

Caddy sertifikatlarini backup qiling (Let's Encrypt sertifikatlari qaytadan olinadi, lekin rate-limit bor):

```bash
docker run --rm \
  -v shopflow_caddy_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/caddy-data-$(date +%Y%m%d).tar.gz /data
```

## 8. Muammolarni hal qilish

### Port 80/443 band

Boshqa servis (Apache, eski nginx) bandmi tekshiring:

```bash
ss -tlnp | grep -E ':80|:443'
systemctl stop apache2 nginx 2>/dev/null
```

### Sertifikat olinmadi

- DNS to'g'ri ko'rsatilganligini tekshiring: `dig +short <domain>`
- Caddy loglarini ko'ring: `docker compose logs caddy`
- Email .env'da to'g'ri yozilganligini tekshiring
- Let's Encrypt rate-limit: 1 hafta kutib turing yoki staging environment'ni sinab ko'ring

### Healthcheck "unhealthy"

```bash
docker compose exec shopflow curl -v http://localhost/health
```

### Cache muammolari

Brauzerda hard refresh: `Ctrl+Shift+R` (Windows/Linux) yoki `Cmd+Shift+R` (Mac).

Server tomonda nginx hashlangan fayllarni ishlatadi (`assets/[name]-[hash].js`), shuning uchun yangilanish avtomatik.

## 9. Ixtiyoriy: Cloudflare bilan

Agar domain Cloudflare'da bo'lsa, "DNS Only" (gray cloud) rejimida qoldiring HTTPS sozlash uchun. Sertifikat olingandan keyin "Proxied" (orange cloud) yoqsangiz bo'ladi — Cloudflare SSL'i ikkala tomonda ishlaydi.

Yoki Cloudflare'da "Full (Strict)" SSL rejimini tanlang.

## 10. Custom port (ixtiyoriy)

Agar 80/443 mavjud bo'lmasa, `docker-compose.yml`'da:

```yaml
ports:
  - "8080:80"
  - "8443:443"
```

va Caddyfile'da:

```
{$DOMAIN}:8443 {
    ...
}
```

---

**Yordam kerakmi?** GitHub Issues: https://github.com/Elmun-Technologies/shopflow/issues
