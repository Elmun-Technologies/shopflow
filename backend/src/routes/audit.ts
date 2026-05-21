// Audit log o'qish endpoint'lari.
// Asosan resource timeline ko'rsatish uchun (masalan OrderDetailDrawer'da).

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const listQuerySchema = z.object({
  resourceType: z.string(),
  resourceId: z.string(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const auditRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // GET /api/audit?resourceType=order&resourceId=...
  app.get("/", async (req) => {
    const q = listQuerySchema.parse(req.query);
    const items = await app.prisma.auditLog.findMany({
      where: {
        tenantId: req.session.tenantId,
        resourceType: q.resourceType,
        resourceId: q.resourceId,
      },
      orderBy: { createdAt: "desc" },
      take: q.limit,
    });
    return { items };
  });
};
