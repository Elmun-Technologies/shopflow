import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { mkdir } from "node:fs/promises";
import { prismaPlugin } from "./plugins/prisma.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { tenantRoutes } from "./routes/tenants.js";
import { leadRoutes } from "./routes/leads.js";
import { orderRoutes } from "./routes/orders.js";
import { productRoutes } from "./routes/products.js";
import { customerRoutes } from "./routes/customers.js";
import { channelRoutes } from "./routes/channels.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { vitrinaRoutes } from "./routes/vitrina.js";
import { storefrontRoutes } from "./routes/storefront.js";
import { categoryRoutes } from "./routes/categories.js";
import { uploadRoutes } from "./routes/upload.js";
import { moyskladRoutes } from "./routes/moysklad.js";
import { popupRoutes } from "./routes/popups.js";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.NODE_ENV === "production"
        ? undefined
        : { target: "pino-pretty", options: { translateTime: "HH:MM:ss" } },
  },
});

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET kerak (kamida 32 belgi).");
}

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";
await mkdir(UPLOADS_DIR, { recursive: true });

await app.register(multipart);

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(",") ?? true,
  credentials: true,
});
await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
await app.register(jwt, { secret: JWT_SECRET });
await app.register(prismaPlugin);
await app.register(authPlugin);

app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(tenantRoutes, { prefix: "/api/tenant" });
await app.register(leadRoutes, { prefix: "/api/leads" });
await app.register(orderRoutes, { prefix: "/api/orders" });
await app.register(productRoutes, { prefix: "/api/products" });
await app.register(customerRoutes, { prefix: "/api/customers" });
await app.register(channelRoutes, { prefix: "/api/channels" });
await app.register(categoryRoutes, { prefix: "/api/categories" });
await app.register(dashboardRoutes, { prefix: "/api/dashboard" });
await app.register(webhookRoutes, { prefix: "/api/webhooks" });
await app.register(vitrinaRoutes, { prefix: "/api/vitrina" });
await app.register(storefrontRoutes, { prefix: "/api/storefront" });
await app.register(uploadRoutes, { prefix: "/api/upload" });
await app.register(moyskladRoutes, { prefix: "/api/moysklad" });
await app.register(popupRoutes, { prefix: "/api/popups" });

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

try {
  await app.listen({ port, host });
  app.log.info(`ShopFlow backend ${host}:${port} da ishlamoqda`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
