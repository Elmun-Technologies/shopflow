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
  app.post("/register", async (req, reply) => {
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

  app.post("/login", async (req, reply) => {
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
};
