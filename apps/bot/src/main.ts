import { pino } from "pino";
import { z } from "zod";
import { PrismaClient } from "@shopflow/db";
import Redis from "ioredis";
import { BotManager } from "./bot-manager.js";
import { TelegramUpdateConsumer } from "./update-consumer.js";
import { SecretCipher } from "./secret-cipher.js";

const Env = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  SECRETS_ENCRYPTION_KEY: z.string().length(64),
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  PUBLIC_MINIAPP_URL: z.string().url().default("http://localhost:5174"),
});

async function main() {
  const env = Env.parse(process.env);
  const log = pino({ name: "shopflow-bot", level: process.env.LOG_LEVEL ?? "info" });

  const prisma = new PrismaClient();
  await prisma.$connect();

  const cipher = new SecretCipher(Buffer.from(env.SECRETS_ENCRYPTION_KEY, "hex"));
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const manager = new BotManager({
    prisma,
    cipher,
    log: log.child({ component: "BotManager" }),
    apiBase: env.PUBLIC_API_URL.replace(/\/$/, ""),
    miniAppBase: env.PUBLIC_MINIAPP_URL.replace(/\/$/, ""),
    redis,
  });
  await manager.loadAll();
  manager.listenForReload();

  const consumer = new TelegramUpdateConsumer({ redis, manager, log: log.child({ component: "Consumer" }) });
  consumer.start();

  const shutdown = async () => {
    log.info("Shutting down");
    consumer.stop();
    await manager.shutdown();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  log.info("Bot runner started");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
