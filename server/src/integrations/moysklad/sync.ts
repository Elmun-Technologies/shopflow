/**
 * MoySklad <-> ShopFlow sync.
 * Pull: products, categories, stock, images
 * Push: orders + counterparties
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { decrypt, encrypt } from "../../lib/crypto.js";
import { MoyskladClient, idFromHref } from "./client.js";

interface MsCredentials {
  type: "token" | "basic";
  token?: string;
  login?: string;
  password?: string;
}

interface MsConfig {
  organizationId?: string;
  organizationHref?: string;
  storeId?: string;
  storeHref?: string;
  webhookId?: string;
}

async function logSync(shopId: string, entity: string, status: "success" | "error" | "skipped", message: string, payload?: unknown, direction: "in" | "out" = "in") {
  await db.insert(schema.syncLogs).values({
    shopId,
    integrationType: "moysklad",
    direction,
    entity,
    status,
    message,
    payload: payload as never,
  }).catch(() => { /* log xatosi sync'ni buzmasin */ });
}

export async function getClient(shopId: string): Promise<MoyskladClient | null> {
  const integration = await db.query.integrations.findFirst({
    where: and(eq(schema.integrations.shopId, shopId), eq(schema.integrations.type, "moysklad")),
  });
  if (!integration) return null;
  const creds = JSON.parse(decrypt(integration.credentialsEncrypted)) as MsCredentials;
  if (creds.type === "token" && creds.token) return MoyskladClient.fromToken(creds.token);
  if (creds.type === "basic" && creds.login && creds.password) return MoyskladClient.fromBasic(creds.login, creds.password);
  return null;
}

async function getConfig(shopId: string): Promise<MsConfig | null> {
  const integration = await db.query.integrations.findFirst({
    where: and(eq(schema.integrations.shopId, shopId), eq(schema.integrations.type, "moysklad")),
  });
  return (integration?.config as MsConfig | null) ?? null;
}

async function setConfig(shopId: string, patch: Partial<MsConfig>) {
  const integration = await db.query.integrations.findFirst({
    where: and(eq(schema.integrations.shopId, shopId), eq(schema.integrations.type, "moysklad")),
  });
  if (!integration) return;
  const current = (integration.config as MsConfig | null) ?? {};
  await db.update(schema.integrations).set({ config: { ...current, ...patch } as never }).where(eq(schema.integrations.id, integration.id));
}

export async function saveCredentials(shopId: string, creds: MsCredentials): Promise<{ name?: string }> {
  let client: MoyskladClient;
  if (creds.type === "token" && creds.token) client = MoyskladClient.fromToken(creds.token);
  else if (creds.type === "basic" && creds.login && creds.password) client = MoyskladClient.fromBasic(creds.login, creds.password);
  else throw new Error("Login/parol yoki token kerak");

  const me = await client.me();

  const encrypted = encrypt(JSON.stringify(creds));
  const existing = await db.query.integrations.findFirst({
    where: and(eq(schema.integrations.shopId, shopId), eq(schema.integrations.type, "moysklad")),
  });
  if (existing) {
    await db.update(schema.integrations)
      .set({ credentialsEncrypted: encrypted, status: "connected" })
      .where(eq(schema.integrations.id, existing.id));
  } else {
    await db.insert(schema.integrations).values({
      shopId, type: "moysklad",
      credentialsEncrypted: encrypted, status: "connected",
    });
  }

  // Avtomatik organization va store tanlash
  await autoConfigureOrgAndStore(shopId, client).catch(() => { /* */ });

  await logSync(shopId, "credentials", "success", `Ulandi: ${me.name ?? "akkaunt"}`);
  return { name: me.name };
}

async function autoConfigureOrgAndStore(shopId: string, client: MoyskladClient) {
  const [orgs, stores] = await Promise.all([client.listOrganizations(), client.listStores()]);
  const patch: Partial<MsConfig> = {};
  if (orgs.rows.length > 0) {
    patch.organizationId = orgs.rows[0].id;
    patch.organizationHref = orgs.rows[0].meta.href;
  }
  if (stores.rows.length > 0) {
    patch.storeId = stores.rows[0].id;
    patch.storeHref = stores.rows[0].meta.href;
  }
  await setConfig(shopId, patch);
}

export async function disconnect(shopId: string): Promise<void> {
  await db.delete(schema.integrations)
    .where(and(eq(schema.integrations.shopId, shopId), eq(schema.integrations.type, "moysklad")));
  await logSync(shopId, "credentials", "success", "Uzildi");
}

export interface SyncResult {
  imported: number;
  updated: number;
  stockUpdated: number;
  imagesAdded: number;
  errors: number;
}

