// Mahsulot slug'lari — public API URL identifikatori uchun.
// Barqaror bo'lishi shart (URL/SEO shunga bog'liq) — shuning uchun rename'da
// avtomatik o'zgartirmaymiz, faqat slug yo'q bo'lsa generatsiya qilamiz.

import type { PrismaClient } from "@prisma/client";

// Kirill → lotin (uz/ru nomlar uchun). To'liq emas, lekin slug uchun yetarli.
const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

/** Matnni URL-safe slug'ga aylantiradi. Bo'sh chiqsa "" qaytaradi. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (ch) => CYRILLIC[ch] ?? "")
    .replace(/['']/g, "")        // apostroflarni olib tashlash (o'zbek → ozbek)
    .replace(/[^a-z0-9]+/g, "-") // qolgan hamma narsa → tire
    .replace(/^-+|-+$/g, "")     // bosh/oxirgi tirelarni olib tashlash
    .slice(0, 80);
}

/**
 * Tenant ichida unique mahsulot slug'i yaratadi.
 * Base bo'sh bo'lsa "mahsulot" ishlatiladi; band bo'lsa -2, -3 ... qo'shiladi.
 * `excludeId` — update paytida o'z-o'zini hisobga olmaslik uchun.
 */
export async function uniqueProductSlug(
  prisma: Pick<PrismaClient, "product">,
  tenantId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "mahsulot";
  let candidate = root;
  for (let i = 2; ; i++) {
    const existing = await prisma.product.findFirst({
      where: {
        tenantId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${root}-${i}`;
  }
}

/**
 * Tenant ichida unique kategoriya slug'i. Product bilan bir xil mantiq —
 * import (1C/MoySklad) kategoriya nomlarini takrorlab yuborishi mumkin.
 */
export async function uniqueCategorySlug(
  prisma: Pick<PrismaClient, "category">,
  tenantId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "kategoriya";
  let candidate = root;
  for (let i = 2; ; i++) {
    const existing = await prisma.category.findFirst({
      where: {
        tenantId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${root}-${i}`;
  }
}
