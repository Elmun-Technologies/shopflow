import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { connectBot, disconnectBot, listBots, getBotStatus } from "../services/bots.js";
import { db, schema } from "../db/index.js";
import { botUiSchemaSchema, defaultUiSchema } from "../lib/uiSchema.js";

const connectSchema = z.object({ token: z.string().min(20) });

export default async function botRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  function shopId(req: { user: unknown }): string {
    const u = req.user as { kind?: string; shopId?: string };
    if (u.kind === "miniapp") throw new Error("Admin token kerak");
    if (!u.shopId) throw new Error("shopId yo'q");
    return u.shopId;
  }

  app.get("/", async (req) => {
    return await listBots(shopId(req));
  });

  app.post("/", async (req, reply) => {
    const body = connectSchema.parse(req.body);
    const result = await connectBot({ shopId: shopId(req), token: body.token });
    return reply.code(201).send(result);
  });

  app.get("/:id/status", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return await getBotStatus({ shopId: shopId(req), botId: params.id });
  });

  app.delete("/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return await disconnectBot({ shopId: shopId(req), botId: params.id });
  });

  // UI schema
  app.get("/:id/ui-schema", async (req, reply) => {
    const sid = shopId(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const bot = await db.query.bots.findFirst({
      where: and(eq(schema.bots.id, params.id), eq(schema.bots.shopId, sid)),
    });
    if (!bot) return reply.code(404).send({ error: "Bot topilmadi" });
    const stored = bot.uiSchema as unknown;
    return stored ? botUiSchemaSchema.parse(stored) : defaultUiSchema;
  });

  app.put("/:id/ui-schema", async (req, reply) => {
    const sid = shopId(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = botUiSchemaSchema.parse(req.body);
    const bot = await db.query.bots.findFirst({
      where: and(eq(schema.bots.id, params.id), eq(schema.bots.shopId, sid)),
    });
    if (!bot) return reply.code(404).send({ error: "Bot topilmadi" });
    await db.update(schema.bots).set({ uiSchema: body }).where(eq(schema.bots.id, bot.id));
    return body;
  });
}
