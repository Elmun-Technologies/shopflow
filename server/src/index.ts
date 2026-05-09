import "./lib/loadEnv.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import authRoutes from "./routes/auth.js";
import botRoutes from "./routes/bots.js";
import webhookRoutes from "./routes/webhook.js";
import { bootAllBots } from "./bot/runtime.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: any, reply: any) => Promise<void>;
  }
}
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string; shopId: string };
    user: { userId: string; shopId: string };
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
