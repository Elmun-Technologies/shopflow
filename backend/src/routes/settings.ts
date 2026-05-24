// Settings routes — sozlamalar, API keys, bildirishnomalar
// GET/PATCH /api/settings/notifications
// GET/POST/DELETE /api/settings/api-keys

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";

function generateApiKey(): { key: string; prefix: string; hash: string } {
  const raw = `sf_${randomBytes(28).toString("hex")}`;
  const prefix = raw.slice(0, 10);
  const hash = createHash("sha256").update(raw).digest("hex");
  return { key: raw, prefix, hash };
}

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // ─── Bildirishnoma sozlamalari ────────────────────────────────────────────
  app.get("/notifications", async (req) => {
    const tenantId = req.session.tenantId;
    const settings = await app.prisma.tenantNotifSettings.findUnique({
      where: { tenantId },
    });
    // Agar yo'q bo'lsa default qaytaramiz
    return settings ?? {
      tenantId,
      notifyOrdersGroupId: null,
      notifyOrdersEnabled: true,
      notifyLeadsEnabled: true,
      notifyReviewsEnabled: true,
      notifyAbandonedEnabled: true,
      emailNotificationsEnabled: false,
      emailRecipients: [],
    };
  });

  app.patch("/notifications", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req) => {
    const data = z.object({
      notifyOrdersGroupId: z.string().max(40).optional().nullable(),
      notifyOrdersEnabled: z.boolean().optional(),
      notifyLeadsEnabled: z.boolean().optional(),
      notifyReviewsEnabled: z.boolean().optional(),
      notifyAbandonedEnabled: z.boolean().optional(),
      emailNotificationsEnabled: z.boolean().optional(),
      emailRecipients: z.array(z.string().email()).max(10).optional(),
    }).parse(req.body);

    const tenantId = req.session.tenantId;
    return app.prisma.tenantNotifSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data, updatedAt: new Date() },
      update: { ...data, updatedAt: new Date() },
    });
  });

  // ─── API Keys ─────────────────────────────────────────────────────────────
  app.get("/api-keys", async (req) => {
    const keys = await app.prisma.apiKey.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, prefix: true, scopes: true,
        lastUsedAt: true, expiresAt: true, active: true, createdAt: true,
        // keyHash ni hech qachon frontend'ga bermaylik
      },
    });
    return keys;
  });

  app.post("/api-keys", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = z.object({
      name: z.string().min(1).max(60),
      scopes: z.array(z.string()).default([]),
      expiresAt: z.string().datetime().optional().nullable(),
    }).parse(req.body);

    const { key, prefix, hash } = generateApiKey();

    const created = await app.prisma.apiKey.create({
      data: {
        tenantId: req.session.tenantId,
        name: data.name,
        keyHash: hash,
        prefix,
        scopes: data.scopes,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });

    // Kalit FAQAT BIR MARTA qaytariladi — saqlash uchun
    return reply.code(201).send({
      id: created.id,
      name: created.name,
      prefix,
      scopes: created.scopes,
      createdAt: created.createdAt,
      key, // To'liq kalit — faqat shu yerda, keyingi so'rovlarda yo'q
    });
  });

  app.patch<{ Params: { id: string } }>("/api-keys/:id", {
    preHandler: [app.requireRole("OWNER", "ADMIN")],
  }, async (req, reply) => {
    const data = z.object({
      name: z.string().min(1).max(60).optional(),
      active: z.boolean().optional(),
    }).parse(req.body);

    const existing = await app.prisma.apiKey.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Topilmadi" });

    const updated = await app.prisma.apiKey.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, prefix: true, scopes: true, active: true, expiresAt: true },
    });
    return updated;
  });

  app.delete<{ Params: { id: string } }>("/api-keys/:id", {
    preHandler: [app.requireRole("OWNER", "ADMIN")],
  }, async (req, reply) => {
    const existing = await app.prisma.apiKey.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Topilmadi" });
    await app.prisma.apiKey.delete({ where: { id: req.params.id } });
    return { ok: true };
  });

  // ─── Tenant profil (kengaytirilgan) ──────────────────────────────────────
  app.get("/profile", async (req) => {
    const tenant = await app.prisma.tenant.findUnique({
      where: { id: req.session.tenantId },
      select: { id: true, name: true, slug: true, currency: true, timezone: true, locale: true },
    });
    return tenant;
  });

  app.patch("/profile", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req) => {
    const data = z.object({
      name: z.string().min(1).max(80).optional(),
      currency: z.enum(["UZS", "USD", "EUR", "RUB"]).optional(),
      timezone: z.string().max(50).optional(),
      locale: z.enum(["uz", "ru", "en"]).optional(),
    }).parse(req.body);

    return app.prisma.tenant.update({
      where: { id: req.session.tenantId },
      data,
      select: { id: true, name: true, slug: true, currency: true, timezone: true, locale: true },
    });
  });

  // ─── Foydalanuvchilar boshqaruvi ─────────────────────────────────────────
  app.get("/users", async (req) => {
    return app.prisma.user.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });
  });

  app.patch<{ Params: { userId: string } }>("/users/:userId", {
    preHandler: [app.requireRole("OWNER", "ADMIN")],
  }, async (req, reply) => {
    const data = z.object({
      name: z.string().min(1).max(80).optional(),
      role: z.enum(["ADMIN", "MANAGER", "AGENT"]).optional(), // OWNER o'zgartirib bo'lmaydi
      active: z.boolean().optional(),
    }).parse(req.body);

    const user = await app.prisma.user.findFirst({
      where: { id: req.params.userId, tenantId: req.session.tenantId },
    });
    if (!user) return reply.code(404).send({ error: "Foydalanuvchi topilmadi" });
    if (user.role === "OWNER") return reply.code(403).send({ error: "OWNER rolini o'zgartirib bo'lmaydi" });

    return app.prisma.user.update({
      where: { id: req.params.userId },
      data,
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  });
};
