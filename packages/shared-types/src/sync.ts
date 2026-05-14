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
  stats: Record<string, number>;
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
  payloadPreview: string;
  processedAt?: string | null;
  error?: string | null;
  createdAt: string;
}
