import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import argon2 from "argon2";

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
    const token = app.jwt.sign({
      userId: owner.id,
      tenantId: tenant.id,
      role: owner.role,
      email: owner.email,
    });

    return {
      token,
      user: { id: owner.id, email: owner.email, name: owner.name, role: owner.role },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name, currency: tenant.currency },
    };
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
    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) {
      return reply.code(401).send({ error: "Email yoki parol noto'g'ri" });
    }

    const token = app.jwt.sign({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tenant: {
        id: user.tenant.id,
        slug: user.tenant.slug,
        name: user.tenant.name,
        currency: user.tenant.currency,
      },
    };
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
      if (!data.currentPassword) {
        return reply.code(400).send({ error: "Joriy parol kiritilishi shart" });
      }
      const valid = await argon2.verify(user.passwordHash, data.currentPassword);
      if (!valid) return reply.code(401).send({ error: "Joriy parol noto'g'ri" });
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
