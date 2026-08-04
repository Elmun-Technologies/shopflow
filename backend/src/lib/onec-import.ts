// 1C katalogini (CommerceML) ShopFlow bazasiga yozish.
//
// 1C «Обмен с сайтом» katta katalogni bitta so'rovda kutib turolmaydi —
// protokol `progress` javobini qo'llab-quvvatlaydi: biz "hali tugamadi" desak,
// 1C aynan shu `mode=import` so'rovini qaytadan yuboradi. Shu sababli import
// bo'lakma-bo'lak (BATCH) bajariladi va oraliq holat xotirada saqlanadi.
//
// QAMROV: faqat katalog — kategoriya + mahsulot kartochkasi. Narx va qoldiq
// (`offers.xml`) hozircha qo'llanmaydi, shuning uchun 1C'dan kelgan yangi
// mahsulot default holatda YASHIRIN yaratiladi (vitrinada 0 so'mga chiqmasligi
// uchun) — `OneCAccount.createInactive`.

import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { decodeXml, parseCommerceML, type OneCProduct, type ParsedCatalog } from "./onec-commerceml.js";
import { readStagedFile, stagedPath } from "./onec-exchange.js";
import { uniqueCategorySlug, uniqueProductSlug } from "./slug.js";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";

/** Bitta `mode=import` so'rovida qayta ishlanadigan mahsulotlar soni. */
const BATCH = 300;

/** Tugallanmagan importlar xotirada shuncha vaqt saqlanadi. */
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 soat

export interface OneCImportStats {
  categoriesCreated: number;
  categoriesUpdated: number;
  productsCreated: number;
  productsUpdated: number;
  productsHidden: number;
  imagesImported: number;
}

export interface OneCImportOptions {
  createInactive: boolean;
  importImages: boolean;
  overwriteNames: boolean;
}

export interface OneCImportStep {
  done: boolean;
  processed: number;
  total: number;
  stats: OneCImportStats;
  /** Diqqat talab qiladigan holatlar (rasm topilmadi, sku to'qnashuvi...) */
  warnings: string[];
  durationMs: number;
}

interface CacheEntry {
  catalog: ParsedCatalog;
  cursor: number;
  stats: OneCImportStats;
  warnings: string[];
  /** 1C guruh Ид → bizdagi Category.id */
  categoryIds: Map<string, string>;
  startedAt: number;
  touchedAt: number;
}

const cache = new Map<string, CacheEntry>();

function emptyStats(): OneCImportStats {
  return {
    categoriesCreated: 0,
    categoriesUpdated: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productsHidden: 0,
    imagesImported: 0,
  };
}

function cacheKey(tenantId: string, filename: string): string {
  return `${tenantId}::${filename}`;
}

function sweepCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.touchedAt > CACHE_TTL_MS) cache.delete(key);
  }
}

/** Tenant uchun boshlanmagan/yarim qolgan importlarni unutish (mode=init). */
export function clearImportCache(tenantId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${tenantId}::`)) cache.delete(key);
  }
}

// ── Rasmlar ───────────────────────────────────────────────────────────────

const IMAGE_MAGIC: Array<{ bytes: number[]; ext: string }> = [
  { bytes: [0xff, 0xd8, 0xff], ext: ".jpg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], ext: ".png" },
  { bytes: [0x47, 0x49, 0x46, 0x38], ext: ".gif" },
  { bytes: [0x52, 0x49, 0x46, 0x46], ext: ".webp" }, // RIFF konteyner
];

function detectImageExt(head: Buffer): string | null {
  for (const sig of IMAGE_MAGIC) {
    if (sig.bytes.every((b, i) => head[i] === b)) return sig.ext;
  }
  return null;
}

/**
 * Staging'dagi 1C rasmini ochiq `/uploads` katalogiga ko'chiradi va URL qaytaradi.
 * Nom deterministik (yo'l hash'i) — qayta import dublikat yaratmaydi.
 */
async function importImage(
  tenantId: string,
  relPath: string,
): Promise<{ url: string } | { error: string }> {
  const src = stagedPath(tenantId, relPath);
  if (!src) return { error: `yaroqsiz rasm yo'li: ${relPath}` };

  let head: Buffer;
  try {
    head = (await readFile(src)).subarray(0, 12);
  } catch {
    return { error: `rasm topilmadi: ${relPath}` };
  }
  const ext = detectImageExt(head);
  if (!ext) return { error: `rasm formati tanilmadi: ${relPath}` };

  const tenantSeg = tenantId.replace(/[^a-zA-Z0-9_-]/g, "");
  const name = createHash("sha1").update(relPath).digest("hex").slice(0, 24) + ext;
  const destDir = path.join(UPLOADS_DIR, tenantSeg, "1c");
  await mkdir(destDir, { recursive: true });
  await copyFile(src, path.join(destDir, name));
  return { url: `/uploads/${tenantSeg}/1c/${name}` };
}

