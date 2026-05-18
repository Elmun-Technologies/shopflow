import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const channelTypeEnum = z.enum([
  "WEBSITE",
  "LANDING_PAGE",
  "INSTAGRAM",
  "TELEGRAM",
  "FACEBOOK",
  "WHATSAPP",
  "EMAIL",
  "PHONE",
  "REFERRAL",
  "GOOGLE_ADS",
  "YANDEX_DIRECT",
  "MARKETPLACE",
  "OFFLINE",
]);

const channelSchema = z.object({
  type: channelTypeEnum,
  name: z.string().min(1).max(80),
  config: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
});

export const channelRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    return app.prisma.channel.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: { createdAt: "asc" },
    });
  });

  app.post("/", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req) => {
    const data = channelSchema.parse(req.body);
    return app.prisma.channel.create({
      data: {
        type: data.type,
        name: data.name,
        active: data.active,
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        tenantId: req.session.tenantId,
      },
    });
  });

  app.patch("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = channelSchema.partial().parse(req.body);
    const ch = await app.prisma.channel.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!ch) return reply.code(404).send({ error: "Not found" });
    return app.prisma.channel.update({
      where: { id },
      data: {
        type: data.type,
        name: data.name,
        active: data.active,
        ...(data.config !== undefined && { config: data.config as Prisma.InputJsonValue }),
      },
    });
  });

  app.delete("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const ch = await app.prisma.channel.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!ch) return reply.code(404).send({ error: "Not found" });
    await app.prisma.channel.delete({ where: { id } });
    return { ok: true };
  });
};
