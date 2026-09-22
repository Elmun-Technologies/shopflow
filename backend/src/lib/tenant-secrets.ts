import type { PrismaClient } from "@prisma/client";
import { decryptSecret } from "./secret-cipher.js";

export const TENANT_CREDENTIALS = {
  YANDEX_MAPS_API_KEY: { category: "maps", label: "Yandex Maps JavaScript API key", secret: true, exposable: true },
  YANDEX_ROUTING_API_KEY: { category: "maps", label: "Yandex Routing / Matrix API key", secret: true },
  OPENAI_API_KEY: { category: "ai", label: "OpenAI API key", secret: true },
  OPENAI_MODEL: { category: "ai", label: "OpenAI model", secret: false },
  OPENAI_MODEL_FAST: { category: "ai", label: "OpenAI fast model", secret: false },
  ANTHROPIC_API_KEY: { category: "ai", label: "Anthropic API key", secret: true },
  ANTHROPIC_MODEL: { category: "ai", label: "Anthropic model", secret: false },
  ANTHROPIC_MODEL_FAST: { category: "ai", label: "Anthropic fast model", secret: false },
  AI_PROVIDER: { category: "ai", label: "AI provider", secret: false },
  ESKIZ_LOGIN: { category: "sms", label: "Eskiz login", secret: false },
  ESKIZ_PASSWORD: { category: "sms", label: "Eskiz password", secret: true },
  ESKIZ_FROM: { category: "sms", label: "Eskiz sender", secret: false },
  SMTP_HOST: { category: "email", label: "SMTP host", secret: false },
  SMTP_PORT: { category: "email", label: "SMTP port", secret: false },
  SMTP_USER: { category: "email", label: "SMTP user", secret: false },
  SMTP_PASS: { category: "email", label: "SMTP password", secret: true },
  SMTP_FROM: { category: "email", label: "Email sender", secret: false },
  SMTP_SECURE: { category: "email", label: "SMTP TLS", secret: false },
} as const;

export type TenantCredentialKey = keyof typeof TENANT_CREDENTIALS;
export function isTenantCredentialKey(key: string): key is TenantCredentialKey { return key in TENANT_CREDENTIALS; }

export async function getTenantSecret(prisma: PrismaClient, tenantId: string, key: TenantCredentialKey): Promise<string | null> {
  const row = await prisma.tenantSecret.findUnique({ where: { tenantId_key: { tenantId, key } }, select: { encryptedValue: true } });
  if (!row) return null;
  try { return decryptSecret(row.encryptedValue); } catch { return null; }
}

export async function getTenantSecrets(prisma: PrismaClient, tenantId: string, keys: TenantCredentialKey[]): Promise<Partial<Record<TenantCredentialKey, string>>> {
  const rows = await prisma.tenantSecret.findMany({ where: { tenantId, key: { in: keys } }, select: { key: true, encryptedValue: true } });
  const result: Partial<Record<TenantCredentialKey, string>> = {};
  for (const row of rows) {
    const key = String(row.key);
    if (!isTenantCredentialKey(key)) continue;
    try { result[key] = decryptSecret(String(row.encryptedValue)); } catch { /* corrupted value is treated as absent */ }
  }
  return result;
}