// ── Kategoriyalar ─────────────────────────────────────────────────────────

async function syncCategories(
  prisma: PrismaClient,
  tenantId: string,
  entry: CacheEntry,
): Promise<void> {
  // `collectGroups` DFS pre-order beradi — ota guruh doim bolasidan oldin keladi,
  // shuning uchun parentId har doim allaqachon yaratilgan bo'ladi.
  for (const group of entry.catalog.groups) {
    const parentDbId = group.parentId ? (entry.categoryIds.get(group.parentId) ?? null) : null;

    const existing = await prisma.category.findFirst({
      where: { tenantId, oneCId: group.id },
      select: { id: true, name: true, parentId: true },
    });

    if (existing) {
      entry.categoryIds.set(group.id, existing.id);
      if (existing.name !== group.name || existing.parentId !== parentDbId) {
        await prisma.category.update({
          where: { id: existing.id },
          data: { name: group.name, parentId: parentDbId },
        });
        entry.stats.categoriesUpdated++;
      }
      continue;
    }

    const slug = await uniqueCategorySlug(prisma, tenantId, group.name);
    try {
      const created = await prisma.category.create({
        data: { tenantId, name: group.name, slug, parentId: parentDbId, oneCId: group.id },
        select: { id: true },
      });
      entry.categoryIds.set(group.id, created.id);
      entry.stats.categoriesCreated++;
    } catch (err) {
      entry.warnings.push(`Kategoriya "${group.name}" yaratilmadi: ${errText(err)}`);
    }
  }
}

/** Guruh Ид bo'yicha bizdagi Category.id — avval sessiya map'idan, keyin bazadan. */
async function resolveCategoryId(
  prisma: PrismaClient,
  tenantId: string,
  entry: CacheEntry,
  groupIds: string[],
): Promise<string | null> {
  for (const gid of groupIds) {
    const cached = entry.categoryIds.get(gid);
    if (cached) return cached;
    const found = await prisma.category.findFirst({
      where: { tenantId, oneCId: gid },
      select: { id: true },
    });
    if (found) {
      entry.categoryIds.set(gid, found.id);
      return found.id;
    }
  }
  return null;
}

