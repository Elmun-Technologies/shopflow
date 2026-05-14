import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHmac, createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SecretCipherService } from "../../common/crypto/secret-cipher.service.js";
import { AppConfigService } from "../../config/app-config.service.js";

interface TelegramInitDataUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface VerifyResult {
  ok: true;
  accessToken: string;
  tenant: { id: string; slug: string; name: string };
  customer: { id: string; name: string };
  user: TelegramInitDataUser;
}

/**
 * Validates Telegram WebApp `initData` and issues a short-lived storefront
 * JWT identifying the customer. The verification follows the Telegram spec:
 *
 *   secret_key = HMAC_SHA256("WebAppData", bot_token)
 *   expected   = HMAC_SHA256(secret_key, data_check_string)
 *
 * where `data_check_string` is `\n`-joined `key=value` pairs (sorted by key,
 * `hash` removed). See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app.
 *
 * Also creates / links a Customer + TelegramUser row so subsequent storefront
 * calls can attribute orders to the right person.
 */
@Injectable()
export class MiniappService {
  /** initData becomes stale after this many seconds. */
  private readonly MAX_AGE_SECONDS = 24 * 60 * 60;
  /** Storefront JWT lifetime — short-lived, refreshed each Mini App open. */
  private readonly JWT_TTL = "30m";

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cipher: SecretCipherService,
    private readonly config: AppConfigService,
  ) {}

  async verify(tenantSlug: string, initData: string): Promise<VerifyResult> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, name: true, status: true },
    });
    if (!tenant || tenant.status !== "ACTIVE") throw new NotFoundException("Tenant not found");

    const bot = await this.prisma.telegramBot.findUnique({ where: { tenantId: tenant.id } });
    if (!bot?.enabled) throw new BadRequestException("Telegram bot not configured for this tenant");

    const botToken = this.cipher.decrypt(bot.encryptedToken);
    const verified = verifyInitData(initData, botToken, this.MAX_AGE_SECONDS);
    if (!verified.ok) throw new BadRequestException(verified.error);

    const user = verified.user;

    const telegramUser = await this.prisma.telegramUser.upsert({
      where: { tenantId_chatId: { tenantId: tenant.id, chatId: BigInt(user.id) } },
      create: {
        tenantId: tenant.id,
        chatId: BigInt(user.id),
        username: user.username ?? null,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
        languageCode: user.language_code ?? "uz",
      },
      update: {
        username: user.username ?? null,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
      },
      include: { customer: true },
    });

    let customer = telegramUser.customer;
    if (!customer) {
      const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.username ||
        `Telegram ${user.id}`;
      customer = await this.prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: displayName,
          tags: ["telegram-miniapp"] as never,
        },
      });
      await this.prisma.telegramUser.update({
        where: { id: telegramUser.id },
        data: { customerId: customer.id },
      });
    }

    const accessToken = await this.jwt.signAsync(
      {
        sub: customer.id,
        tenantId: tenant.id,
        role: "STOREFRONT",
        chatId: user.id.toString(),
      },
      { secret: this.config.jwtAccessSecret, expiresIn: this.JWT_TTL },
    );

    return {
      ok: true,
      accessToken,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      customer: { id: customer.id, name: customer.name },
      user,
    };
  }
}

interface VerifyOk {
  ok: true;
  user: TelegramInitDataUser;
}
interface VerifyErr {
  ok: false;
  error: string;
}

function verifyInitData(initData: string, botToken: string, maxAgeSec: number): VerifyOk | VerifyErr {
  if (!initData) return { ok: false, error: "Empty initData" };

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) return { ok: false, error: "Missing hash" };
  params.delete("hash");

  const entries: Array<[string, string]> = [];
  for (const [k, v] of params.entries()) entries.push([k, v]);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!timingSafeEqualHex(expected, receivedHash)) {
    return { ok: false, error: "Invalid initData signature" };
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSec) {
    return { ok: false, error: "initData expired" };
  }

  const userJson = params.get("user");
  if (!userJson) return { ok: false, error: "Missing user" };
  try {
    const user = JSON.parse(userJson) as TelegramInitDataUser;
    if (typeof user.id !== "number") throw new Error("user.id missing");
    return { ok: true, user };
  } catch (err) {
    return { ok: false, error: `Bad user JSON: ${String(err)}` };
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  // Constant-time compare: hash both and compare digests
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ah.length; i++) diff |= ah[i]! ^ bh[i]!;
  return diff === 0 && a === b;
}
