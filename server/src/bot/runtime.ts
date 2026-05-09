/**
 * Bot lifecycle: PROCESS scope'idagi grammY instancelarni boshqaradi.
 * Polling rejimi (development) — bu yerda jonli ishlaydi.
 * Webhook rejimi — instance webhook callback uchun yaratiladi (apply orqali).
 */
import { Bot, type Context } from "grammy";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { decrypt } from "../lib/crypto.js";
import { buildBotHandler } from "./handlers.js";

const instances = new Map<string, Bot>();

function build(botId: string, token: string): Bot {
  const bot = new Bot(token);
  buildBotHandler(bot, botId);
  bot.catch((err) => {
    console.error(`[bot ${botId}] update error:`, err);
  });
  return bot;
}

export function startBotInstance(botId: string, token: string): Bot {
  stopBotInstance(botId);
  const bot = build(botId, token);
  instances.set(botId, bot);
  bot.start({ drop_pending_updates: false }).catch((err) => {
    console.error(`[bot ${botId}] polling stopped:`, err);
  });
  console.log(`[bot ${botId}] polling started`);
  return bot;
}

export function stopBotInstance(botId: string): void {
  const inst = instances.get(botId);
  if (inst) {
    inst.stop().catch(() => {});
    instances.delete(botId);
    console.log(`[bot ${botId}] stopped`);
  }
}

export async function getOrBuildWebhookBot(botId: string): Promise<Bot> {
  let inst = instances.get(botId);
  if (inst) return inst;
  const row = await db.query.bots.findFirst({ where: eq(schema.bots.id, botId) });
  if (!row) throw new Error("bot not found");
  const token = decrypt(row.tokenEncrypted);
  inst = build(botId, token);
  await inst.init();
  instances.set(botId, inst);
  return inst;
}

export async function dispatchUpdate(botId: string, update: unknown): Promise<void> {
  const bot = await getOrBuildWebhookBot(botId);
  await bot.handleUpdate(update as Parameters<Bot["handleUpdate"]>[0]);
}

export async function bootAllBots(): Promise<void> {
  if (process.env.PUBLIC_URL) return;
  const rows = await db.query.bots.findMany({ where: eq(schema.bots.status, "active") });
  for (const row of rows) {
    try {
      const token = decrypt(row.tokenEncrypted);
      startBotInstance(row.id, token);
    } catch (err) {
      console.error(`[bot ${row.id}] boot xatosi:`, err);
    }
  }
}

export type { Context };
