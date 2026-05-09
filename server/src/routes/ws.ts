import type { FastifyInstance } from "fastify";
import { subscribe } from "../lib/events.js";

interface JwtPayload { userId?: string; shopId: string; kind?: string }

export default async function wsRoutes(app: FastifyInstance) {
  app.get("/api/ws", { websocket: true }, async (socket, req) => {
    const tokenRaw = (req.query as { token?: string }).token;
    if (!tokenRaw) {
      socket.send(JSON.stringify({ type: "error", error: "token kerak" }));
      socket.close();
      return;
    }
    let payload: JwtPayload;
    try {
      payload = app.jwt.verify(tokenRaw);
    } catch {
      socket.send(JSON.stringify({ type: "error", error: "token noto'g'ri" }));
      socket.close();
      return;
    }
    if (payload.kind === "miniapp") {
      socket.send(JSON.stringify({ type: "error", error: "Mini App tokeni emas — admin token kerak" }));
      socket.close();
      return;
    }

    socket.send(JSON.stringify({ type: "hello", shopId: payload.shopId }));

    const unsub = subscribe(payload.shopId, (event) => {
      try {
        socket.send(JSON.stringify(event));
      } catch (err) {
        req.log.warn({ err }, "ws send failed");
      }
    });

    const ping = setInterval(() => {
      try { socket.send(JSON.stringify({ type: "ping", t: Date.now() })); } catch { /* */ }
    }, 30000);

    socket.on("close", () => {
      clearInterval(ping);
      unsub();
    });
  });
}
