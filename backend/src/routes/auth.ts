import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import type { UserRole } from "@prisma/client";

const REFRESH_TOKEN_TTL_DAYS = 30;
const ACCESS_TOKEN_TTL = "15m"; // 15 daqiqa

function generateRefreshToken() {
  const raw = randomBytes(40).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

// Google OAuth — ID-token tekshirish uchun. GOOGLE_CLIENT_ID .env'dan (prod'da majburiy).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Google sign-up'da nom/email'dan band bo'lmagan tenant slug generatsiya qiladi
async function uniqueTenantSlug(
  prisma: { tenant: { findUnique: (args: { where: { slug: string } }) => Promise<unknown> } },
  base: string,
): Promise<string> {
  const root = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "store";
  let candidate = root;
  for (let i = 0; i < 50; i++) {
    const exists = await prisma.tenant.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    candidate = `${root}-${randomBytes(2).toString("hex")}`;
  }
  return `${root}-${randomBytes(4).toString("hex")}`;
}

const googleSchema = z.object({
  idToken: z.string().min(10),
  tenantSlug: z.string().optional(),
});

const registerSchema = z.object({
  tenantName: z.string().min(2).max(80),
  tenantSlug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(80),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
  tenantSlug: z.string().optional(),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Register — yangi tenant + owner user yaratish
  app.post("/register", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const data = registerSchema.parse(req.body);

    const existingTenant = await app.prisma.tenant.findUnique({ where: { slug: data.tenantSlug } });
    if (existingTenant) {
      return reply.code(409).send({ error: "Bu tenant slug band" });
    }

    const passwordHash = await argon2.hash(data.password);
    const tenant = await app.prisma.tenant.create({
      data: {
        slug: data.tenantSlug,
        name: data.tenantName,
        users: {
          create: {
            email: data.email,
            passwordHash,
            name: data.name,
            role: "OWNER",
          },
        },
      },
      include: { users: true },
    });

    const owner = tenant.users[0];
    const accessToken = app.jwt.sign(
      { userId: owner.id, tenantId: tenant.id, role: owner.role, email: owner.email },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const { raw: refreshRaw, hash: refreshHash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await app.prisma.refreshToken.create({
      data: { userId: owner.id, tokenHash: refreshHash, expiresAt, userAgent: (req.headers["user-agent"] as string) ?? null },
    });

    return reply.code(201).send({
      token: accessToken,
      refreshToken: refreshRaw,
      expiresIn: 15 * 60,
      user: { id: owner.id, email: owner.email, name: owner.name, role: owner.role },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, currency: tenant.currency, deliveryPct: tenant.deliveryPct, servicePct: tenant.servicePct },
    });
  });

  // Google sign-in / sign-up — frontend imzolangan Google ID-token yuboradi.
  // Email mavjud → sign in (googleId bog'lanadi); mavjud emas → yangi tenant + owner (sign up).
  app.post("/google", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const data = googleSchema.parse(req.body);
    if (!GOOGLE_CLIENT_ID) {
      return reply.code(503).send({ error: "Google kirish sozlanmagan (GOOGLE_CLIENT_ID yo'q)" });
    }

    // ID-token tekshirish — imzo (Google JWKS) + audience + issuer + muddat
    const payload = await googleClient
      .verifyIdToken({ idToken: data.idToken, audience: GOOGLE_CLIENT_ID })
      .then((t) => t.getPayload())
      .catch(() => null);
    if (!payload?.email || !payload.email_verified || !payload.sub) {
      return reply.code(401).send({ error: "Google token yaroqsiz yoki email tasdiqlanmagan" });
    }
    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const displayName = payload.name ?? email.split("@")[0];

    // Mavjud user(lar) — login bilan bir xil mantiq (bir email bir nechta tenantda bo'lishi mumkin)
    const users = await app.prisma.user.findMany({
      where: { email, active: true, ...(data.tenantSlug ? { tenant: { slug: data.tenantSlug } } : {}) },
      include: { tenant: true },
    });
    if (users.length > 1 && !data.tenantSlug) {
      return reply.code(409).send({
        error: "Bir nechta tenant topildi",
        tenants: users.map((u) => ({ slug: u.tenant.slug, name: u.tenant.name })),
      });
    }

    let userId: string;
    let userRole: UserRole;
    let userEmail: string;
    let userName: string;
    let tenant: { id: string; slug: string; name: string; currency: string; deliveryPct: number; servicePct: number };
    let created = false;

    if (users.length >= 1) {
      // SIGN IN — mavjud hisob; googleId'ni bog'laymiz (hali bog'lanmagan bo'lsa)
      const u = users[0];
      if (u.googleId !== googleId) {
        await app.prisma.user.update({ where: { id: u.id }, data: { googleId } }).catch(() => null);
      }
      userId = u.id; userRole = u.role; userEmail = u.email; userName = u.name;
      tenant = u.tenant;
    } else {
      // SIGN UP — yangi tenant + owner (parolsiz, googleId bilan). Nomni keyin Sozlamalarda o'zgartiradi.
      const slug = await uniqueTenantSlug(app.prisma, displayName);
      const t = await app.prisma.tenant.create({
        data: { slug, name: displayName, users: { create: { email, name: displayName, role: "OWNER", googleId } } },
        include: { users: true },
      });
      const owner = t.users[0];
      userId = owner.id; userRole = owner.role; userEmail = owner.email; userName = owner.name;
      tenant = t;
      created = true;
    }

    const accessToken = app.jwt.sign(
      { userId, tenantId: tenant.id, role: userRole, email: userEmail },
      { expiresIn: ACCESS_TOKEN_TTL },
    );
    const { raw: refreshRaw, hash: refreshHash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await app.prisma.refreshToken.create({
      data: { userId, tokenHash: refreshHash, expiresAt, userAgent: (req.headers["user-agent"] as string) ?? null },
    });

    return reply.code(created ? 201 : 200).send({
      token: accessToken,
      refreshToken: refreshRaw,
      expiresIn: 15 * 60,
      user: { id: userId, email: userEmail, name: userName, role: userRole },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, currency: tenant.currency, deliveryPct: tenant.deliveryPct, servicePct: tenant.servicePct },
    });
  });

  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (req, reply) => {
    const data = loginSchema.parse(req.body);

    const users = await app.prisma.user.findMany({
      where: {
        email: data.email,
        active: true,
        ...(data.tenantSlug ? { tenant: { slug: data.tenantSlug } } : {}),
      },
      include: { tenant: true },
    });

    if (users.length === 0) {
      return reply.code(401).send({ error: "Email yoki parol noto'g'ri" });
    }
    if (users.length > 1 && !data.tenantSlug) {
      return reply.code(409).send({
        error: "Bir nechta tenant topildi",
        tenants: users.map((u) => ({ slug: u.tenant.slug, name: u.tenant.name })),
      });
    }

    const user = users[0];
    if (!user.passwordHash) {
      return reply.code(401).send({ error: "Bu hisob Google orqali kiradi — Google bilan kiring" });
    }
    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) {
      return reply.code(401).send({ error: "Email yoki parol noto'g'ri" });
    }

    const accessToken = app.jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const { raw: refreshRaw, hash: refreshHash } = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await app.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshHash,
        expiresAt,
        userAgent: (req.headers["user-agent"] as string) ?? null,
        ipAddress: req.ip ?? null,
      },
    });

    return {
      token: accessToken,
      refreshToken: refreshRaw,
      expiresIn: 15 * 60,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenant: {
        id: user.tenant.id,
        slug: user.tenant.slug,
        name: user.tenant.name,
        currency: user.tenant.currency,
        deliveryPct: user.tenant.deliveryPct,
        servicePct: user.tenant.servicePct,
      },
    };
  });

  // Refresh token — yangi access token olish
  app.post("/refresh", { config: { rateLimit: { max: 30, timeWindow: "5 minutes" } } }, async (req, reply) => {
    const { refreshToken: raw } = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    const hash = createHash("sha256").update(raw).digest("hex");

    const stored = await app.prisma.refreshToken.findUnique({
      where: { tokenHash: hash },
      include: { user: { include: { tenant: true } } },
    });

    if (!stored) return reply.code(401).send({ error: "Noto'g'ri yoki eskirgan refresh token" });
    if (stored.revokedAt) return reply.code(401).send({ error: "Token bekor qilingan" });
    if (stored.expiresAt < new Date()) return reply.code(401).send({ error: "Refresh token muddati tugagan" });
    if (!stored.user.active) return reply.code(401).send({ error: "Foydalanuvchi nofaol" });

    // Eski tokenni yangilash (lastUsedAt)
    await app.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { lastUsedAt: new Date() },
    });

    const newAccess = app.jwt.sign(
      { userId: stored.userId, tenantId: stored.user.tenantId, role: stored.user.role, email: stored.user.email },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    return {
      token: newAccess,
      expiresIn: 15 * 60,
    };
  });

  // Logout — refresh tokenni bekor qilish
  app.post("/logout", async (req, reply) => {
    const body = z.object({ refreshToken: z.string().optional() }).safeParse(req.body);
    if (body.success && body.data.refreshToken) {
      const hash = createHash("sha256").update(body.data.refreshToken).digest("hex");
      await app.prisma.refreshToken.updateMany({
        where: { tokenHash: hash },
        data: { revokedAt: new Date() },
      }).catch(() => null);
    }
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (req) => {
    const user = await app.prisma.user.findUnique({
      where: { id: req.session.userId },
      include: { tenant: true },
    });
    if (!user) return { user: null };
    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenant: {
        id: user.tenant.id,
        slug: user.tenant.slug,
        name: user.tenant.name,
        currency: user.tenant.currency,
        deliveryPct: user.tenant.deliveryPct,
        servicePct: user.tenant.servicePct,
      },
    };
  });

  // O'z profilingizni yangilash (ism, email, parol)
  const meUpdateSchema = z.object({
    name: z.string().min(1).max(80).optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8).max(200).optional(),
  });
  app.patch("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    const data = meUpdateSchema.parse(req.body);
    const user = await app.prisma.user.findUnique({
      where: { id: req.session.userId },
    });
    if (!user) return reply.code(404).send({ error: "Foydalanuvchi topilmadi" });

    // Parol o'zgartirish — joriy parolni tekshiramiz
    let passwordHash: string | undefined;
    if (data.newPassword) {
      if (user.passwordHash) {
        // Mavjud parol bor — joriy parolni tekshiramiz
        if (!data.currentPassword) {
          return reply.code(400).send({ error: "Joriy parol kiritilishi shart" });
        }
        const valid = await argon2.verify(user.passwordHash, data.currentPassword);
        if (!valid) return reply.code(401).send({ error: "Joriy parol noto'g'ri" });
      }
      // Google-only hisob (parol yo'q) — joriy parolsiz yangi parol o'rnatishi mumkin
      passwordHash = await argon2.hash(data.newPassword);
    }

    // Email noyobligi tenant ichida tekshirish
    if (data.email && data.email !== user.email) {
      const dup = await app.prisma.user.findFirst({
        where: { tenantId: user.tenantId, email: data.email, id: { not: user.id } },
        select: { id: true },
      });
      if (dup) return reply.code(409).send({ error: "Bu email allaqachon ishlatilgan" });
    }

    const updated = await app.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(passwordHash && { passwordHash }),
      },
      include: { tenant: true },
    });

    return {
      user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role },
      tenant: {
        id: updated.tenant.id,
        slug: updated.tenant.slug,
        name: updated.tenant.name,
        currency: updated.tenant.currency,
      },
    };
  });
};
