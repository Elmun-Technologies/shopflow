import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PrismaProvider } from "../prisma.provider.js";
import { WorkerMoyskladClient } from "../moysklad/moysklad.client.js";

interface JobData {
  tenantId: string;
  syncJobId: string;
}

/**
 * One-time bulk pull of the tenant's MoySklad data into ShopFlow. Runs once
 * after the admin pastes a token. Order:
 *   PriceType → Warehouse → Category → Product → Variant → Stock → Customer
 *
 * Idempotent: every entity is upserted by (tenantId, moyskladId).
 */
@Injectable()
@Processor("moysklad-sync", { concurrency: 1 })
export class InitialImportProcessor extends WorkerHost {
  private readonly logger = new Logger(InitialImportProcessor.name);

  constructor(private readonly prisma: PrismaProvider, private readonly ms: WorkerMoyskladClient) {
    super();
  }

  async process(job: Job<JobData>) {
    if (job.name !== "initial-import") return;
    const { tenantId, syncJobId } = job.data;
    this.logger.log(`Initial import start tenant=${tenantId} job=${syncJobId}`);

    await this.prisma.syncJob.update({
      where: { id: syncJobId },
      data: { status: "RUNNING", startedAt: new Date(), progress: 0 },
    });

    const stats: Record<string, number | string> = { _phase: "starting" };
    try {
      await this.setPhase(syncJobId, "Narx turlari", 5, stats);
      stats.priceTypes = await this.importPriceTypes(tenantId);
      await this.bump(syncJobId, 10, stats);

      await this.setPhase(syncJobId, "Omborlar", 15, stats);
      stats.warehouses = await this.importStores(tenantId);
      await this.bump(syncJobId, 25, stats);

      await this.setPhase(syncJobId, "Kategoriyalar", 30, stats);
      stats.categories = await this.importFolders(tenantId);
      await this.bump(syncJobId, 40, stats);

      await this.setPhase(syncJobId, "Mahsulotlar", 45, stats);
      stats.products = await this.importProducts(tenantId);
      await this.bump(syncJobId, 70, stats);

      await this.setPhase(syncJobId, "Variantlar", 72, stats);
      stats.variants = await this.importVariants(tenantId);
      await this.bump(syncJobId, 80, stats);

      await this.setPhase(syncJobId, "Qoldiqlar", 85, stats);
      stats.stocks = await this.importStock(tenantId);
      await this.bump(syncJobId, 95, stats);

      await this.setPhase(syncJobId, "Mijozlar", 96, stats);
      stats.customers = await this.importCustomers(tenantId);

      await this.prisma.syncJob.update({
        where: { id: syncJobId },
        data: { status: "DONE", progress: 100, stats: stats as never, finishedAt: new Date() },
      });
      await this.prisma.moyskladAccount.update({
        where: { tenantId },
        data: { status: "CONNECTED", lastSyncAt: new Date(), lastError: null },
      });
      this.logger.log(`Initial import done tenant=${tenantId} stats=${JSON.stringify(stats)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Initial import failed tenant=${tenantId}: ${message}`);
      await this.prisma.syncJob.update({
        where: { id: syncJobId },
        data: { status: "FAILED", error: message, finishedAt: new Date(), stats: stats as never },
      });
      await this.prisma.moyskladAccount.update({
        where: { tenantId },
        data: { status: "ERROR", lastError: message },
      });
      throw err;
    }
  }

  private async bump(id: string, progress: number, stats: Record<string, number | string>) {
    await this.prisma.syncJob.update({ where: { id }, data: { progress, stats: stats as never } });
  }

  private async setPhase(id: string, phase: string, progress: number, stats: Record<string, number | string>) {
    stats._phase = phase;
    await this.prisma.syncJob.update({ where: { id }, data: { progress, stats: stats as never } });
  }

