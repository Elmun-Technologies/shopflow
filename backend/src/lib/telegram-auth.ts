// Telegram Mini App initData HMAC tekshiruvi
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
//
// Telegram WebApp.initData — quyidagi format:
//   auth_date=<unix>&query_id=<str>&user=<json_encoded>&hash=<hex>
//
// Tekshirish:
//   data_check_string = sorted(key=value pairs, hash olib tashlab) newline bilan
//   secret_key = HMAC-SHA256("WebAppData", botToken)
//   expected = HMAC-SHA256(data_check_string, secret_key).hex()
//   valid = expected === hash && (Date.now()/1000 - auth_date) < maxAgeSeconds

import { createHmac } from "node:crypto";

const MAX_AGE_SECONDS = 86400; // 24 soat

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAge = MAX_AGE_SECONDS,
): { valid: boolean; userId?: number; username?: string; firstName?: string; lastName?: string } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false };

    params.delete("hash");

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (expectedHash !== hash) return { valid: false };

    const authDate = Number(params.get("auth_date") ?? 0);
    if (Date.now() / 1000 - authDate > maxAge) return { valid: false };

    const userRaw = params.get("user");
    if (!userRaw) return { valid: true };

    const user = JSON.parse(decodeURIComponent(userRaw)) as {
      id?: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };

    return {
      valid: true,
      userId: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
    };
  } catch {
    return { valid: false };
  }
}

// Bot tokenini Prisma'dan (Channel.config) olish uchun helper
export async function getBotTokenForTenant(
  prisma: { channel: { findFirst: (args: unknown) => Promise<{ config: unknown } | null> } },
  tenantId: string,
): Promise<string | null> {
  const channel = await prisma.channel.findFirst({
    where: { tenantId, type: "TELEGRAM", active: true } as never,
    select: { config: true } as never,
  } as never);
  if (!channel) return null;
  const cfg = channel.config as Record<string, unknown> | null;
  return (cfg?.botToken as string) ?? null;
}
