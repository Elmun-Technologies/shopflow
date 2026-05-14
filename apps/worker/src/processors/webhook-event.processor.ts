import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { PrismaProvider } from "../prisma.provider.js";
import { WorkerMoyskladClient } from "../moysklad/moysklad.client.js";

interface JobData {
  tenantId: string;
  webhookEventId: string;
}

/**
 * Processes a single MoySklad webhook event row by fetching the latest version
 * of the referenced entity and upserting it locally. We rely on
 * `version = updated.getTime()` for last-write-wins conflict resolution.
 */
@Injectable()
@Processor("webhooks", { concurrency: 8 })
export class WebhookEventProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookEventProcessor.name);

  constructor(private readonly prisma: PrismaProvider, private readonly ms: WorkerMoyskladClient) {
    super();
  }

  async process(job: Job<JobData>): Promise<void> {
    if (job.name !== "process-moysklad-event") return;
    const { tenantId, webhookEventId } = job.data;

    const event = await this.prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
    if (!event || event.processedAt) return;

    try {
      const eventPayload = event.payload as Record<string, unknown>;
      const href = (eventPayload?.meta as { href?: string } | undefined)?.href ?? null;
      const msId = href?.match(/[0-9a-f-]{36}$/i)?.[0] ?? null;

      if (event.action === "DELETE") {
        await this.handleDelete(tenantId, event.entityType, msId);
      } else if (msId) {
        await this.handleUpsert(tenantId, event.entityType, msId);
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: new Date() },
      });

      // After any product/variant/stock change, invalidate the storefront ISR
      // cache so the public site reflects new prices/stock within seconds.
      if (shouldRevalidateStorefront(event.entityType)) {
        await this.invalidateStorefront(tenantId, event.entityType, msId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook event ${webhookEventId} failed: ${message}`);
      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: new Date(), error: message },
      });
      throw err;
    }
  }

  private async handleUpsert(tenantId: string, entityType: string, msId: string): Promise<void> {
    switch (entityType) {
      case "product":
        await this.upsertProduct(tenantId, msId);
        return;
      case "variant":
        await this.upsertVariant(tenantId, msId);
        return;
      case "productfolder":
        await this.upsertFolder(tenantId, msId);
        return;
      case "counterparty":
        await this.upsertCounterparty(tenantId, msId);
        return;
      case "customerorder":
        await this.upsertCustomerOrder(tenantId, msId);
        return;
      case "demand":
      case "retaildemand":
        // A sale (shipment) was created in MoySklad — qoldiqlar o'zgardi.
        // We re-pull stock for the products in this demand so the storefront
        // and bot reflect availability within seconds.
        await this.refreshStockForDemand(tenantId, msId, entityType);
        return;
      default:
        this.logger.debug(`Unhandled entityType=${entityType}`);
    }
  }

  /**
   * When a demand (sale) is fulfilled, MoySklad reduces stock instantly but
   * doesn't emit per-product stock webhooks. We fetch the demand's positions
   * and re-pull stock for each referenced product/variant — typically 1-5
   * extra MoySklad calls per sale, well within rate limits.
   */
  private async refreshStockForDemand(tenantId: string, demandId: string, entityType: string): Promise<void> {
    try {
      const demand = await this.ms.get<{ positions?: { meta: { href: string } } }>(
        tenantId,
        `/entity/${entityType}/${demandId}`,
        { expand: "positions.assortment" },
      );
      const positionsHref = demand.positions?.meta?.href;
      if (!positionsHref) return;
      const path = positionsHref.replace(/.*\/api\/remap\/1\.2/, "");
      const positions = await this.ms.get<{ rows: Array<{ assortment?: { meta?: { href?: string } } }> }>(
        tenantId,
        path,
        { limit: 1000 },
      );
      const productIds = new Set<string>();
      const variantIds = new Set<string>();
      for (const row of positions.rows ?? []) {
        const href = row.assortment?.meta?.href ?? "";
        const isVariant = href.includes("/entity/variant/");
        const msId = href.match(/[0-9a-f-]{36}$/i)?.[0];
        if (!msId) continue;
        if (isVariant) variantIds.add(msId);
        else productIds.add(msId);
      }
      // For each affected product, re-pull total stock from MoySklad.
      for (const msId of productIds) {
        await this.refreshSingleProductStock(tenantId, msId);
      }
      for (const msId of variantIds) {
        const v = await this.prisma.variant.findUnique({
          where: { tenantId_moyskladId: { tenantId, moyskladId: msId } },
        });
        if (v) {
          const product = await this.prisma.product.findUnique({ where: { id: v.productId } });
          if (product?.moyskladId) {
            await this.refreshSingleProductStock(tenantId, product.moyskladId);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`refreshStockForDemand failed for ${demandId}: ${String(err)}`);
    }
  }

  private async refreshSingleProductStock(tenantId: string, productMsId: string): Promise<void> {
    try {
      const res = await this.ms.get<{ rows: Array<{ stock?: number }> }>(
        tenantId,
        "/report/stock/all/current",
        {
          ["filter"]: `product=https://api.moysklad.ru/api/remap/1.2/entity/product/${productMsId}`,
          limit: 100,
        },
      );
      const total = (res.rows ?? []).reduce((sum, r) => sum + Number(r.stock ?? 0), 0);
      const local = await this.prisma.product.findUnique({
        where: { tenantId_moyskladId: { tenantId, moyskladId: productMsId } },
      });
      if (!local) return;
      await this.prisma.product.update({
        where: { id: local.id },
        data: {
          stockTotal: total,
          status: total > 0 ? "ACTIVE" : "OUT_OF_STOCK",
        },
      });
    } catch (err) {
      this.logger.warn(`refreshSingleProductStock failed for ${productMsId}: ${String(err)}`);
    }
  }

  private async handleDelete(tenantId: string, entityType: string, msId: string | null): Promise<void> {
    if (!msId) return;
    if (entityType === "product") {
      await this.prisma.product.updateMany({
        where: { tenantId, moyskladId: msId },
        data: { archived: true, status: "DISCONTINUED" },
      });
    } else if (entityType === "variant") {
      await this.prisma.variant.deleteMany({ where: { tenantId, moyskladId: msId } });
    }
  }

  private async upsertProduct(tenantId: string, msId: string) {
    const p = await this.ms.get<Record<string, unknown>>(tenantId, `/entity/product/${msId}`);
    const incomingVersion = BigInt(new Date(String(p.updated)).getTime());

    const existing = await this.prisma.product.findUnique({
      where: { tenantId_moyskladId: { tenantId, moyskladId: msId } },
    });
    if (existing && existing.version > incomingVersion) {
      this.logger.warn(`Stale product event for ${msId}; skipping`);
      return;
    }

    const folderHref = (p.productFolder as { meta?: { href?: string } } | undefined)?.meta?.href;
    const folderMs = folderHref?.match(/[0-9a-f-]{36}$/i)?.[0];
    let categoryId: string | null = null;
    if (folderMs) {
      const cat = await this.prisma.category.findUnique({
        where: { tenantId_moyskladId: { tenantId, moyskladId: folderMs } },
      });
      categoryId = cat?.id ?? null;
    }

    const salePrices = (p.salePrices as Array<{ value?: number }> | undefined) ?? [];
    const data = {
      name: String(p.name),
      sku: (p.code as string) ?? (p.externalCode as string) ?? msId.slice(0, 8),
      categoryId,
      priceKopecks: Math.round(salePrices[0]?.value ?? 0),
      costPriceKopecks: Math.round(((p.buyPrice as { value?: number } | undefined)?.value) ?? 0),
      vatPercent: Number(p.vat ?? 0),
      description: (p.description as string) ?? null,
      weight: (p.weight as number) ?? null,
      archived: Boolean(p.archived),
      status: (p.archived ? "DISCONTINUED" : "ACTIVE") as "DISCONTINUED" | "ACTIVE",
      version: incomingVersion,
      syncedAt: new Date(),
    };

    await this.prisma.product.upsert({
      where: { tenantId_moyskladId: { tenantId, moyskladId: msId } },
      create: { tenantId, moyskladId: msId, slug: slugify(String(p.name)) + "-" + msId.slice(0, 6), ...data },
      update: data,
    });
  }

  private async upsertVariant(tenantId: string, msId: string) {
    const v = await this.ms.get<Record<string, unknown>>(tenantId, `/entity/variant/${msId}`);
    const productHref = (v.product as { meta?: { href?: string } } | undefined)?.meta?.href;
    const productMs = productHref?.match(/[0-9a-f-]{36}$/i)?.[0];
    if (!productMs) return;
    const product = await this.prisma.product.findUnique({ where: { tenantId_moyskladId: { tenantId, moyskladId: productMs } } });
    if (!product) return;

    const chars: Record<string, string> = {};
    for (const c of (v.characteristics as Array<{ name: string; value: string }> | undefined) ?? []) chars[c.name] = c.value;

    await this.prisma.variant.upsert({
      where: { tenantId_moyskladId: { tenantId, moyskladId: msId } },
      create: {
        tenantId,
        moyskladId: msId,
        productId: product.id,
        sku: (v.code as string) ?? msId.slice(0, 8),
        characteristics: chars as never,
        version: BigInt(new Date(String(v.updated)).getTime()),
        syncedAt: new Date(),
      },
      update: {
        sku: (v.code as string) ?? msId.slice(0, 8),
        characteristics: chars as never,
        version: BigInt(new Date(String(v.updated)).getTime()),
        syncedAt: new Date(),
      },
    });
  }

  private async upsertFolder(tenantId: string, msId: string) {
    const f = await this.ms.get<Record<string, unknown>>(tenantId, `/entity/productfolder/${msId}`);
    await this.prisma.category.upsert({
      where: { tenantId_moyskladId: { tenantId, moyskladId: msId } },
      create: {
        tenantId,
        moyskladId: msId,
        name: String(f.name),
        slug: slugify(String(f.pathName ?? f.name)) + "-" + msId.slice(0, 6),
        pathName: (f.pathName as string) ?? null,
      },
      update: {
        name: String(f.name),
        pathName: (f.pathName as string) ?? null,
      },
    });
  }

  private async upsertCounterparty(tenantId: string, msId: string) {
    const c = await this.ms.get<Record<string, unknown>>(tenantId, `/entity/counterparty/${msId}`);
    await this.prisma.customer.upsert({
      where: { tenantId_moyskladId: { tenantId, moyskladId: msId } },
      create: {
        tenantId,
        moyskladId: msId,
        name: String(c.name),
        phone: (c.phone as string) ?? null,
        email: (c.email as string) ?? null,
        address: ((c.actualAddress as string) ?? (c.legalAddress as string)) ?? null,
        version: BigInt(new Date(String(c.updated)).getTime()),
        syncedAt: new Date(),
      },
      update: {
        name: String(c.name),
        phone: (c.phone as string) ?? null,
        email: (c.email as string) ?? null,
        version: BigInt(new Date(String(c.updated)).getTime()),
        syncedAt: new Date(),
      },
    });
  }

  private async upsertCustomerOrder(tenantId: string, msId: string) {
    const o = await this.ms.get<Record<string, unknown>>(tenantId, `/entity/customerorder/${msId}`);
    const existing = await this.prisma.order.findUnique({ where: { tenantId_moyskladId: { tenantId, moyskladId: msId } } });
    if (!existing) {
      // Order created in MoySklad directly (not via ShopFlow). For now we skip;
      // a future iteration can import these too.
      return;
    }
    const state = (o.state as { name?: string } | undefined)?.name ?? null;
    const newStatus = mapMoyskladOrderState(state) ?? existing.status;

    await this.prisma.order.update({
      where: { id: existing.id },
      data: {
        totalKopecks: Math.round(Number(o.sum ?? existing.totalKopecks)),
        moyskladMeta: { state, moment: o.moment } as never,
        status: newStatus,
        version: BigInt(new Date(String(o.updated)).getTime()),
        syncedAt: new Date(),
      },
    });

    // Notify customer on status transitions via Telegram (best-effort).
    if (existing.status !== newStatus) {
      try {
        const { Queue } = await import("bullmq");
        const queue = new Queue("telegram-notifications", {
          connection: parseRedisUrl(process.env.REDIS_URL ?? "redis://localhost:6379"),
        });
        await queue.add(
          "order-status-changed",
          { tenantId, orderId: existing.id, newStatus },
          { jobId: `osn:${existing.id}:${newStatus}` },
        );
        await queue.close();
      } catch (err) {
        this.logger.warn(`Failed to enqueue order notification: ${String(err)}`);
      }
    }
  }

  /**
   * Fires an on-demand revalidation request to the Next.js storefront so
   * cached pages reflect the latest data. Best-effort — failures don't break
   * the webhook event processing.
   */
  private async invalidateStorefront(tenantId: string, entityType: string, msId: string | null): Promise<void> {
    const storefrontUrl = process.env.STOREFRONT_REVALIDATE_URL;
    const secret = process.env.STOREFRONT_REVALIDATE_SECRET;
    if (!storefrontUrl || !secret) return;

    const tags = new Set<string>();
    tags.add("storefront-products");
    if (entityType === "productfolder") tags.add("storefront-categories");

    if (msId && (entityType === "product" || entityType === "variant")) {
      // Look up the product slug so we can invalidate the specific product page.
      const product = entityType === "product"
        ? await this.prisma.product.findUnique({ where: { tenantId_moyskladId: { tenantId, moyskladId: msId } } })
        : (await this.prisma.variant.findUnique({
            where: { tenantId_moyskladId: { tenantId, moyskladId: msId } },
          }))
          ? await this.prisma.product.findFirst({
              where: { variants: { some: { tenantId, moyskladId: msId } } } as never,
            })
          : null;
      if (product?.slug) tags.add(`product:${product.slug}`);
    }

    try {
      const { default: axios } = await import("axios");
      await axios.post(
        storefrontUrl,
        { tags: Array.from(tags) },
        { headers: { "x-revalidate-secret": secret }, timeout: 5_000 },
      );
    } catch (err) {
      this.logger.warn(`Storefront revalidate failed: ${String(err)}`);
    }
  }
}

function shouldRevalidateStorefront(entityType: string): boolean {
  return ["product", "variant", "productfolder"].includes(entityType);
}

function parseRedisUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    username: u.username || undefined,
    db: u.pathname ? Number(u.pathname.replace("/", "")) || 0 : 0,
  };
}

function mapMoyskladOrderState(name: string | null): "PENDING" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "CANCELLED" | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("отгруж") || n.includes("shipped")) return "SHIPPED";
  if (n.includes("выполн") || n.includes("complet") || n.includes("закры")) return "COMPLETED";
  if (n.includes("отмен") || n.includes("cancel")) return "CANCELLED";
  if (n.includes("работе") || n.includes("processing")) return "PROCESSING";
  return null;
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
