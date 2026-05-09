import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

/** Telegram'dan kelgan har yangi mijoz uchun lead yaratish (idempotent). */
export async function createLeadFromTelegram(input: {
  shopId: string;
  tgUserId: string;
  name: string;
  username?: string | null;
}) {
  const existing = await db.query.leads.findFirst({
    where: and(eq(schema.leads.shopId, input.shopId), eq(schema.leads.tgUserId, input.tgUserId)),
  });
  if (existing) return existing;

  const [lead] = await db.insert(schema.leads).values({
    shopId: input.shopId,
    source: "telegram",
    status: "new",
    priority: "medium",
    name: input.name,
    tgUserId: input.tgUserId,
    metadata: input.username ? { tgUsername: input.username } : null,
    value: 0,
  }).returning();
  return lead;
}

/** Buyurtma yaratilganda — bog'langan lead'ni "converted" ga o'tkazish. */
export async function markLeadConvertedFromOrder(input: {
  shopId: string;
  tgUserId: string | null;
  orderId: string;
  orderTotal: number;
}) {
  if (!input.tgUserId) return;
  const lead = await db.query.leads.findFirst({
    where: and(eq(schema.leads.shopId, input.shopId), eq(schema.leads.tgUserId, input.tgUserId)),
  });
  if (!lead) return;
  await db.update(schema.leads).set({
    status: "converted",
    orderId: input.orderId,
    value: Math.max(lead.value, input.orderTotal),
    updatedAt: new Date(),
  }).where(eq(schema.leads.id, lead.id));
}
