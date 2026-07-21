// Settings routes — sozlamalar, API keys, bildirishnomalar
// GET/PATCH /api/settings/notifications
// GET/POST/DELETE /api/settings/api-keys

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { randomInt } from "node:crypto";
import { generateApiKey } from "../lib/api-key.js";

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // ─── Bildirishnoma sozlamalari ────────────────────────────────────────────
  app.get("/notifications", async (req) => {
    const tenantId = req.session.tenantId;
    const settings = await app.prisma.tenantNotifSettings.findUnique({
      where: { tenantId },
    });
    const base = settings ?? {
      tenantId,
      notifyOrdersGroupId: null,
      notifyOrdersEnabled: true,
      notifyLeadsEnabled: true,
      notifyReviewsEnabled: true,
      notifyAbandonedEnabled: true,
      emailNotificationsEnabled: false,
      emailRecipients: [],
      adminTelegramChatId: null,
    };
    // BigInt JSON'ga aylanmaydi — string sifatida qaytaramiz
    return {
      ...base,
      adminTelegramChatId: base.adminTelegramChatId != null ? String(base.adminTelegramChatId) : null,
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
      reportFrequency: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
      adminTelegramChatId: z.string().regex(/^-?\d+$/).optional().nullable(),
    }).parse(req.body);

    // BigInt konvertatsiya
    const { adminTelegramChatId: rawChatId, ...rest } = data;
    const adminTelegramChatId = rawChatId != null ? BigInt(rawChatId) : rawChatId;

    const tenantId = req.session.tenantId;
    return app.prisma.tenantNotifSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...rest, adminTelegramChatId, updatedAt: new Date() },
      update: { ...rest, adminTelegramChatId, updatedAt: new Date() },
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
    await app.prisma.apiKey.deleteMany({ where: { id: req.params.id, tenantId: req.session.tenantId } });
    return { ok: true };
  });

  // ─── Tenant profil (kengaytirilgan) ──────────────────────────────────────
  app.get("/profile", async (req) => {
    const tenant = await app.prisma.tenant.findUnique({
      where: { id: req.session.tenantId },
      select: { id: true, name: true, slug: true, currency: true, timezone: true, locale: true, deliveryPct: true, servicePct: true },
    });
    return tenant;
  });

  app.patch("/profile", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req) => {
    const data = z.object({
      name: z.string().min(1).max(80).optional(),
      currency: z.enum(["UZS", "USD", "EUR", "RUB"]).optional(),
      timezone: z.string().max(50).optional(),
      locale: z.enum(["uz", "ru", "en"]).optional(),
      // Narxlash breakdown foizlari (management ko'rinishi)
      deliveryPct: z.number().min(0).max(100).optional(),
      servicePct: z.number().min(0).max(100).optional(),
    }).parse(req.body);

    return app.prisma.tenant.update({
      where: { id: req.session.tenantId },
      data,
      select: { id: true, name: true, slug: true, currency: true, timezone: true, locale: true, deliveryPct: true, servicePct: true },
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

  // POST /settings/users — yangi xodimni taklif qilish.
  // Hozircha SMTP yo'q — random parol generatsiya qilinadi va response'da qaytariladi.
  // Admin parolni xodimga o'zi qo'lda yuboradi (Telegram, hisobga olinadigan kanal).
  app.post("/users", {
    preHandler: [app.requireRole("OWNER", "ADMIN")],
  }, async (req, reply) => {
    const data = z.object({
      email: z.string().email(),
      name: z.string().min(1).max(80),
      role: z.enum(["ADMIN", "MANAGER", "AGENT"]),
    }).parse(req.body);

    // Email tenant ichida unique
    const existing = await app.prisma.user.findFirst({
      where: { email: data.email.toLowerCase(), tenantId: req.session.tenantId },
      select: { id: true },
    });
    if (existing) return reply.code(409).send({ error: "Bu email allaqachon ro'yxatda" });

    // 12 belgili o'qiladigan parol — ambiguous belgilarsiz (0/O/1/l).
    // MUHIM: bu login credential (SMTP hali ulanmagan) — kriptografik CSPRNG
    // (crypto.randomInt) ishlatiladi, Math.random() EMAS (bashorat qilinadigan).
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const tempPassword = Array.from({ length: 12 }, () =>
      alphabet[randomInt(alphabet.length)],
    ).join("");
    const passwordHash = await argon2.hash(tempPassword);

    const user = await app.prisma.user.create({
      data: {
        tenantId: req.session.tenantId,
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash,
        role: data.role,
        active: true,
      },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
    });

    // Response'da tempPassword — admin xodimga yuboradi. Bir martalik.
    return reply.code(201).send({ user, tempPassword });
  });

  // DELETE /settings/users/:userId — xodimni o'chirish.
  // OWNER o'zini ham, boshqa OWNER ni ham o'chira olmaydi.
  app.delete<{ Params: { userId: string } }>("/users/:userId", {
    preHandler: [app.requireRole("OWNER", "ADMIN")],
  }, async (req, reply) => {
    const target = await app.prisma.user.findFirst({
      where: { id: req.params.userId, tenantId: req.session.tenantId },
    });
    if (!target) return reply.code(404).send({ error: "Foydalanuvchi topilmadi" });
    if (target.id === req.session.userId) {
      return reply.code(400).send({ error: "O'zingizni o'chira olmaysiz" });
    }
    if (target.role === "OWNER") {
      return reply.code(403).send({ error: "OWNER rolini o'chirib bo'lmaydi" });
    }

    await app.prisma.user.deleteMany({ where: { id: req.params.userId, tenantId: req.session.tenantId } });
    return { ok: true };
  });
};
