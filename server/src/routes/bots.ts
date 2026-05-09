import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { connectBot, disconnectBot, listBots, getBotStatus } from "../services/bots.js";

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
}
