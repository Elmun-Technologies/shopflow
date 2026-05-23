import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { mkdir } from "node:fs/promises";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
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
import { saleCampaignRoutes } from "./routes/sale-campaigns.js";
import { abandonedCartsRoutes } from "./routes/abandoned-carts.js";
import { productAddonRoutes } from "./routes/product-addons.js";
import { auditRoutes } from "./routes/audit.js";
import { paymentRoutes } from "./routes/payments.js";
import { chatRoutes } from "./routes/chat.js";
import { segmentRoutes } from "./routes/segments.js";
import { reviewRoutes } from "./routes/reviews.js";
import { startCartAbandonmentScheduler } from "./lib/cart-abandonment.js";

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

const corsOrigin = process.env.CORS_ORIGIN?.split(",");
if (!corsOrigin && process.env.NODE_ENV === "production") {
  app.log.warn("CORS_ORIGIN o'rnatilmagan — barcha originlarga ruxsat berilmoqda. Production uchun xavfli!");
}
await app.register(cors, {
  origin: corsOrigin ?? true,
  credentials: true,
});

await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
await app.register(jwt, { secret: JWT_SECRET });
await app.register(prismaPlugin);
await app.register(authPlugin);

// Global error handler — Zod va Prisma xatolarini 400/409/500 ga moslashtirish
app.setErrorHandler((err, req, reply) => {
  if (err instanceof ZodError) {
    return reply.code(400).send({
      error: "Validation error",
      details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
    });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return reply.code(409).send({ error: "Bu ma'lumot allaqachon mavjud" });
    }
    if (err.code === "P2025") {
      return reply.code(404).send({ error: "Yozuv topilmadi" });
    }
    app.log.error({ err, url: req.url }, "Prisma error");
    return reply.code(500).send({ error: "Ma'lumotlar bazasi xatosi" });
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    app.log.warn({ err, url: req.url }, "Prisma validation error");
    return reply.code(400).send({ error: "Noto'g'ri so'rov ma'lumotlari" });
  }
  const httpErr = err as { statusCode?: number; message?: string };
  // Fastify rate limit xatosi
  if (httpErr.statusCode === 429) {
    return reply.code(429).send({ error: "Juda ko'p so'rov. Biroz kutib turing." });
  }
  app.log.error({ err, url: req.url, method: req.method }, "Unhandled error");
  return reply.code(httpErr.statusCode ?? 500).send({ error: httpErr.message ?? "Server xatosi" });
});

app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));
// /api/health — Caddy /api/* ni backend'ga proxy qiladi, shu yo'l ham ishlashi uchun
app.get("/api/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

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
await app.register(saleCampaignRoutes, { prefix: "/api/sale-campaigns" });
await app.register(abandonedCartsRoutes, { prefix: "/api/abandoned-carts" });
// Combo / product addons — mahsulotga qo'shimcha tovarlar (Amazon-style)
await app.register(productAddonRoutes, { prefix: "/api/products" });
await app.register(auditRoutes, { prefix: "/api/audit" });
await app.register(paymentRoutes, { prefix: "/api/payments" });
await app.register(chatRoutes, { prefix: "/api/chats" });
await app.register(segmentRoutes, { prefix: "/api/segments" });
await app.register(reviewRoutes, { prefix: "/api/reviews" });

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

// Cart abandonment scheduler — 1 soatdan ortiq tinch turgan savatlarga
// Telegram orqali "savatingiz kutmoqda" eslatma yuboradi. Har 5 daqiqada skanlaydi.
// addHook listen'dan oldin ro'yxatdan o'tishi shart (Fastify cheklovi).
const stopScheduler = startCartAbandonmentScheduler(app.prisma, (msg, ...rest) => app.log.info({ rest }, msg));
app.addHook("onClose", async () => {
  stopScheduler();
});

try {
  await app.listen({ port, host });
  app.log.info(`ShopFlow backend ${host}:${port} da ishlamoqda`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
