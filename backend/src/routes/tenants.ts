import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  currency: z.string().min(3).max(8).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

export const tenantRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    return app.prisma.tenant.findUnique({ where: { id: req.session.tenantId } });
  });

  app.patch("/", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req) => {
    const data = updateSchema.parse(req.body);
    return app.prisma.tenant.update({
      where: { id: req.session.tenantId },
      data,
    });
  });

  app.get("/users", async (req) => {
    return app.prisma.user.findMany({
      where: { tenantId: req.session.tenantId },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  });
};
