import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const ts = (name: string) => integer(name, { mode: "timestamp_ms" }).default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["owner", "manager", "staff"] }).notNull().default("owner"),
  createdAt: ts("created_at").notNull(),
});

export const shops = sqliteTable("shops", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  domain: text("domain"),
  currency: text("currency").notNull().default("UZS"),
  createdAt: ts("created_at").notNull(),
});

export const bots = sqliteTable("bots", {
  id: id(),
  shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  tokenEncrypted: text("token_encrypted").notNull(),
  username: text("username"),
  botUserId: text("bot_user_id"),
  webhookSecret: text("webhook_secret").notNull(),
  status: text("status", { enum: ["active", "paused", "error"] }).notNull().default("active"),
  lastError: text("last_error"),
  miniappUrl: text("miniapp_url"),
  uiSchema: text("ui_schema", { mode: "json" }),
  createdAt: ts("created_at").notNull(),
}, (t) => ({
  shopIdx: index("bots_shop_idx").on(t.shopId),
  botUserUnique: uniqueIndex("bots_bot_user_unique").on(t.botUserId),
}));

export const tgUsers = sqliteTable("tg_users", {
  id: id(),
  shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  tgUserId: text("tg_user_id").notNull(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  languageCode: text("language_code"),
  createdAt: ts("created_at").notNull(),
}, (t) => ({
  shopTgUserUnique: uniqueIndex("tg_users_shop_tg_unique").on(t.shopId, t.tgUserId),
}));

export const categories = sqliteTable("categories", {
  id: id(),
  shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  name: text("name").notNull(),
  externalId: text("external_id"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = sqliteTable("products", {
  id: id(),
  shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  externalId: text("external_id"),
  sku: text("sku"),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  stock: integer("stock").notNull().default(0),
  images: text("images", { mode: "json" }).$type<string[]>().default([]),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  updatedAt: ts("updated_at").notNull(),
}, (t) => ({
  shopIdx: index("products_shop_idx").on(t.shopId),
}));

export const orders = sqliteTable("orders", {
  id: id(),
  shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  orderNumber: text("order_number").notNull().unique(),
  tgUserId: text("tg_user_id").references(() => tgUsers.id, { onDelete: "set null" }),
  source: text("source", { enum: ["telegram", "miniapp", "admin"] }).notNull(),
  status: text("status", {
    enum: ["pending", "confirmed", "preparing", "shipping", "delivered", "cancelled"],
  }).notNull().default("pending"),
  paymentStatus: text("payment_status", { enum: ["unpaid", "paid", "refunded"] }).notNull().default("unpaid"),
  paymentMethod: text("payment_method"),
  subtotal: real("subtotal").notNull(),
  deliveryFee: real("delivery_fee").notNull().default(0),
  total: real("total").notNull(),
  deliveryAddress: text("delivery_address", { mode: "json" }),
  customerPhone: text("customer_phone"),
  notes: text("notes"),
  externalId: text("external_id"),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
}, (t) => ({
  shopIdx: index("orders_shop_idx").on(t.shopId),
  statusIdx: index("orders_status_idx").on(t.status),
}));

export const orderItems = sqliteTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  price: real("price").notNull(),
  total: real("total").notNull(),
});

export const carts = sqliteTable("carts", {
  id: id(),
  shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  tgUserId: text("tg_user_id").notNull().references(() => tgUsers.id, { onDelete: "cascade" }),
  items: text("items", { mode: "json" }).$type<{ productId: string; quantity: number }[]>().notNull().default([]),
  updatedAt: ts("updated_at").notNull(),
}, (t) => ({
  shopUserUnique: uniqueIndex("carts_shop_user_unique").on(t.shopId, t.tgUserId),
}));

export const integrations = sqliteTable("integrations", {
  id: id(),
  shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["moysklad", "click", "payme"] }).notNull(),
  credentialsEncrypted: text("credentials_encrypted").notNull(),
  config: text("config", { mode: "json" }),
  status: text("status", { enum: ["connected", "error", "disabled"] }).notNull().default("connected"),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),
  createdAt: ts("created_at").notNull(),
}, (t) => ({
  shopTypeUnique: uniqueIndex("integrations_shop_type_unique").on(t.shopId, t.type),
}));

export const payments = sqliteTable("payments", {
  id: id(),
  shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["click", "payme"] }).notNull(),
  providerTxnId: text("provider_txn_id"),
  amount: real("amount").notNull(),
  state: text("state", { enum: ["pending", "prepared", "paid", "cancelled", "failed"] }).notNull().default("pending"),
  raw: text("raw", { mode: "json" }),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
}, (t) => ({
  orderIdx: index("payments_order_idx").on(t.orderId),
  providerTxnIdx: index("payments_provider_txn_idx").on(t.provider, t.providerTxnId),
}));

export const shopSettings = sqliteTable("shop_settings", {
  id: id(),
  shopId: text("shop_id").notNull().references(() => shops.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value", { mode: "json" }),
  updatedAt: ts("updated_at").notNull(),
}, (t) => ({
  shopKeyUnique: uniqueIndex("shop_settings_shop_key_unique").on(t.shopId, t.key),
}));

export const botMessages = sqliteTable("bot_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botId: text("bot_id").notNull().references(() => bots.id, { onDelete: "cascade" }),
  tgUserId: text("tg_user_id"),
  direction: text("direction", { enum: ["in", "out"] }).notNull(),
  messageType: text("message_type"),
  payload: text("payload", { mode: "json" }),
  createdAt: ts("created_at").notNull(),
}, (t) => ({
  botIdx: index("bot_messages_bot_idx").on(t.botId),
}));

export type User = typeof users.$inferSelect;
export type Shop = typeof shops.$inferSelect;
export type Bot = typeof bots.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