// ── Mahsulotlar ───────────────────────────────────────────────────────────

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function syncProduct(
  prisma: PrismaClient,
  tenantId: string,
  entry: CacheEntry,
  item: OneCProduct,
  opts: OneCImportOptions,
): Promise<void> {
  const sku = item.sku?.trim() || item.id;

  // 1C GUID birlamchi kalit; eski (qo'lda kiritilgan) mahsulotni SKU orqali
  // topib, birinchi importda unga oneCId bog'laymiz.
  const existing =
    (await prisma.product.findFirst({
      where: { tenantId, oneCId: item.id },
      select: { id: true, imageUrl: true, oneCId: true },
    })) ??
    (await prisma.product.findFirst({
      where: { tenantId, sku },
      select: { id: true, imageUrl: true, oneCId: true },
    }));

  // Rasmlar — faqat 1C haqiqatan yuborgan bo'lsa tegamiz (operator qo'lda
  // yaxshiroq foto qo'ygan bo'lishi mumkin).
  let imageUrls: string[] = [];
  if (opts.importImages && item.images.length) {
    for (const rel of item.images.slice(0, 10)) {
      const res = await importImage(tenantId, rel);
      if ("url" in res) {
        imageUrls.push(res.url);
        entry.stats.imagesImported++;
      } else if (entry.warnings.length < 50) {
        entry.warnings.push(res.error);
      }
    }
    imageUrls = [...new Set(imageUrls)];
  }

  if (existing) {
    const data: Record<string, unknown> = {
      oneCId: item.id,
      oneCUpdated: new Date(),
    };
    if (opts.overwriteNames) {
      data.name = item.name;
      if (item.description) data.description = item.description;
    }
    const categoryId = await resolveCategoryId(prisma, tenantId, entry, item.groupIds);
    if (categoryId) data.categoryId = categoryId;
    if (item.country) data.origin = item.country;
    if (imageUrls.length) {
      data.imageUrl = imageUrls[0];
      data.images = imageUrls.slice(1);
    }
    if (item.deleted) {
      data.active = false;
      entry.stats.productsHidden++;
    }

    try {
      await prisma.product.update({ where: { id: existing.id }, data });
      if (!item.deleted) entry.stats.productsUpdated++;
    } catch (err) {
      entry.warnings.push(`Mahsulot "${item.name}" yangilanmadi: ${errText(err)}`);
    }
    return;
  }

  // 1C'da allaqachon o'chirilgan mahsulotni yangidan yaratmaymiz
  if (item.deleted) return;

  const categoryId = await resolveCategoryId(prisma, tenantId, entry, item.groupIds);
  const slug = await uniqueProductSlug(prisma, tenantId, item.name);

  try {
    await prisma.product.create({
      data: {
        tenantId,
        sku,
        slug,
        name: item.name,
        description: item.description,
        categoryId,
        origin: item.country,
        imageUrl: imageUrls[0] ?? null,
        images: imageUrls.slice(1),
        // Narx/qoldiq 1C'dan hozircha kelmaydi — operator o'zi belgilaydi
        price: 0,
        stock: 0,
        active: !opts.createInactive,
        source: "ONEC",
        oneCId: item.id,
        oneCUpdated: new Date(),
      },
    });
    entry.stats.productsCreated++;
  } catch (err) {
    entry.warnings.push(`Mahsulot "${item.name}" yaratilmadi: ${errText(err)}`);
  }
}

// ── Asosiy qadam ──────────────────────────────────────────────────────────

/**
 * Katalog importining bitta qadamini bajaradi.
 * `done=false` qaytsa, 1C shu so'rovni qaytaradi va biz keyingi bo'lakni olamiz.
 */
export async function runCatalogImportStep(
  prisma: PrismaClient,
  tenantId: string,
  filename: string,
  opts: OneCImportOptions,
): Promise<OneCImportStep> {
  sweepCache();
  const key = cacheKey(tenantId, filename);
  let entry = cache.get(key);

  if (!entry) {
    const buf = await readStagedFile(tenantId, filename);
    if (!buf) throw new Error(`Fayl topilmadi: ${filename}`);
    const catalog = parseCommerceML(decodeXml(buf));

    entry = {
      catalog,
      cursor: 0,
      stats: emptyStats(),
      warnings: [],
      categoryIds: new Map(),
      startedAt: Date.now(),
      touchedAt: Date.now(),
    };
    cache.set(key, entry);

    // Kategoriyalar odatda kam — birinchi qadamda to'liq yozamiz.
    await syncCategories(prisma, tenantId, entry);
  }

  entry.touchedAt = Date.now();

  const slice = entry.catalog.products.slice(entry.cursor, entry.cursor + BATCH);
  for (const item of slice) {
    await syncProduct(prisma, tenantId, entry, item, opts);
  }
  entry.cursor += slice.length;

  const total = entry.catalog.products.length;
  const done = entry.cursor >= total;
  const step: OneCImportStep = {
    done,
    processed: entry.cursor,
    total,
    stats: entry.stats,
    warnings: entry.warnings,
    durationMs: Date.now() - entry.startedAt,
  };

  if (done) cache.delete(key);
  return step;
}
