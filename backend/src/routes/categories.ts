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
    async (req) => {
      const data = categorySchema.parse(req.body);
      return app.prisma.category.create({
        data: {
          ...data,
          parentId: data.parentId || null,
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
      return app.prisma.category.update({
        where: { id },
        data: { ...data, parentId: data.parentId || null },
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
      await app.prisma.category.delete({ where: { id } });
      return { ok: true };
    },
  );
};
