// Tenant uchun public API (v1) kaliti yaratadi.
// Kalit FAQAT shu yerda bir marta ko'rsatiladi — DB'da faqat hash saqlanadi.
//
// Foydalanish (server'da):
//   DATABASE_URL=... npx tsx scripts/create-api-key.ts <tenant-slug> ["Kalit nomi"] [--expires-days=365]
//
// Alternativa: Admin panel → Sozlamalar → API tab orqali ham yaratish mumkin.

import { PrismaClient } from "@prisma/client";
import { generateApiKey } from "../src/lib/api-key.js";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith("--"));
  const slug = positional[0];
  const name = positional[1];
  const expiresFlag = args.find((a) => a.startsWith("--expires-days="));

  if (!slug) {
    console.error('Foydalanish: tsx scripts/create-api-key.ts <tenant-slug> ["Kalit nomi"] [--expires-days=N]');
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) {
    console.error(`Tenant topilmadi: ${slug}`);
    process.exit(1);
  }

  let expiresAt: Date | null = null;
  if (expiresFlag) {
    const days = Number(expiresFlag.split("=")[1]);
    if (Number.isFinite(days) && days > 0) expiresAt = new Date(Date.now() + days * 86_400_000);
  }

  const { key, prefix, hash } = generateApiKey();
  const created = await prisma.apiKey.create({
    data: { tenantId: tenant.id, name: name || "Website API", keyHash: hash, prefix, scopes: ["public"], expiresAt },
    select: { id: true, name: true },
  });

  const base = process.env.PUBLIC_BASE_URL ?? `https://${process.env.DOMAIN ?? "shop-flow.uz"}`;
  console.log("\n✅ API kalit yaratildi (faqat shu yerda ko'rsatiladi — saqlang!):\n");
  console.log(`  Tenant:   ${tenant.name} (${tenant.slug})`);
  console.log(`  Nomi:     ${created.name}`);
  console.log(`  Kalit ID: ${created.id}`);
  console.log(`  Muddati:  ${expiresAt ? expiresAt.toISOString() : "cheksiz"}`);
  console.log("\n  ── Websayt .env uchun ──");
  console.log(`  SHOPFLOW_API_KEY=${key}`);
  console.log(`  SHOPFLOW_API_URL=${base}/api/v1\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
