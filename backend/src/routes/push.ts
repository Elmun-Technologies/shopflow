// Push subscription CRUD — admin obunani saqlash/o'chirish, public VAPID
// kalit olish (frontend uchun). Tenant-scoped + user-scoped.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getPublicKey, isPushConfigured, pushToTenantAdmins } from "../lib/web-push.js";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().max(200),
    auth: z.string().max(200),
  }),
});

export const pushRoutes: FastifyPluginAsync = async (app) => {
  // Public key — auth talab qilmaydi (frontend subscribe qilishdan oldin oladi)
  app.get("/public-key", async () => ({
    publicKey: getPublicKey(),
    configured: isPushConfigured(),
  }));

  app.addHook("preHandler", app.authenticate);

  app.post("/subscribe", async (req, reply) => {
    if (!isPushConfigured()) {
      return reply.code(503).send({ error: "Push notifications server'da sozlanmagan" });
    }
    const data = subscribeSchema.parse(req.body);
    const ua = (req.headers["user-agent"] ?? "").slice(0, 200);
    // Upsert — bir foydalanuvchi turli brauzerlardan ulanishi mumkin
    await app.prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId: req.session.userId, endpoint: data.endpoint } },
      create: {
        tenantId: req.session.tenantId,
        userId: req.session.userId,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        authKey: data.keys.auth,
        userAgent: ua,
      },
      update: { p256dh: data.keys.p256dh, authKey: data.keys.auth, userAgent: ua },
    });
    return { ok: true };
  });

  app.post("/unsubscribe", async (req) => {
    const data = z.object({ endpoint: z.string().url() }).parse(req.body);
    await app.prisma.pushSubscription.deleteMany({
      where: { userId: req.session.userId, endpoint: data.endpoint },
    });
    return { ok: true };
  });

  // Test push — admin "Sinab ko'rish" tugmasini bosgansa
  app.post("/test", async (req) => {
    const res = await pushToTenantAdmins(app.prisma, req.session.tenantId, {
      title: "Test bildirishnoma",
      body: "Bu test xabar — push notifikatsiya ishlayapti!",
      url: "/",
    });
    return res;
  });
};
