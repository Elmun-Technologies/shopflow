export interface TelegramBotInfo {
  tenantId: string;
  username?: string | null;
  enabled: boolean;
  webhookSet: boolean;
  webhookUrl?: string | null;
  connectedAt?: string | null;
  lastUpdateAt?: string | null;
}

export interface TelegramConnectRequest {
  /** Bot token from @BotFather. */
  token: string;
}

export interface TelegramConnectionTest {
  ok: boolean;
  botUsername?: string;
  botName?: string;
  error?: string;
}
