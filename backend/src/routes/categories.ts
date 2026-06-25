import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().min(1).max(80),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Faqat lotin harflar, raqamlar va tire"),
  parentId: z.string().optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
});

export const categoryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    return app.prisma.category.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: { name: "asc" },
    });
  });

  app.post(
    "/",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const data = categorySchema.parse(req.body);
      const parentId = data.parentId || null;
      if (parentId) {
        // parentId boshqa tenant kategoriyasi bo'lmasligini tekshiramiz
        const parent = await app.prisma.category.findFirst({
          where: { id: parentId, tenantId: req.session.tenantId },
          select: { id: true },
        });
        if (!parent) return reply.code(400).send({ error: "Noto'g'ri parent kategoriya" });
      }
      return app.prisma.category.create({
        data: {
          ...data,
          parentId,
          imageUrl: data.imageUrl || null,
          tenantId: req.session.tenantId,
        },
      });
    },
  );

  app.patch(
    "/:id",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const data = categorySchema.partial().parse(req.body);
      const c = await app.prisma.category.findFirst({
        where: { id, tenantId: req.session.tenantId },
      });
      if (!c) return reply.code(404).send({ error: "Not found" });
      const parentId = data.parentId || null;
      if (parentId) {
        // parentId boshqa tenant kategoriyasi bo'lmasligini tekshiramiz
        const parent = await app.prisma.category.findFirst({
          where: { id: parentId, tenantId: req.session.tenantId },
          select: { id: true },
        });
        if (!parent) return reply.code(400).send({ error: "Noto'g'ri parent kategoriya" });
      }
      return app.prisma.category.update({
        where: { id },
        data: {
          ...data,
          parentId,
          imageUrl: data.imageUrl === undefined ? undefined : data.imageUrl || null,
        },
      });
    },
  );

  app.delete(
    "/:id",
    { preHandler: [app.requireRole("OWNER", "ADMIN")] },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const c = await app.prisma.category.findFirst({
        where: { id, tenantId: req.session.tenantId },
      });
      if (!c) return reply.code(404).send({ error: "Not found" });
      await app.prisma.category.deleteMany({ where: { id, tenantId: req.session.tenantId } });
      return { ok: true };
    },
  );
};