export async function syncProducts(shopId: string): Promise<SyncResult> {
  const client = await getClient(shopId);
  if (!client) throw new Error("MoySklad ulanmagan");

  const result: SyncResult = { imported: 0, updated: 0, stockUpdated: 0, imagesAdded: 0, errors: 0 };

  // 1. Kategoriyalar
  try {
    const folders = await client.listFolders();
    const folderMap = new Map<string, string>();
    for (const f of folders.rows) {
      const existing = await db.query.categories.findFirst({
        where: and(eq(schema.categories.shopId, shopId), eq(schema.categories.externalId, f.id)),
      });
      if (existing) {
        if (existing.name !== f.name) {
          await db.update(schema.categories).set({ name: f.name }).where(eq(schema.categories.id, existing.id));
        }
        folderMap.set(f.id, existing.id);
      } else {
        const [cat] = await db.insert(schema.categories).values({
          shopId, externalId: f.id, name: f.name, sortOrder: 0,
          emoji: pickEmojiForCategory(f.name),
        }).returning();
        folderMap.set(f.id, cat.id);
      }
    }
    await logSync(shopId, "categories", "success", `${folders.rows.length} kategoriya sinxronlandi`);

    // 2. Mahsulotlar
    let offset = 0;
    while (true) {
      const page = await client.listProducts({ limit: 100, offset });
      if (page.rows.length === 0) break;

      for (const p of page.rows) {
        try {
          if (p.archived) continue;
          const price = p.salePrices?.[0]?.value ? p.salePrices[0].value / 100 : 0;
          const folderId = p.productFolder ? idFromHref(p.productFolder.meta.href) : null;
          const categoryId = folderId ? folderMap.get(folderId) ?? null : null;

          // Rasmlar
          const images: string[] = [];
          if (p.images?.rows) {
            for (const img of p.images.rows) {
              const url = img.miniature?.href ?? img.tiny?.href;
              if (url) images.push(url);
            }
          }

          const existing = await db.query.products.findFirst({
            where: and(eq(schema.products.shopId, shopId), eq(schema.products.externalId, p.id)),
          });
          if (existing) {
            const patch: Partial<typeof schema.products.$inferInsert> = {
              name: p.name,
              description: p.description ?? null,
              price,
              sku: p.code ?? p.article ?? null,
              categoryId,
              updatedAt: new Date(),
            };
            // Rasmlar bo'sh bo'lsa, yangilarini qo'shamiz
            if (images.length > 0 && (!existing.images || existing.images.length === 0)) {
              patch.images = images;
              result.imagesAdded += images.length;
            }
            await db.update(schema.products).set(patch).where(eq(schema.products.id, existing.id));
            result.updated++;
          } else {
            await db.insert(schema.products).values({
              shopId, externalId: p.id,
              name: p.name, description: p.description ?? null,
              price, sku: p.code ?? p.article ?? null, categoryId,
              stock: 0, images, active: true,
            });
            if (images.length > 0) result.imagesAdded += images.length;
            result.imported++;
          }
        } catch (err) {
          result.errors++;
          await logSync(shopId, "product", "error", `${p.name}: ${err instanceof Error ? err.message : "xato"}`);
        }
      }

      if (page.rows.length < 100) break;
      offset += 100;
    }
  } catch (err) {
    await logSync(shopId, "products", "error", err instanceof Error ? err.message : "xato");
    throw err;
  }

  // 3. Stock sinxronlash
  try {
    const stockResult = await syncStock(shopId);
    result.stockUpdated = stockResult;
  } catch (err) {
    result.errors++;
    await logSync(shopId, "stock", "error", err instanceof Error ? err.message : "xato");
  }

  await db.update(schema.integrations)
    .set({ lastSyncAt: new Date() })
    .where(and(eq(schema.integrations.shopId, shopId), eq(schema.integrations.type, "moysklad")));

  await logSync(shopId, "sync", "success",
    `Tugadi: +${result.imported} yangi, ${result.updated} yangilandi, stock ${result.stockUpdated} ta, +${result.imagesAdded} rasm, ${result.errors} xato`,
    result,
  );

  return result;
}

export async function syncStock(shopId: string): Promise<number> {
  const client = await getClient(shopId);
  if (!client) throw new Error("MoySklad ulanmagan");

  let updated = 0;
  let offset = 0;
  while (true) {
    const page = await client.listStock({ limit: 1000, offset });
    if (page.rows.length === 0) break;
    for (const row of page.rows) {
      const productExtId = row.assortmentId ?? (row.meta ? idFromHref(row.meta.href) : null);
      if (!productExtId) continue;
      const existing = await db.query.products.findFirst({
        where: and(eq(schema.products.shopId, shopId), eq(schema.products.externalId, productExtId)),
      });
      if (!existing) continue;
      const newStock = Math.max(0, Math.floor(row.stock ?? row.quantity ?? 0));
      if (existing.stock !== newStock) {
        await db.update(schema.products).set({ stock: newStock, updatedAt: new Date() }).where(eq(schema.products.id, existing.id));
        updated++;
      }
    }
    if (page.rows.length < 1000) break;
    offset += 1000;
  }
  return updated;
}

