import type { Redis } from "ioredis";
import type { Logger } from "pino";
import type { BotManager } from "./bot-manager.js";

interface Options {
  redis: Redis;
  manager: BotManager;
  log: Logger;
}

/**
 * Reads Telegram updates that apps/api wrote to the `tg:updates` Redis stream
 * and dispatches each to the right tenant's grammY Bot. Uses a consumer group
 * so multiple bot replicas can scale horizontally and we don't double-process.
 */
export class TelegramUpdateConsumer {
  private running = false;
  private readonly stream = "tg:updates";
  private readonly group = "bots";
  private readonly consumer = `bot-${process.pid}`;

  constructor(private readonly opts: Options) {}

  start(): void {
    this.running = true;
    this.opts.redis.xgroup("CREATE", this.stream, this.group, "$", "MKSTREAM").catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("BUSYGROUP")) this.opts.log.error({ err }, "xgroup create failed");
    });
    void this.loop();
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const res = (await this.opts.redis.xreadgroup(
          "GROUP", this.group, this.consumer,
          "COUNT", "32",
          "BLOCK", "5000",
          "STREAMS", this.stream, ">",
        )) as Array<[string, Array<[string, string[]]>]> | null;

        if (!res) continue;
        for (const [, entries] of res) {
          for (const [id, fields] of entries) {
            try {
              const tenantId = fieldValue(fields, "tenantId");
              const updateJson = fieldValue(fields, "update");
              if (!tenantId || !updateJson) {
                await this.opts.redis.xack(this.stream, this.group, id);
                continue;
              }
              const update = JSON.parse(updateJson);
              await this.opts.manager.dispatch(tenantId, update);
              await this.opts.redis.xack(this.stream, this.group, id);
            } catch (err) {
              this.opts.log.error({ err, id }, "Failed to dispatch update");
              // Leave unacked so it can be retried by another consumer.
            }
          }
        }
      } catch (err) {
        this.opts.log.error({ err }, "Consumer loop error");
        await sleep(1000);
      }
    }
  }
}

function fieldValue(fields: string[], key: string): string | null {
  for (let i = 0; i < fields.length; i += 2) {
    if (fields[i] === key) return fields[i + 1] ?? null;
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