  private async importPriceTypes(tenantId: string): Promise<number> {
    const res = await this.ms.get<{ rows: Array<{ id: string; name: string }> }>(
      tenantId,
      "/context/companysettings/pricetype",
    );
    let n = 0;
    for (const pt of res.rows ?? []) {
      await this.prisma.priceType.upsert({
        where: { tenantId_moyskladId: { tenantId, moyskladId: pt.id } },
        create: { tenantId, moyskladId: pt.id, name: pt.name, currency: "UZS", isDefault: n === 0 },
        update: { name: pt.name },
      });
      n++;
    }
    return n;
  }

  private async importStores(tenantId: string): Promise<number> {
    const res = await this.ms.get<{ rows: Array<{ id: string; name: string; address?: string }> }>(
      tenantId,
      "/entity/store",
      { limit: 1000 },
    );
    let n = 0;
    for (const s of res.rows ?? []) {
      await this.prisma.warehouse.upsert({
        where: { tenantId_moyskladId: { tenantId, moyskladId: s.id } },
        create: { tenantId, moyskladId: s.id, name: s.name, location: s.address ?? null, status: "ACTIVE" },
        update: { name: s.name, location: s.address ?? null },
      });
      n++;
    }
    return n;
  }

  private async importFolders(tenantId: string): Promise<number> {
    const seen: Array<{ id: string; name: string; pathName?: string; parentId?: string | null }> = [];
    let offset = 0;
    while (true) {
      const res = await this.ms.get<{ rows: Array<{ id: string; name: string; pathName?: string; productFolder?: { meta: { href: string } } }> }>(
        tenantId,
        "/entity/productfolder",
        { limit: 1000, offset },
      );
      if (!res.rows?.length) break;
      for (const f of res.rows) {
        const parentMs = f.productFolder?.meta?.href?.match(/[0-9a-f-]{36}$/i)?.[0] ?? null;
        seen.push({ id: f.id, name: f.name, pathName: f.pathName, parentId: parentMs });
      }
      if (res.rows.length < 1000) break;
      offset += 1000;
    }

    // First pass: create rows without parent linkage.
    for (const f of seen) {
      await this.prisma.category.upsert({
        where: { tenantId_moyskladId: { tenantId, moyskladId: f.id } },
        create: { tenantId, moyskladId: f.id, name: f.name, slug: slugify(f.pathName ?? f.name) + "-" + f.id.slice(0, 6), pathName: f.pathName ?? null },
        update: { name: f.name, pathName: f.pathName ?? null },
      });
    }
    // Second pass: wire up parents.
    for (const f of seen) {
      if (!f.parentId) continue;
      const child = await this.prisma.category.findUnique({ where: { tenantId_moyskladId: { tenantId, moyskladId: f.id } } });
      const parent = await this.prisma.category.findUnique({ where: { tenantId_moyskladId: { tenantId, moyskladId: f.parentId } } });
      if (child && parent) {
        await this.prisma.category.update({ where: { id: child.id }, data: { parentId: parent.id } });
      }
    }
    return seen.length;
  }

  private async importProducts(tenantId: string): Promise<number> {
    let offset = 0;
    let total = 0;
    while (true) {
      const res = await this.ms.get<{ rows: Array<Record<string, unknown>>; meta: { size: number } }>(
        tenantId,
        "/entity/product",
        { limit: 1000, offset },
      );
      if (!res.rows?.length) break;
      for (const p of res.rows) {
        await this.upsertProduct(tenantId, p);
        total++;
      }
      if (res.rows.length < 1000) break;
      offset += 1000;
    }
    return total;
  }

