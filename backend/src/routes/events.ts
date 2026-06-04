// SSE (Server-Sent Events) endpoint — admin paneliga real-time push.
// 15s polling o'rniga: yangi buyurtma kelganda darhol bildirishnoma.

import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { subscribe } from "../lib/sse-bus.js";

export const eventsRoutes: FastifyPluginAsync = async (app) => {
  // EventSource Authorization header yubora olmaydi — token query param'dan ham
  // qabul qilamiz va Bearer'ga aylantiramiz.
  app.addHook("preHandler", async (req: FastifyRequest) => {
    const q = req.query as { token?: string } | undefined;
    if (q?.token && !req.headers.authorization) {
      req.headers.authorization = `Bearer ${q.token}`;
    }
  });
  app.addHook("preHandler", app.authenticate);

  app.get("/stream", (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx proxy
    });
    // Ulangani uchun darhol bir paket — frontend tushunadi
    reply.raw.write(`event: connected\ndata: {"ok":true}\n\n`);

    const unsubscribe = subscribe(req.session.tenantId, reply);
    req.raw.on("close", () => unsubscribe());
    // Fastify reply tugamasligi uchun stream'ni ochiq qoldiramiz
    // (reply.sent / reply.hijack'ga muqobil ravishda raw'ni ishlatamiz)
  });
};
