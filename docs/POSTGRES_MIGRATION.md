# PostgreSQL'ga ko'chirish

Default ShopFlow SQLite ishlatadi (development uchun ideal). Production uchun PostgreSQL'ga o'tish jarayoni.

## 1. Driver almashtirish

```bash
cd server
pnpm remove better-sqlite3 @types/better-sqlite3
pnpm add postgres drizzle-orm
```

## 2. `server/src/db/index.ts` ni yangilash

```typescript
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

const sql = postgres(process.env.DATABASE_URL!, { max: 10 });
export const db = drizzle(sql, { schema });
export { schema };
```

## 3. `server/drizzle.config.ts` yangilash

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

## 4. Schema'da `sqliteTable` → `pgTable`

`server/src/db/schema.ts` da:
- `sqliteTable` → `pgTable`
- `text("...", { mode: "json" })` → `jsonb("...")`
- `integer("...", { mode: "boolean" })` → `boolean("...")`
- `integer("...", { mode: "timestamp_ms" })` → `timestamp("...")`
- `crypto.randomUUID()` → `gen_random_uuid()` (Postgres native)

## 5. docker-compose'ga postgres qo'shish

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: shopflow
      POSTGRES_USER: shopflow
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - shopflow

  server:
    # ... mavjud
    environment:
      DATABASE_URL: postgres://shopflow:${POSTGRES_PASSWORD}@db:5432/shopflow
    depends_on:
      - db

volumes:
  db_data:
```

## 6. Migrations qayta yaratish

```bash
cd server
rm -rf drizzle/  # eski SQLite migrations
pnpm db:generate  # yangi Postgres migrations
pnpm db:migrate
```

## 7. Ma'lumotlarni ko'chirish (agar SQLite'da bor bo'lsa)

SQLite → PostgreSQL ko'chirish uchun:
```bash
sqlite3 server/data/shopflow.db .dump > dump.sql
# dump.sql ni Postgres uchun moslashtirib qo'lda yoki pgloader bilan import qiling
pgloader sqlite://server/data/shopflow.db postgres://shopflow:pass@localhost/shopflow
```

## 8. Production uchun maslahat

- **Connection pool**: `postgres({ max: 20 })` — Fastify cluster uchun
- **SSL**: `postgres(url, { ssl: 'require' })` — managed Postgres uchun
- **Backup**: `pg_dump` cron orqali
- **Monitor**: pg_stat_statements
- **Migration zero-downtime**: yangi columnlar `nullable`, eski columnlarni darhol o'chirmang

## Tavsiyalar

- **Supabase / Neon** — managed Postgres, free tier mavjud
- **AWS RDS / DigitalOcean Managed DB** — production uchun
- **Self-hosted** — Hetzner VPS'da Docker postgres
