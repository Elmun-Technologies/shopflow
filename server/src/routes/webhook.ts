import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { dispatchUpdate } from "../bot/runtime.js";

export default async function webhookRoutes(app: FastifyInstance) {
  app.post("/tg/webhook/:botId", async (req, reply) => {
    const { botId } = req.params as { botId: string };
    const bot = await db.query.bots.findFirst({ where: eq(schema.bots.id, botId) });
    if (!bot) return reply.code(404).send({ error: "bot not found" });

    const incomingSecret = req.headers["x-telegram-bot-api-secret-token"];
    if (incomingSecret !== bot.webhookSecret) {
      return reply.code(401).send({ error: "invalid secret" });
    }

    try {
      await dispatchUpdate(botId, req.body);
      return reply.code(200).send({ ok: true });
    } catch (err) {
      app.log.error({ err, botId }, "webhook dispatch xatosi");
      return reply.code(200).send({ ok: false });
    }
  });
}
