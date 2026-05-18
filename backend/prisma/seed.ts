// Boshlang'ich tenant + admin foydalanuvchi yaratadi.
// Demo ma'lumotlar yo'q — barcha jadvallar bo'sh boshlanadi.
//
// Foydalanish:
//   DATABASE_URL=... SEED_TENANT_SLUG=demo SEED_EMAIL=admin@demo.uz SEED_PASSWORD=changeme npm run seed

import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const slug = process.env.SEED_TENANT_SLUG ?? "demo";
  const name = process.env.SEED_TENANT_NAME ?? "ShopFlow Demo";
  const email = process.env.SEED_EMAIL ?? "admin@shopflow.local";
  const password = process.env.SEED_PASSWORD ?? "ChangeMe123!";
  const userName = process.env.SEED_USER_NAME ?? "Admin";

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    console.log(`Tenant '${slug}' allaqachon mavjud — seed o'tkazib yuborildi.`);
    return;
  }

  const passwordHash = await argon2.hash(password);
  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name,
      users: {
        create: { email, passwordHash, name: userName, role: "OWNER" },
      },
      channels: {
        create: [
          { type: "WEBSITE", name: "Veb-sayt" },
          { type: "INSTAGRAM", name: "Instagram" },
          { type: "TELEGRAM", name: "Telegram" },
          { type: "WHATSAPP", name: "WhatsApp" },
        ],
      },
    },
  });

  console.log(`Tenant yaratildi: ${tenant.slug}`);
  console.log(`  Email:    ${email}`);
  console.log(`  Parol:    ${password}`);
  console.log(`  Tenant ID: ${tenant.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
