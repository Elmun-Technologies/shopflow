/**
 * MoySklad <-> ShopFlow sync.
 * Pull: products, categories MoySklad'dan ShopFlow'ga
 * Push: yangi orderlar ShopFlow'dan MoySklad'ga
 */
import { and, eq } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { decrypt, encrypt } from "../../lib/crypto.js";
import { MoyskladClient } from "./client.js";

interface MsCredentials {
  type: "token" | "basic";
  token?: string;
  login?: string;
  password?: string;
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

export async function saveCredentials(shopId: string, creds: MsCredentials): Promise<{ name?: string }> {
  // Avval ulanishni tekshiramiz
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
      shopId,
      type: "moysklad",
      credentialsEncrypted: encrypted,
      status: "connected",
    });
  }
  return { name: me.name };
}

export async function disconnect(shopId: string): Promise<void> {
  await db.delete(schema.integrations)
    .where(and(eq(schema.integrations.shopId, shopId), eq(schema.integrations.type, "moysklad")));
}

export async function syncProducts(shopId: string): Promise<{ imported: number; updated: number }> {
  const client = await getClient(shopId);
  if (!client) throw new Error("MoySklad ulanmagan");

  // 1. Kategoriyalar
  const folders = await client.listFolders();
  const folderMap = new Map<string, string>(); // ms id -> shopflow id
  for (const f of folders.rows) {
    const existing = await db.query.categories.findFirst({
      where: and(eq(schema.categories.shopId, shopId), eq(schema.categories.externalId, f.id)),
    });
    if (existing) {
      folderMap.set(f.id, existing.id);
    } else {
      const [cat] = await db.insert(schema.categories).values({
        shopId,
        externalId: f.id,
        name: f.name,
        sortOrder: 0,
      }).returning();
      folderMap.set(f.id, cat.id);
    }
  }

  // 2. Mahsulotlar (sahifalab)
  let offset = 0;
  let imported = 0;
  let updated = 0;
  while (true) {
    const page = await client.listProducts({ limit: 100, offset });
    if (page.rows.length === 0) break;

    for (const p of page.rows) {
      if (p.archived) continue;
      const price = p.salePrices?.[0]?.value ? p.salePrices[0].value / 100 : 0;
      const folderId = p.productFolder ? folderIdFromHref(p.productFolder.meta.href) : null;
      const categoryId = folderId ? folderMap.get(folderId) ?? null : null;

      const existing = await db.query.products.findFirst({
        where: and(eq(schema.products.shopId, shopId), eq(schema.products.externalId, p.id)),
      });
      if (existing) {
        await db.update(schema.products).set({
          name: p.name,
          description: p.description ?? null,
          price,
          sku: p.code ?? p.article ?? null,
          categoryId,
          updatedAt: new Date(),
        }).where(eq(schema.products.id, existing.id));
        updated++;
      } else {
        await db.insert(schema.products).values({
          shopId,
          externalId: p.id,
          name: p.name,
          description: p.description ?? null,
          price,
          sku: p.code ?? p.article ?? null,
          categoryId,
          stock: 0,
          images: [],
          active: true,
        });
        imported++;
      }
    }

    if (page.rows.length < 100) break;
    offset += 100;
  }

  await db.update(schema.integrations)
    .set({ lastSyncAt: new Date() })
    .where(and(eq(schema.integrations.shopId, shopId), eq(schema.integrations.type, "moysklad")));

  return { imported, updated };
}

function folderIdFromHref(href: string): string {
  // .../productfolder/{id}
  const m = href.match(/productfolder\/([a-f0-9-]+)/i);
  return m?.[1] ?? "";
}

/**
 * Order MoySklad'ga push qilish — order.created event'ida ishga tushadi.
 * Hozirda asosiy: customer order yaratish va externalId saqlash.
 * Production'da: contragent (mijoz) yaratish, organisation linker, store linker kerak.
 */
export async function pushOrder(shopId: string, orderId: string): Promise<void> {
  const client = await getClient(shopId);
  if (!client) return; // integratsiya o'chirilgan
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  if (!order || order.externalId) return; // allaqachon push qilingan

  const items = await db.query.orderItems.findMany({ where: eq(schema.orderItems.orderId, orderId) });
  const positions = await Promise.all(items.map(async (it) => {
    if (!it.productId) return null;
    const product = await db.query.products.findFirst({ where: eq(schema.products.id, it.productId) });
    if (!product?.externalId) return null; // MoySklad'da yo'q mahsulotni o'tkazmaymiz
    return {
      quantity: it.quantity,
      price: it.price * 100, // MoySklad copecks
      assortment: { meta: { href: `https://api.moysklad.ru/api/remap/1.2/entity/product/${product.externalId}`, type: "product", mediaType: "application/json" } },
    };
  }));
  const validPositions = positions.filter((p): p is NonNullable<typeof p> => !!p);
  if (validPositions.length === 0) return;

  try {
    const payload = {
      name: order.orderNumber,
      description: order.notes ?? `ShopFlow buyurtma: ${order.orderNumber}`,
      positions: validPositions,
    };
    const created = await client.createCustomerOrder(payload);
    await db.update(schema.orders).set({ externalId: created.id, updatedAt: new Date() }).where(eq(schema.orders.id, order.id));
  } catch (err) {
    // Logla, lekin transaction'ni buzmaydi
    console.warn("MoySklad order push xatosi:", err);
  }
}