/** Buyurtma'ni avtomatik MoySklad'ga jo'natish (order.created event'idan keyin chaqiriladi) */
export async function pushOrder(shopId: string, orderId: string): Promise<void> {
  const client = await getClient(shopId);
  if (!client) return;
  const config = await getConfig(shopId);
  if (!config?.organizationHref) {
    await logSync(shopId, "order", "skipped", "Organisation tanlanmagan");
    return;
  }

  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || order.externalId) return;

  const items = await db.query.orderItems.findMany({ where: eq(schema.orderItems.orderId, orderId) });

  // Counterparty
  const tgUser = order.tgUserId
    ? await db.query.tgUsers.findFirst({ where: eq(schema.tgUsers.id, order.tgUserId) })
    : null;
  const customerName = tgUser
    ? [tgUser.firstName, tgUser.lastName].filter(Boolean).join(" ") || tgUser.username || `Mijoz ${order.customerPhone ?? ""}`
    : `Mijoz ${order.customerPhone ?? "anonim"}`;

  let counterpartyMeta;
  try {
    const cp = await client.findOrCreateCounterparty({
      name: customerName,
      phone: order.customerPhone ?? undefined,
    });
    counterpartyMeta = cp.meta;
  } catch (err) {
    await logSync(shopId, "counterparty", "error", err instanceof Error ? err.message : "xato", { orderId }, "out");
  }

  // Positions
  const positions: object[] = [];
  for (const it of items) {
    if (!it.productId) continue;
    const product = await db.query.products.findFirst({ where: eq(schema.products.id, it.productId) });
    if (!product?.externalId) continue;
    positions.push({
      quantity: it.quantity,
      price: it.price * 100,
      assortment: {
        meta: {
          href: `https://api.moysklad.ru/api/remap/1.2/entity/product/${product.externalId}`,
          type: "product",
          mediaType: "application/json",
        },
      },
    });
  }
  if (positions.length === 0) {
    await logSync(shopId, "order", "skipped", `${order.orderNumber}: hech qanday mahsulot MoySklad'da yo'q`, { orderId }, "out");
    return;
  }

  const payload: Record<string, unknown> = {
    name: order.orderNumber,
    description: `${order.notes ?? ""}\nTel: ${order.customerPhone ?? ""}\nManzil: ${formatAddress(order.deliveryAddress)}`.trim(),
    organization: { meta: { href: config.organizationHref, type: "organization", mediaType: "application/json" } },
    positions,
  };
  if (counterpartyMeta) payload.agent = { meta: counterpartyMeta };
  if (config.storeHref) payload.store = { meta: { href: config.storeHref, type: "store", mediaType: "application/json" } };

  try {
    const created = await client.createCustomerOrder(payload);
    await db.update(schema.orders).set({ externalId: created.id, updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
    await logSync(shopId, "order", "success", `${order.orderNumber} → MoySklad ${created.name}`, { orderId, externalId: created.id }, "out");
  } catch (err) {
    await logSync(shopId, "order", "error", `${order.orderNumber}: ${err instanceof Error ? err.message : "xato"}`, { orderId }, "out");
  }
}

function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") return "";
  const a = addr as Record<string, string | undefined>;
  return [a.city, a.street, a.house, a.apartment].filter(Boolean).join(", ");
}

function pickEmojiForCategory(name: string): string {
  const lower = name.toLowerCase();
  const map: Array<[string[], string]> = [
    [["atir", "perfume", "духи"], "💐"],
    [["kosmetika", "cosmetic", "косметика", "lab", "lipstick"], "💄"],
    [["kiyim", "одежда", "clothes"], "👕"],
    [["oziq", "ovqat", "food", "еда", "продукт"], "🥖"],
    [["elektr", "electronic", "phone", "техника"], "📱"],
    [["soat", "watch"], "⌚"],
    [["kitob", "book"], "📚"],
    [["o'yin", "toy", "игра", "игрушка"], "🧸"],
  ];
  for (const [keys, emoji] of map) {
    if (keys.some((k) => lower.includes(k))) return emoji;
  }
  return "📦";
}

/** Sync logs olish (admin UI uchun) */
export async function getSyncLogs(shopId: string, limit = 50) {
  const rows = await db.query.syncLogs.findMany({
    where: and(eq(schema.syncLogs.shopId, shopId), eq(schema.syncLogs.integrationType, "moysklad")),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit,
  });
  return rows;
}
