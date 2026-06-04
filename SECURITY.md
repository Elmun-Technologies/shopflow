# ShopFlow Security

## Zaiflik haqida xabar berish

Xavfsizlik kamchiligini topgan bo'lsangiz, **public issue ochmang**.
`security@elmun.uz` ga yoki tegishli administratorga xabar bering.

72 soat ichida javob beriladi.

## Saqlash modeli

- **Multi-tenant izolyatsiya:** har query `tenantId` filter bilan
  (`updateMany/deleteMany` tenant-scoped pattern + integration testlar)
- **JWT:** HS256 (32+ belgi secret), 15 daqiqa TTL + refresh token 30 kun
- **Refresh token:** SHA256 hash, faqat hash DB'da saqlanadi
- **Parollar:** Argon2id (industry standard)
- **3rd-party tokenlar:** AES-256-GCM (`secret-cipher.ts`)
- **Telegram Mini App:** initData HMAC-SHA256 tekshiruvi

## Webhook xavfsizligi

### Kiruvchi (Click/Payme/Uzum)
- Imzo majburiy `testMode=false` da (production)
- Click: MD5(`click_trans_id + service_id + secret_key + ...`)
- Payme: Basic auth `Paycom:<cashierKey>` (timing-safe compare)
- Uzum: HMAC-SHA256 (`X-Hub-Signature-256`)
- Imzo noto'g'ri yoki yo'q bo'lsa **rad etiladi**

### Chiquvchi (Custom Webhooks)
- HMAC-SHA256 imzo `X-ShopFlow-Signature: sha256=<hex>` header
- SSRF himoyasi: private IP, loopback, link-local, cloud metadata bloklanadi
- 8s timeout, 20 marta fail → avtomatik o'chadi

## Rate limiting

- 300 req/min per tenant (auth token bo'yicha)
- IP fallback (auth bo'lmaganda — login, public storefront)

## Headers (nginx + helmet)

- `Strict-Transport-Security: max-age=31536000`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- CSP (frame-ancestors Telegram Web App ruxsat etiladi)

## Logging

Pino `redact` bilan sensitive maydonlar [REDACTED]:
- Authorization, Cookie, X-Auth, X-API-Key headerlari
- `password`, `secret`, `secretKey`, `token`, `initData`, `encryptedSecret`

## Xavfsizlik yangilanishlari

```bash
# Vulnerable deps tekshirish
npm audit
cd backend && npm audit

# JWT kalitlarini aylantirish (barcha foydalanuvchilar logout bo'ladi)
# .env'da yangi JWT_SECRET → docker compose restart backend
```

## Compliance

- GDPR-uslubi: tenant cascade delete (foydalanuvchi data'sini to'liq o'chirish)
- Export: tenant CSV/JSON export (Settings → API tab orqali keyingi etap)
- Audit log: barcha sezgir o'zgarishlar `AuditLog` jadvalida (`logAudit()`)
