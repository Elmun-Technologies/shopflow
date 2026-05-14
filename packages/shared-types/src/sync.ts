export type SyncJobStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED";
export type SyncJobType =
  | "INITIAL_IMPORT"
  | "INCREMENTAL_SYNC"
  | "ENTITY_REFRESH"
  | "SUBSCRIBE_WEBHOOKS"
  | "RECONCILE";

export interface SyncJob {
  id: string;
  tenantId: string;
  type: SyncJobType;
  status: SyncJobStatus;
  progress: number;
  /**
   * Counters from the running job. The reserved key `_phase` holds the
   * current human-readable phase ("Mahsulotlar", "Qoldiqlar"…) used by the UI.
   */
  stats: Record<string, number | string>;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
}

export type WebhookSource = "MOYSKLAD" | "TELEGRAM" | "CLICK" | "PAYME";

export interface WebhookEvent {
  id: string;
  tenantId: string;
  source: WebhookSource;
  entityType: string;
  action: string;
  idempotencyKey?: string | null;
  entityMoyskladId?: string | null;
  attempts?: number;
  payloadPreview?: string;
  processedAt?: string | null;
  error?: string | null;
  createdAt: string;
}
