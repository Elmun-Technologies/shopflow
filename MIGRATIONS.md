# Database Migrations (Prisma)

ShopFlow endi schema o'zgarishlarini **versiyalangan `prisma migrate`** orqali
boshqaradi (`db push` o'rniga). Bu production'da bashoratli, qaytariladigan
schema evolyutsiyasini beradi.

## Holat

- Migratsiyalar: `backend/prisma/migrations/`
- Boshlang'ich baseline: `0_init` (joriy schema'ning to'liq snapshot'i)
- Deploy: konteyner startup'da avtomatik (`scripts/db-migrate.mjs`)

## Self-baselining (qo'lda amal kerak emas)

Mavjud prod DB `db push` bilan qurilgan — unda `_prisma_migrations` jadvali yo'q.
`scripts/db-migrate.mjs` startup'da holatni aniqlaydi va to'g'ri yo'lni tanlaydi:

| DB holati | Amal |
|---|---|
| `_prisma_migrations` bor | `migrate deploy` (kutilayotgan migratsiyalar) |
| yo'q, lekin `Tenant` bor (legacy db push) | `migrate resolve --applied 0_init` → so'ng `migrate deploy` |
| ikkalasi ham yo'q (bo'sh DB) | `migrate deploy` (hammasini qo'llaydi) |

Shu tariqa **birinchi deploy** mavjud prod DB'ni buzmasdan migrate'ga o'tkazadi —
serverda hech qanday qo'lda buyruq talab qilinmaydi.

## Yangi migration yaratish (developer)

Schema'ni o'zgartirgach (`backend/prisma/schema.prisma`):

```bash
cd backend
# Local dev DB'da migration yaratadi + qo'llaydi
npx prisma migrate dev --name qisqacha_tavsif
git add prisma/migrations
```

Migration papkasini **albatta commit qiling**. CI drift-check schema bilan
migratsiyalar mosligini majburlaydi — schema o'zgartirilsa-yu migration
yaratilmasa, CI yiqiladi.

## Deploy

Avtomatik. Konteyner CMD:

```
node scripts/db-migrate.mjs && node dist/server.js
```

CI (`deploy-vps.yml`):
- `prisma migrate deploy` — toza CI DB'da 0_init'ni qo'llaydi
- drift-check — `migrate diff --exit-code` (schema ↔ migrations mosligi)
- integration testlar migratsiyalangan schema ustida ishlaydi

## Rollback

Migration'lar oldinga yo'naltirilgan (Prisma down-migration yaratmaydi).
Orqaga qaytarish kerak bo'lsa: yangi tuzatuvchi migration yozing yoki
backup'dan tiklang (`OPS.md`). `0_init`'ni qo'lda o'chirmang.

## Eslatma

- `prisma db push` endi **ishlatilmaydi** (Dockerfile/CI'da olib tashlandi).
  Faqat tezkor local prototip uchun ishlatish mumkin, lekin migration yarating.
- `migration_lock.toml` provider = postgresql — commit qilingan.
