import "./lib/loadEnv.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";
import authRoutes from "./routes/auth.js";
import botRoutes from "./routes/bots.js";
import webhookRoutes from "./routes/webhook.js";
import miniappRoutes from "./routes/miniapp.js";
import orderRoutes from "./routes/orders.js";
import productRoutes from "./routes/products.js";
import wsRoutes from "./routes/ws.js";
import integrationRoutes from "./routes/integrations.js";
import paymentRoutes from "./routes/payments.js";
import analyticsRoutes from "./routes/analytics.js";
import customerRoutes from "./routes/customers.js";
import settingsRoutes from "./routes/settings.js";
import { bootAllBots } from "./bot/runtime.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: any, reply: any) => Promise<void>;
  }
}
type AdminJwt = { userId: string; shopId: string };
type MiniappJwt = { kind: "miniapp"; tgUserId: string; shopId: string; botId: string };
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AdminJwt | MiniappJwt;
    user: AdminJwt | MiniappJwt;
  }
}

async function build() {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV === "production" ? undefined : {
        target: "pino-pretty",
        options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
    },
  });

  await app.register(sensible);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(websocket);

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === "change_me_to_random_64_byte_hex_string") {
    app.log.warn("JWT_SECRET o'rnatilmagan yoki default qiymatda — production'da o'zgartiring");
  }
  await app.register(jwt, {
    secret: jwtSecret ?? "dev-secret-change-me",
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? "24h" },
  });

  app.decorate("authenticate", async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: "Avtorizatsiya kerak" });
    }
  });

  app.setErrorHandler((rawErr, _req, reply) => {
    const err = rawErr as { statusCode?: number; message?: string };
    if (rawErr instanceof ZodError) {
      return reply.code(400).send({ error: "Validatsiya xatosi", details: rawErr.flatten() });
    }
    const status = err.statusCode ?? 500;
    if (status < 500) {
      return reply.code(status).send({ error: err.message });
    }
    app.log.error({ err: rawErr }, "ichki xato");
    return reply.code(status).send({ error: err.message ?? "Server xatosi" });
  });

  app.get("/health", async () => ({ ok: true, timestamp: Date.now() }));

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(botRoutes, { prefix: "/api/bots" });
  await app.register(orderRoutes, { prefix: "/api/orders" });
  await app.register(productRoutes, { prefix: "/api/products" });
  await app.register(integrationRoutes, { prefix: "/api/integrations" });
  await app.register(paymentRoutes, { prefix: "/api/payments" });
  await app.register(analyticsRoutes, { prefix: "/api/analytics" });
  await app.register(customerRoutes, { prefix: "/api/customers" });
  await app.register(settingsRoutes, { prefix: "/api/settings" });
  await app.register(miniappRoutes, { prefix: "/api/miniapp" });
  await app.register(wsRoutes);
  await app.register(webhookRoutes);

  return app;
}

async function main() {
  const app = await build();
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });
  app.log.info(`ShopFlow server: http://${host}:${port}`);

  await bootAllBots();
}

main().catch((err) => {
  console.error("server xatosi:", err);
  process.exit(1);
});
