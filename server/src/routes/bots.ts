import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { connectBot, disconnectBot, listBots, getBotStatus } from "../services/bots.js";

const connectSchema = z.object({ token: z.string().min(20) });

export default async function botRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req) => {
    return await listBots(req.user.shopId);
  });

  app.post("/", async (req, reply) => {
    const body = connectSchema.parse(req.body);
    const result = await connectBot({ shopId: req.user.shopId, token: body.token });
    return reply.code(201).send(result);
  });

  app.get("/:id/status", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return await getBotStatus({ shopId: req.user.shopId, botId: params.id });
  });

  app.delete("/:id", async (req) => {
    const params = z.object({ id: z.string() }).parse(req.params);
    return await disconnectBot({ shopId: req.user.shopId, botId: params.id });
  });
}
