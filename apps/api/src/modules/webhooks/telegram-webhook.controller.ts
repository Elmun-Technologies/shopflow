import { Body, Controller, Headers, HttpCode, Logger, Param, Post, UnauthorizedException, NotFoundException } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../../prisma/prisma.service.js";
import { Public } from "../../common/auth/auth.decorators.js";
import { AppConfigService } from "../../config/app-config.service.js";

/**
 * Telegram update receiver. The actual update is forwarded to `apps/bot` via
 * Redis stream `tg:updates` — that process owns the grammY Bot instances.
 * We validate the `X-Telegram-Bot-Api-Secret-Token` against the stored secret
 * before forwarding to defeat spoofed requests.
 */
@Controller("tg")
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    config: AppConfigService,
  ) {
    this.redis = new Redis(config.redisUrl, { lazyConnect: true, maxRetriesPerRequest: null });
    this.redis.connect().catch(() => undefined);
  }

  @Public()
  @HttpCode(200)
  @Post(":tenantId/:secret")
  async receive(
    @Param("tenantId") tenantId: string,
    @Param("secret") secret: string,
    @Headers("x-telegram-bot-api-secret-token") header: string | undefined,
    @Body() update: unknown,
  ) {
    const bot = await this.prisma.telegramBot.findUnique({ where: { tenantId } });
    if (!bot || !bot.enabled) throw new NotFoundException();
    if (bot.webhookSecret !== secret) throw new UnauthorizedException();
    if (header && header !== secret) throw new UnauthorizedException();

    await this.redis.xadd(
      "tg:updates",
      "MAXLEN", "~", "10000",
      "*",
      "tenantId", tenantId,
      "update", JSON.stringify(update),
    );

    await this.prisma.telegramBot.update({
      where: { tenantId },
      data: { lastUpdateAt: new Date() },
    }).catch(() => undefined);

    return { ok: true };
  }
}
