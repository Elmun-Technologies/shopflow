import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import axios from "axios";
import { randomBytes } from "node:crypto";
import { Redis } from "ioredis";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SecretCipherService } from "../../common/crypto/secret-cipher.service.js";
import { AppConfigService } from "../../config/app-config.service.js";

const TELEGRAM_API = "https://api.telegram.org/bot";

/**
 * Manages tenant Telegram bots: validates tokens with Bot API,
 * stores them encrypted, registers webhooks, and pings the bot
 * runner (apps/bot) over Redis pub/sub so it hot-reloads.
 */
@Injectable()
export class TelegramIntegrationService {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipherService,
    private readonly config: AppConfigService,
  ) {
    this.redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
    this.redis.connect().catch(() => undefined);
  }

  async getStatus(tenantId: string) {
    const bot = await this.prisma.telegramBot.findUnique({ where: { tenantId } });
    if (!bot) return { tenantId, enabled: false, webhookSet: false };
    return {
      tenantId,
      username: bot.username,
      enabled: bot.enabled,
      webhookSet: bot.webhookSet,
      webhookUrl: bot.webhookUrl,
      connectedAt: bot.connectedAt?.toISOString() ?? null,
      lastUpdateAt: bot.lastUpdateAt?.toISOString() ?? null,
    };
  }

  async connect(tenantId: string, token: string) {
    const me = await this.callGetMe(token);
    if (!me.ok) throw new BadRequestException(me.error ?? "Invalid bot token");

    const webhookSecret = randomBytes(24).toString("base64url");
    const webhookUrl = `${this.config.publicApiUrl}/tg/${tenantId}/${webhookSecret}`;

    const setWebhook = await this.callSetWebhook(token, webhookUrl, webhookSecret);
    if (!setWebhook.ok) {
      throw new BadRequestException(setWebhook.error ?? "Failed to register webhook");
    }

    const encryptedToken = this.cipher.encrypt(token);
    const bot = await this.prisma.telegramBot.upsert({
      where: { tenantId },
      create: {
        tenantId,
        encryptedToken,
        username: me.username,
        webhookSecret,
        webhookUrl,
        webhookSet: true,
        enabled: true,
        connectedAt: new Date(),
      },
      update: {
        encryptedToken,
        username: me.username,
        webhookSecret,
        webhookUrl,
        webhookSet: true,
        enabled: true,
        connectedAt: new Date(),
        lastError: null,
      },
    });

    await this.redis.publish("bot:reload", JSON.stringify({ tenantId, action: "upsert" }));
    return { username: bot.username, webhookUrl };
  }

  async disconnect(tenantId: string) {
    const bot = await this.prisma.telegramBot.findUnique({ where: { tenantId } });
    if (!bot) throw new NotFoundException("Telegram bot not connected");
    const token = this.cipher.decrypt(bot.encryptedToken);
    await this.callDeleteWebhook(token).catch(() => undefined);
    await this.prisma.telegramBot.delete({ where: { tenantId } });
    await this.redis.publish("bot:reload", JSON.stringify({ tenantId, action: "remove" }));
    return { ok: true };
  }

  private async callGetMe(token: string): Promise<{ ok: boolean; username?: string; name?: string; error?: string }> {
    try {
      const res = await axios.get(`${TELEGRAM_API}${token}/getMe`, { timeout: 10_000 });
      const r = res.data as { ok: boolean; result?: { username: string; first_name: string } };
      if (!r.ok || !r.result) return { ok: false, error: "Telegram getMe failed" };
      return { ok: true, username: r.result.username, name: r.result.first_name };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }

  private async callSetWebhook(token: string, url: string, secret: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await axios.post(`${TELEGRAM_API}${token}/setWebhook`, {
        url,
        secret_token: secret,
        allowed_updates: ["message", "callback_query", "inline_query", "pre_checkout_query"],
        drop_pending_updates: false,
      }, { timeout: 10_000 });
      const r = res.data as { ok: boolean; description?: string };
      return r.ok ? { ok: true } : { ok: false, error: r.description };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }

  private async callDeleteWebhook(token: string): Promise<void> {
    await axios.post(`${TELEGRAM_API}${token}/deleteWebhook`, {}, { timeout: 10_000 });
  }
}
