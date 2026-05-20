import type { PrismaClient } from "@prisma/client";
import {
  listMoyskladCounterparties,
  listMoyskladCustomerOrders,
  listMoyskladProductFolders,
  listMoyskladProducts,
  listMoyskladStock,
} from "./moysklad-client.js";
import {
  mapMoyskladCategory,
  mapMoyskladCounterparty,
  mapMoyskladOrder,
  mapMoyskladProduct,
  mapStockRow,
} from "./moysklad-mappers.js";

interface SyncResult {
  categories: number;
  products: number;
  customers: number;
  orders: number;
  stockUpdates: number;
  errors: string[];
}

const PAGE_SIZE = 1000;

/**
 * To'liq import — birinchi ulanishda yoki "qayta sinxronlash" tugmasida ishlatiladi.
 * Tartib: Categories → Products → Stock → Customers → Orders.
 */
export async function runInitialImport(
  prisma: PrismaClient,
  tenantId: string,
  jobId: string,
  onProgress?: (pct: number) => void,
): Promise<SyncResult> {
  const result: SyncResult = { categories: 0, products: 0, customers: 0, orders: 0, stockUpdates: 0, errors: [] };

  await prisma.syncJob.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: new Date() } });

  try {
    // ---------- 1. Kategoriyalar ----------
    await onProgress?.(5);
    const folders = await listMoyskladProductFolders(prisma, tenantId);
    const folderById = new Map<string, string>(); // moyskladId → category.id

    // Tartibsiz — birinchi marta parent'siz upsert, keyin ikkinchi pass'da parent'larni bog'laymiz
    for (const f of folders.rows) {
      const mapped = mapMoyskladCategory(f);
      const cat = await prisma.category.upsert({
        where: { tenantId_moyskladId: { tenantId, moyskladId: mapped.moyskladId } },
        create: {
          tenantId,
          name: mapped.name,
          slug: await ensureUniqueSlug(prisma, tenantId, mapped.slug),
          moyskladId: mapped.moyskladId,
          moyskladUpdated: mapped.moyskladUpdated,
        },
        update: {
          name: mapped.name,
          moyskladUpdated: mapped.moyskladUpdated,
        },
      });
      folderById.set(mapped.moyskladId, cat.id);
      result.categories++;
    }
    // 2-pass: parent bog'lash
    for (const f of folders.rows) {
      const mapped = mapMoyskladCategory(f);
      if (!mapped.parentMoyskladId) continue;
      const parentLocalId = folderById.get(mapped.parentMoyskladId);
      const ownLocalId = folderById.get(mapped.moyskladId);
      if (parentLocalId && ownLocalId) {
        await prisma.category.update({ where: { id: ownLocalId }, data: { parentId: parentLocalId } });
      }
    }

    // ---------- 2. Mahsulotlar ----------
    await onProgress?.(20);
    let offset = 0;
    const productByMoyskladId = new Map<string, string>(); // moyskladId → product.id
    while (true) {
      const page = await listMoyskladProducts(prisma, tenantId, { limit: PAGE_SIZE, offset });
      for (const p of page.rows) {
        const mapped = mapMoyskladProduct(p);
        const categoryId = mapped.categoryMoyskladId ? folderById.get(mapped.categoryMoyskladId) ?? null : null;
        const product = await prisma.product.upsert({
          where: { tenantId_moyskladId: { tenantId, moyskladId: mapped.moyskladId } },
          create: {
            tenantId,
            sku: await ensureUniqueSku(prisma, tenantId, mapped.sku),
            name: mapped.name,
            description: mapped.description,
            price: mapped.price,
            currency: mapped.currency,
            active: mapped.active,
            categoryId,
            moyskladId: mapped.moyskladId,
            moyskladUpdated: mapped.moyskladUpdated,
            source: mapped.source,
          },
          update: {
            name: mapped.name,
            description: mapped.description,
            price: mapped.price,
            active: mapped.active,
            categoryId,
            moyskladUpdated: mapped.moyskladUpdated,
          },
        });
        productByMoyskladId.set(mapped.moyskladId, product.id);
        result.products++;
      }
      if (page.rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // ---------- 3. Qoldiqlar ----------
    await onProgress?.(55);
    try {
      const stockPage = await listMoyskladStock(prisma, tenantId);
      for (const row of stockPage.rows) {
        const mapped = mapStockRow(row);
        if (!mapped.productMoyskladId) continue;
        const productId = productByMoyskladId.get(mapped.productMoyskladId);
        if (!productId) continue;
        await prisma.product.update({ where: { id: productId }, data: { stock: mapped.stock } });
        result.stockUpdates++;
      }
    } catch (err) {
      result.errors.push(`Stock: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ---------- 4. Mijozlar ----------
    await onProgress?.(70);
    offset = 0;
    const customerByMoyskladId = new Map<string, string>();
    while (true) {
      const page = await listMoyskladCounterparties(prisma, tenantId, { limit: PAGE_SIZE, offset });
      for (const c of page.rows) {
        const mapped = mapMoyskladCounterparty(c);
        const customer = await prisma.customer.upsert({
          where: { tenantId_moyskladId: { tenantId, moyskladId: mapped.moyskladId } },
          create: {
            tenantId,
            name: mapped.name,
            email: mapped.email,
            phone: mapped.phone,
            location: mapped.location,
            moyskladId: mapped.moyskladId,
            moyskladUpdated: mapped.moyskladUpdated,
          },
          update: {
            name: mapped.name,
            email: mapped.email,
            phone: mapped.phone,
            location: mapped.location,
            moyskladUpdated: mapped.moyskladUpdated,
          },
        });
        customerByMoyskladId.set(mapped.moyskladId, customer.id);
        result.customers++;
      }
      if (page.rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // ---------- 5. Buyurtmalar ----------
    await onProgress?.(85);
    offset = 0;
    while (true) {
      const page = await listMoyskladCustomerOrders(prisma, tenantId, { limit: PAGE_SIZE, offset });
      for (const o of page.rows) {
        const mapped = mapMoyskladOrder(o);
        const customerId = mapped.customerMoyskladId
          ? customerByMoyskladId.get(mapped.customerMoyskladId) ?? null
          : null;
        await prisma.order.upsert({
          where: { tenantId_moyskladId: { tenantId, moyskladId: mapped.moyskladId } },
          create: {
            tenantId,
            code: mapped.code,
            total: mapped.total,
            currency: mapped.currency,
            customerId,
            moyskladId: mapped.moyskladId,
            moyskladUpdated: mapped.moyskladUpdated,
            pushedToMoysklad: true,
          },
          update: {
            total: mapped.total,
            customerId,
            moyskladUpdated: mapped.moyskladUpdated,
          },
        });
        result.orders++;
      }
      if (page.rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // ---------- 6. Cursor'larni saqlash ----------
    const now = new Date();
    await prisma.moyskladAccount.update({
      where: { tenantId },
      data: {
        lastSyncAt: now,
        productsSyncCursor: now,
        customersSyncCursor: now,
        ordersSyncCursor: now,
        status: "CONNECTED",
        lastError: null,
      },
    });

    await onProgress?.(100);
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        processedItems: result.products + result.customers + result.orders,
        finishedAt: new Date(),
        details: result as never,
      },
    });

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(msg);
    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: msg,
        finishedAt: new Date(),
        details: result as never,
      },
    });
    await prisma.moyskladAccount.update({
      where: { tenantId },
      data: { status: "ERROR", lastError: msg },
    });
    throw err;
  }
}

// ---------- Helpers ----------

async function ensureUniqueSlug(prisma: PrismaClient, tenantId: string, base: string): Promise<string> {
  let slug = base;
  let n = 1;
  while (await prisma.category.findUnique({ where: { tenantId_slug: { tenantId, slug } } })) {
    n++;
    slug = `${base}-${n}`;
  }
  return slug;
}

async function ensureUniqueSku(prisma: PrismaClient, tenantId: string, base: string): Promise<string> {
  let sku = base;
  let n = 1;
  while (await prisma.product.findUnique({ where: { tenantId_sku: { tenantId, sku } } })) {
    n++;
    sku = `${base}-${n}`;
  }
  return sku;
}
