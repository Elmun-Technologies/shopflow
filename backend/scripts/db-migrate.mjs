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
// So'ng: SCHEMA DRIFT tekshiruvi. Legacy DB 0_init baseline qilinganda, agar u
// 0_init'dagi ba'zi ustunlardan kechroq qo'shilganlarini (db push orqali) olmagan
// bo'lsa, baseline ularni "qo'llangan" deb belgilaydi-yu, ustunlar yaratilmaydi
// → runtime'da "Ma'lumotlar bazasi xatosi" (P2022). Drift bo'lsa `db push` bilan
// qo'shimcha (additiv) ustun/jadvallarni xavfsiz moslashtiramiz.

import { PrismaClient } from "@prisma/client";
import { execSync, spawnSync } from "node:child_process";

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

// Prisma schema bilan haqiqiy DB o'rtasidagi drift'ni tekshirish va, agar bo'lsa,
// db push bilan moslashtirish. db push faqat additiv o'zgarishlarni avtomatik
// qo'llaydi; destruktiv (ma'lumot yo'qotuvchi) o'zgarish bo'lsa xato beradi (xavfsiz).
function healDrift() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("[db-migrate] DATABASE_URL yo'q — drift tekshiruvi o'tkazib yuborildi.");
    return;
  }
  const diff = spawnSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-url", dbUrl, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"],
    { stdio: "pipe", encoding: "utf8" },
  );
  // exit 0 = drift yo'q, 2 = drift bor, boshqa = xato
  if (diff.status === 0) {
    console.log("[db-migrate] Drift yo'q — DB schema bilan mos.");
    return;
  }
  if (diff.status === 2) {
    console.log("[db-migrate] ⚠️ Schema drift aniqlandi — `prisma db push` bilan moslashtirilmoqda...");
    run("npx prisma db push --skip-generate");
    console.log("[db-migrate] ✅ Schema drift bartaraf etildi.");
    return;
  }
  console.warn("[db-migrate] Drift tekshiruvi natija bermadi (status " + diff.status + "):", (diff.stderr || "").trim());
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

  // Baseline/legacy DB drift'ini bartaraf etish (Ma'lumotlar bazasi xatosi sababini).
  healDrift();

  console.log("[db-migrate] ✅ Migratsiyalar tayyor.");
}

main().catch((e) => {
  console.error("[db-migrate] ❌ Xato:", e?.message ?? e);
  process.exit(1);
});
