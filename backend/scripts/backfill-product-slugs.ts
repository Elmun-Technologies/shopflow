// Mavjud mahsulotlarga slug backfill qiladi (slug yangi qo'shilgan ustun).
// Idempotent — faqat slug=null bo'lganlarga slug beradi. Bir necha marta
// ishlatish xavfsiz.
//
// Foydalanish:
//   DATABASE_URL=... npx tsx scripts/backfill-product-slugs.ts

import { PrismaClient } from "@prisma/client";
import { uniqueProductSlug } from "../src/lib/slug.js";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  let total = 0;
  for (const t of tenants) {
    const products = await prisma.product.findMany({
      where: { tenantId: t.id, slug: null },
      select: { id: true, name: true },
    });
    for (const p of products) {
      const slug = await uniqueProductSlug(prisma, t.id, p.name);
      await prisma.product.update({ where: { id: p.id }, data: { slug } });
      total++;
    }
    if (products.length) console.log(`  ${t.slug}: ${products.length} ta mahsulotga slug berildi`);
  }
  console.log(`\n✅ Jami ${total} ta mahsulot slug bilan yangilandi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
