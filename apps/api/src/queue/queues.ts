/**
 * Named BullMQ queues used by api/worker/bot. Keep names stable — they are part
 * of the Redis key schema and renaming them strands in-flight jobs.
 */
export const QUEUES = {
  MOYSKLAD_SYNC: "moysklad-sync",
  OUTBOUND_SYNC: "outbound-sync",
  WEBHOOKS: "webhooks",
  TELEGRAM_NOTIFICATIONS: "telegram-notifications",
  SCHEDULED: "scheduled",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// ---------- Job payload contracts (shared by producers & consumers) ----------

export interface InitialImportJob {
  tenantId: string;
  syncJobId: string;
}

export interface IncrementalSyncJob {
  tenantId: string;
  entity?: "product" | "variant" | "productfolder" | "customerorder" | "counterparty" | "stock";
}

export interface OrderToMoyskladJob {
  tenantId: string;
  orderId: string;
}

export interface ProductUpdateToMoyskladJob {
  tenantId: string;
  productId: string;
  changedFields: string[];
}

export interface ProcessMoyskladEventJob {
  tenantId: string;
  webhookEventId: string;
}

export interface OrderStatusNotificationJob {
  tenantId: string;
  orderId: string;
  toChatId: string;
  newStatus: string;
}
