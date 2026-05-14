import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const IKPU_CODES = [
  { code: "8517120000", name: "Telefon apparatlari", category: "Elektronika", vatPercent: 12 },
  { code: "8471300000", name: "Portativ kompyuterlar", category: "Elektronika", vatPercent: 12 },
  { code: "6109100000", name: "T-shirt va mayka", category: "Kiyim-kechak", vatPercent: 12 },
  { code: "6203420000", name: "Shim va jinslar", category: "Kiyim-kechak", vatPercent: 12 },
  { code: "0401200000", name: "Sut", category: "Oziq-ovqat", vatPercent: 12 },
  { code: "1905310000", name: "Pechenye va biskvit", category: "Oziq-ovqat", vatPercent: 12 },
  { code: "8418102000", name: "Muzlatgich-sovutgich", category: "Maishiy texnika", vatPercent: 12 },
  { code: "8450110000", name: "Kir yuvish mashinasi", category: "Maishiy texnika", vatPercent: 12 },
  { code: "9506620000", name: "Futbol to'plari", category: "Sport", vatPercent: 12 },
  { code: "9506310000", name: "Golf to'plamlari", category: "Sport", vatPercent: 12 },
  { code: "4901990000", name: "Kitoblar", category: "Kitoblar", vatPercent: 12 },
  { code: "9503007500", name: "O'yinchoq mashinalar", category: "O'yinchoqlar", vatPercent: 12 },
  { code: "9503009500", name: "O'yinchoq qo'g'irchoqlar", category: "O'yinchoqlar", vatPercent: 12 },
];

async function main() {
  console.log("Seeding IKPU codes…");
  for (const code of IKPU_CODES) {
    await prisma.ikpuCode.upsert({
      where: { code: code.code },
      create: code,
      update: code,
    });
  }

  const demoSlug = "demo";
  const existing = await prisma.tenant.findUnique({ where: { slug: demoSlug } });
  if (!existing) {
    console.log("Creating demo tenant…");
    const tenant = await prisma.tenant.create({
      data: {
        slug: demoSlug,
        name: "ShopFlow Demo",
        plan: "TRIAL",
        status: "ACTIVE",
        settings: {
          create: {
            currency: "UZS",
            timezone: "Asia/Tashkent",
            language: "uz",
          },
        },
        users: {
          create: {
            email: "demo@shopflow.uz",
            name: "Demo Owner",
            passwordHash: hashPassword("demo1234"),
            role: "OWNER",
          },
        },
        storefrontSite: {
          create: {
            subdomain: demoSlug,
            title: "ShopFlow Demo Store",
            theme: { primaryColor: "#10b981", accentColor: "#3b82f6" },
            published: false,
            catalogOnly: false,
          },
        },
      },
    });
    console.log(`Demo tenant created: ${tenant.id} (login: demo@shopflow.uz / demo1234)`);
  } else {
    console.log("Demo tenant already exists, skipping.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