  private async upsertProduct(tenantId: string, p: Record<string, unknown>) {
    const id = String(p.id);
    const name = String(p.name);
    const code = (p.code as string) ?? (p.externalCode as string) ?? id.slice(0, 8);
    const folderHref = (p.productFolder as { meta?: { href?: string } } | undefined)?.meta?.href;
    const folderMs = folderHref?.match(/[0-9a-f-]{36}$/i)?.[0];

    let categoryId: string | null = null;
    if (folderMs) {
      const cat = await this.prisma.category.findUnique({ where: { tenantId_moyskladId: { tenantId, moyskladId: folderMs } } });
      categoryId = cat?.id ?? null;
    }

    const salePrices = (p.salePrices as Array<{ value?: number; priceType?: { meta?: { href?: string } } }> | undefined) ?? [];
    const price = Math.round(salePrices[0]?.value ?? 0);
    const buy = Math.round(((p.buyPrice as { value?: number } | undefined)?.value) ?? 0);

    const barcodeArr = (p.barcodes as Array<Record<string, string>> | undefined) ?? [];
    const barcode = barcodeArr[0]?.ean13 ?? barcodeArr[0]?.gtin ?? null;
    const vat = Number(p.vat ?? 0);
    const archived = Boolean(p.archived);
    const updated = new Date(String(p.updated));

    await this.prisma.product.upsert({
      where: { tenantId_moyskladId: { tenantId, moyskladId: id } },
      create: {
        tenantId,
        moyskladId: id,
        name,
        slug: slugify(name) + "-" + id.slice(0, 6),
        sku: code,
        categoryId,
        priceKopecks: price,
        costPriceKopecks: buy,
        barcode,
        vatPercent: vat,
        description: (p.description as string) ?? null,
        weight: (p.weight as number) ?? null,
        archived,
        status: archived ? "DISCONTINUED" : "ACTIVE",
        version: BigInt(updated.getTime()),
        syncedAt: new Date(),
      },
      update: {
        name,
        sku: code,
        categoryId,
        priceKopecks: price,
        costPriceKopecks: buy,
        barcode,
        vatPercent: vat,
        description: (p.description as string) ?? null,
        weight: (p.weight as number) ?? null,
        archived,
        status: archived ? "DISCONTINUED" : "ACTIVE",
        version: BigInt(updated.getTime()),
        syncedAt: new Date(),
      },
    });
  }

  private async importVariants(tenantId: string): Promise<number> {
    let offset = 0;
    let total = 0;
    while (true) {
      const res = await this.ms.get<{ rows: Array<Record<string, unknown>> }>(
        tenantId,
        "/entity/variant",
        { limit: 1000, offset },
      );
      if (!res.rows?.length) break;
      for (const v of res.rows) {
        const productHref = (v.product as { meta?: { href?: string } } | undefined)?.meta?.href;
        const productMs = productHref?.match(/[0-9a-f-]{36}$/i)?.[0];
        if (!productMs) continue;
        const product = await this.prisma.product.findUnique({ where: { tenantId_moyskladId: { tenantId, moyskladId: productMs } } });
        if (!product) continue;

        const id = String(v.id);
        const code = (v.code as string) ?? id.slice(0, 8);
        const chars: Record<string, string> = {};
        for (const c of (v.characteristics as Array<{ name: string; value: string }> | undefined) ?? []) {
          chars[c.name] = c.value;
        }

        await this.prisma.variant.upsert({
          where: { tenantId_moyskladId: { tenantId, moyskladId: id } },
          create: {
            tenantId,
            moyskladId: id,
            productId: product.id,
            sku: code,
            characteristics: chars as never,
            version: BigInt(new Date(String(v.updated)).getTime()),
            syncedAt: new Date(),
          },
          update: {
            sku: code,
            characteristics: chars as never,
            version: BigInt(new Date(String(v.updated)).getTime()),
            syncedAt: new Date(),
          },
        });
        total++;
      }
      if (res.rows.length < 1000) break;
      offset += 1000;
    }
    return total;
  }

