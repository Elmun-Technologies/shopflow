import { Bot, session, type Context, type SessionFlavor } from "grammy";
import { RedisAdapter } from "@grammyjs/storage-redis";
import type Redis from "ioredis";
import type { PrismaClient } from "@shopflow/db";
import type { Logger } from "pino";
import { SecretCipher } from "./secret-cipher.js";
import { registerHandlers, type ShopFlowContext, type ShopFlowSession } from "./handlers.js";

interface ManagerOptions {
  prisma: PrismaClient;
  cipher: SecretCipher;
  log: Logger;
  apiBase: string;
  miniAppBase: string;
  redis: Redis;
}

export interface TenantBot {
  tenantId: string;
  username: string | null;
  bot: Bot<ShopFlowContext>;
}

/**
 * Holds one grammY `Bot` instance per tenant. Boot-time loads all enabled
 * TelegramBot rows; thereafter, the API publishes `bot:reload` events on Redis
 * whenever a tenant adds/removes a bot — `listenForReload` keeps the map in sync.
 */
export class BotManager {
  private readonly bots = new Map<string, TenantBot>();
  private subscriber: Redis | null = null;

  constructor(private readonly opts: ManagerOptions) {}

  async loadAll(): Promise<void> {
    const rows = await this.opts.prisma.telegramBot.findMany({
      where: { enabled: true },
      include: { tenant: { select: { slug: true, name: true } } },
    });
    for (const row of rows) {
      await this.spawn(row.tenantId).catch((err) => {
        this.opts.log.error({ err, tenantId: row.tenantId }, "Failed to spawn bot");
      });
    }
    this.opts.log.info({ count: this.bots.size }, "Bots loaded");
  }

  listenForReload(): void {
    this.subscriber = this.opts.redis.duplicate();
    this.subscriber.subscribe("bot:reload", (err) => {
      if (err) this.opts.log.error({ err }, "Failed to subscribe to bot:reload");
    });
    this.subscriber.on("message", async (_channel, message) => {
      try {
        const { tenantId, action } = JSON.parse(message) as { tenantId: string; action: string };
        if (action === "upsert") {
          await this.reload(tenantId);
        } else if (action === "remove") {
          await this.remove(tenantId);
        }
      } catch (err) {
        this.opts.log.error({ err, message }, "Bad bot:reload payload");
      }
    });
  }

  get(tenantId: string): TenantBot | undefined {
    return this.bots.get(tenantId);
  }

  async dispatch(tenantId: string, update: unknown): Promise<void> {
    const entry = this.bots.get(tenantId) ?? (await this.reload(tenantId));
    if (!entry) return;
    await entry.bot.handleUpdate(update as never);
  }

  async shutdown(): Promise<void> {
    if (this.subscriber) await this.subscriber.quit();
    this.bots.clear();
  }

  // ---------- internals ----------

  private async spawn(tenantId: string): Promise<TenantBot> {
    const row = await this.opts.prisma.telegramBot.findUnique({ where: { tenantId } });
    if (!row) throw new Error(`No TelegramBot row for tenant ${tenantId}`);
    if (!row.enabled) throw new Error(`Bot disabled for tenant ${tenantId}`);

    const token = this.opts.cipher.decrypt(row.encryptedToken);
    const bot = new Bot<ShopFlowContext>(token);

    bot.use(
      session({
        initial: (): ShopFlowSession => ({ cart: [], flow: null }),
        storage: new RedisAdapter({ instance: this.opts.redis, ttl: 60 * 60 * 24 * 30 }),
        getSessionKey: (ctx) => (ctx.chat ? `tg:${tenantId}:${ctx.chat.id}` : undefined),
      }),
    );

    bot.use(async (ctx, next) => {
      ctx.tenantId = tenantId;
      ctx.apiBase = this.opts.apiBase;
      ctx.miniAppBase = this.opts.miniAppBase;
      ctx.log = this.opts.log.child({ tenantId, chatId: ctx.chat?.id });
      ctx.prisma = this.opts.prisma;
      await next();
    });

    registerHandlers(bot);

    const entry: TenantBot = { tenantId, username: row.username, bot };
    this.bots.set(tenantId, entry);
    this.opts.log.info({ tenantId, username: row.username }, "Bot spawned");
    return entry;
  }

  private async reload(tenantId: string): Promise<TenantBot | undefined> {
    const existing = this.bots.get(tenantId);
    if (existing) this.bots.delete(tenantId);
    try {
      return await this.spawn(tenantId);
    } catch (err) {
      this.opts.log.error({ err, tenantId }, "Reload failed");
      return undefined;
    }
  }

  private async remove(tenantId: string): Promise<void> {
    this.bots.delete(tenantId);
    this.opts.log.info({ tenantId }, "Bot removed");
  }
}
