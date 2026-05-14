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

export type PaymentProviderName = "CLICK" | "PAYME";

export interface ClickConfig {
  serviceId: string;
  merchantId: string;
  merchantUserId?: string;
}

export interface PaymeConfig {
  cashboxId: string;
  testMode?: boolean;
}

export interface PaymentProviderStatus {
  provider: PaymentProviderName;
  enabled: boolean;
  configured: boolean;
  publicConfig: ClickConfig | PaymeConfig | Record<string, unknown>;
  lastEventAt?: string | null;
  lastError?: string | null;
}

export interface PaymentLinks {
  clickUrl?: string;
  paymeUrl?: string;
}