  private async importStock(tenantId: string): Promise<number> {
    // Pull stock per warehouse: this gives us per-(product/variant, warehouse) rows
    // so the local Stock table mirrors MoySklad's per-store quantities (used for
    // routing orders to specific warehouses later).
    const warehouses = await this.prisma.warehouse.findMany({
      where: { tenantId, moyskladId: { not: null } },
      select: { id: true, moyskladId: true },
    });

    let rowsProcessed = 0;
    const productAggregate = new Map<string, number>();
    const productReserved = new Map<string, number>();

    for (const warehouse of warehouses) {
      if (!warehouse.moyskladId) continue;
      const res = await this.ms.get<{ rows: Array<Record<string, unknown>> }>(
        tenantId,
        "/report/stock/all/current",
        {
          groupBy: "variant",
          ["filter"]: `store=https://api.moysklad.ru/api/remap/1.2/entity/store/${warehouse.moyskladId}`,
          limit: 1000,
        },
      );

      for (const row of res.rows ?? []) {
        const assortHref = (row.meta as { href?: string } | undefined)?.href ?? "";
        const isVariant = assortHref.includes("/entity/variant/");
        const msId = assortHref.match(/[0-9a-f-]{36}$/i)?.[0];
        if (!msId) continue;
        const quantity = Number(row.stock ?? row.quantity ?? 0);
        const reserved = Number(row.reserve ?? 0);
        const inTransit = Number(row.inTransit ?? 0);

        let productId: string | null = null;
        let variantId: string | null = null;
        if (isVariant) {
          const v = await this.prisma.variant.findUnique({
            where: { tenantId_moyskladId: { tenantId, moyskladId: msId } },
          });
          if (!v) continue;
          variantId = v.id;
          productId = v.productId;
        } else {
          const p = await this.prisma.product.findUnique({
            where: { tenantId_moyskladId: { tenantId, moyskladId: msId } },
          });
          if (!p) continue;
          productId = p.id;
        }

        await this.prisma.stock.upsert({
          where: {
            productId_variantId_warehouseId: {
              productId,
              variantId: variantId ?? null,
              warehouseId: warehouse.id,
            } as never,
          },
          create: {
            tenantId,
            productId,
            variantId,
            warehouseId: warehouse.id,
            quantity,
            reserved,
            inTransit,
          },
          update: { quantity, reserved, inTransit },
        });

        productAggregate.set(productId, (productAggregate.get(productId) ?? 0) + quantity);
        productReserved.set(productId, (productReserved.get(productId) ?? 0) + reserved);
        rowsProcessed++;
      }
    }

    // Denormalize aggregate stock onto Product.stockTotal for fast list queries.
    for (const [productId, qty] of productAggregate.entries()) {
      await this.prisma.product.update({
        where: { id: productId },
        data: {
          stockTotal: qty,
          status: qty > 0 ? "ACTIVE" : "OUT_OF_STOCK",
        },
      });
    }
    return rowsProcessed;
  }

  private async importCustomers(tenantId: string): Promise<number> {
    let offset = 0;
    let total = 0;
    while (true) {
      const res = await this.ms.get<{ rows: Array<Record<string, unknown>> }>(
        tenantId,
        "/entity/counterparty",
        { limit: 1000, offset },
      );
      if (!res.rows?.length) break;
      for (const c of res.rows) {
        const id = String(c.id);
        const updated = new Date(String(c.updated));
        await this.prisma.customer.upsert({
          where: { tenantId_moyskladId: { tenantId, moyskladId: id } },
          create: {
            tenantId,
            moyskladId: id,
            name: String(c.name),
            phone: (c.phone as string) ?? null,
            email: (c.email as string) ?? null,
            address: ((c.actualAddress as string) ?? (c.legalAddress as string)) ?? null,
            tags: ((c.tags as string[]) ?? []) as never,
            version: BigInt(updated.getTime()),
            syncedAt: new Date(),
          },
          update: {
            name: String(c.name),
            phone: (c.phone as string) ?? null,
            email: (c.email as string) ?? null,
            address: ((c.actualAddress as string) ?? (c.legalAddress as string)) ?? null,
            version: BigInt(updated.getTime()),
            syncedAt: new Date(),
          },
        });
        total++;
      }
      if (res.rows.length < 1000) break;
      offset += 1000;
    }
    return total;
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}
