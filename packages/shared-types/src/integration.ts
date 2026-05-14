export type MoyskladStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";

export interface MoyskladAccount {
  tenantId: string;
  accountUuid?: string | null;
  status: MoyskladStatus;
  lastWebhookAt?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
  connectedAt?: string | null;
  webhookSubscriptionIds: string[];
}

export interface MoyskladConnectRequest {
  /** Personal access token from MoySklad. */
  token: string;
}

export interface MoyskladConnectionTest {
  ok: boolean;
  accountName?: string;
  accountUuid?: string;
  permissions?: string[];
  error?: string;
}
