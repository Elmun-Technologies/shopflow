import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

/**
 * Demo katalog: agar shop'da kategoriya/mahsulot bo'lmasa, default to'plamni qo'shadi.
 * Idempotent — qayta-qayta chaqirib bo'ladi.
 */
export async function seedDemoCatalog(shopId: string) {
  const existingCats = await db.query.categories.findMany({ where: eq(schema.categories.shopId, shopId) });
  if (existingCats.length > 0) return;

  const cats = await db.insert(schema.categories).values([
    { shopId, name: "Atirlar", sortOrder: 1 },
    { shopId, name: "Kosmetika", sortOrder: 2 },
    { shopId, name: "Aksessuarlar", sortOrder: 3 },
  ]).returning();

  const [perfumes, cosmetics, accessories] = cats;

  await db.insert(schema.products).values([
    { shopId, categoryId: perfumes.id, name: "Chanel No.5", description: "Klassik atir", price: 1450000, stock: 12, images: ["https://images.unsplash.com/photo-1541643600914-78b084683601?w=400"] },
    { shopId, categoryId: perfumes.id, name: "Dior Sauvage", description: "Erkaklar uchun atir", price: 1280000, stock: 8, images: ["https://images.unsplash.com/photo-1594035910387-fea47794261f?w=400"] },
    { shopId, categoryId: perfumes.id, name: "Tom Ford Black Orchid", description: "Premium atir", price: 1750000, stock: 5, images: ["https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=400"] },
    { shopId, categoryId: cosmetics.id, name: "MAC Lipstick Ruby Woo", description: "Mat lab pomadasi", price: 285000, stock: 25, images: ["https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=400"] },
    { shopId, categoryId: cosmetics.id, name: "Maybelline Mascara", description: "Sun'iy effektli mascara", price: 145000, stock: 40, images: ["https://images.unsplash.com/photo-1631214499922-d2d2acc8e9c8?w=400"] },
    { shopId, categoryId: cosmetics.id, name: "L'Oreal Foundation", description: "Yuz uchun krem-asos", price: 195000, stock: 18, images: ["https://images.unsplash.com/photo-1631730486572-226d1f595b68?w=400"] },
    { shopId, categoryId: accessories.id, name: "Charm Soatlar", description: "Quartz mexanizm", price: 580000, stock: 10, images: ["https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=400"] },
    { shopId, categoryId: accessories.id, name: "Tilla zanjirli soat", description: "Premium dizayn", price: 1250000, stock: 4, images: ["https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=400"] },
  ]);

  return { categoriesCreated: cats.length, productsCreated: 8 };
}
