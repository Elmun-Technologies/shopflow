// Self-baselining migration runner — konteyner startup'da ishlaydi.
//
// Maqsad: `prisma db push` o'rniga versiyalangan `prisma migrate`'ga o'tish,
// MAVJUD (db push bilan qurilgan) prod DB'ni buzmasdan.
//
// Mantiq:
//   - `_prisma_migrations` jadvali bor          → migrate deploy (kutilayotganlar)
//   - yo'q, lekin "Tenant" jadvali bor (legacy) → 0_init baseline + migrate deploy
//   - ikkalasi ham yo'q (bo'sh DB)              → migrate deploy (hammasi)
//
// Shu tariqa auto-deploy hech qanday qo'lda amalsiz xavfsiz o'tadi.

import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

async function detectState() {
  const prisma = new PrismaClient();
  try {
    let lastErr;
    for (let i = 0; i < 10; i++) {
      try {
        const rows = await prisma.$queryRawUnsafe(
          `SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS has_migrations,
                  to_regclass('public."Tenant"') IS NOT NULL AS has_tenant`,
        );
        return {
          hasMigrations: Boolean(rows[0].has_migrations),
          hasTenant: Boolean(rows[0].has_tenant),
        };
      } catch (e) {
        lastErr = e;
        console.log(`[db-migrate] DB hali tayyor emas (urinish ${i + 1}/10)...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw lastErr;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const { hasMigrations, hasTenant } = await detectState();

  if (!hasMigrations && hasTenant) {
    console.log("[db-migrate] Legacy (db push) DB aniqlandi — 0_init baseline qilinmoqda...");
    run("npx prisma migrate resolve --applied 0_init");
  } else if (!hasMigrations && !hasTenant) {
    console.log("[db-migrate] Bo'sh DB — barcha migratsiyalar qo'llanadi.");
  } else {
    console.log("[db-migrate] Migratsiya tarixi mavjud — kutilayotgan migratsiyalar qo'llanadi.");
  }

  console.log("[db-migrate] prisma migrate deploy...");
  run("npx prisma migrate deploy");
  console.log("[db-migrate] ✅ Migratsiyalar tayyor.");
}

main().catch((e) => {
  console.error("[db-migrate] ❌ Xato:", e?.message ?? e);
  process.exit(1);
});
