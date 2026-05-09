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
    { shopId, name: "Atirlar", sortOrder: 1, emoji: "💐" },
    { shopId, name: "Kosmetika", sortOrder: 2, emoji: "💄" },
    { shopId, name: "Aksessuarlar", sortOrder: 3, emoji: "⌚" },
  ]).returning();

  const [perfumes, cosmetics, accessories] = cats;

  await db.insert(schema.products).values([
    { shopId, categoryId: perfumes.id, name: "Chanel No.5", description: "Klassik atir, 100ml", price: 1450000, compareAtPrice: 1700000, stock: 12, featured: true, rating: 4.8, reviewCount: 24, images: ["https://images.unsplash.com/photo-1541643600914-78b084683601?w=600"] },
    { shopId, categoryId: perfumes.id, name: "Dior Sauvage", description: "Erkaklar uchun atir, 100ml", price: 1280000, compareAtPrice: 1450000, stock: 8, featured: true, rating: 4.9, reviewCount: 18, images: ["https://images.unsplash.com/photo-1594035910387-fea47794261f?w=600"] },
    { shopId, categoryId: perfumes.id, name: "Tom Ford Black Orchid", description: "Premium atir, 50ml", price: 1750000, stock: 5, rating: 5.0, reviewCount: 9, images: ["https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600"] },
    { shopId, categoryId: cosmetics.id, name: "MAC Lipstick Ruby Woo", description: "Mat lab pomadasi", price: 285000, compareAtPrice: 320000, stock: 25, featured: true, rating: 4.7, reviewCount: 56, images: ["https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600"] },
    { shopId, categoryId: cosmetics.id, name: "Maybelline Mascara", description: "Sun'iy effektli mascara", price: 145000, stock: 40, rating: 4.6, reviewCount: 32, images: ["https://images.unsplash.com/photo-1631214499922-d2d2acc8e9c8?w=600"] },
    { shopId, categoryId: cosmetics.id, name: "L'Oreal Foundation", description: "Yuz uchun krem-asos, 30ml", price: 195000, compareAtPrice: 230000, stock: 18, rating: 4.5, reviewCount: 28, images: ["https://images.unsplash.com/photo-1631730486572-226d1f595b68?w=600"] },
    { shopId, categoryId: accessories.id, name: "Charm Soatlar", description: "Quartz mexanizm", price: 580000, stock: 10, rating: 4.8, reviewCount: 12, images: ["https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600"] },
    { shopId, categoryId: accessories.id, name: "Tilla zanjirli soat", description: "Premium dizayn", price: 1250000, compareAtPrice: 1500000, stock: 4, featured: true, rating: 5.0, reviewCount: 7, images: ["https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=600"] },
  ]);

  return { categoriesCreated: cats.length, productsCreated: 8 };
}
