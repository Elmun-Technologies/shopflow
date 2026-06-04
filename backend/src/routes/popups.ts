// Popup'larni admin CRUD orqali boshqarish.
// Public list endpoint storefront.ts'da, chunki auth talab qilmaydi.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const popupKindEnum = z.enum(["MODAL", "BANNER", "TOAST"]);
const popupTriggerEnum = z.enum(["ON_OPEN", "AFTER_DELAY", "ON_TAB_CHANGE", "ON_CART_ABANDON"]);

const popupCreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional().nullable(),
  ctaText: z.string().max(60).optional().nullable(),
  ctaUrl: z.string().max(500).optional().nullable(),
  kind: popupKindEnum.default("MODAL"),
  trigger: popupTriggerEnum.default("ON_OPEN"),
  triggerDelaySec: z.number().int().min(0).max(3600).default(0),
  active: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxImpressionsPerUser: z.number().int().min(0).max(1000).default(1),
  cooldownHours: z.number().int().min(0).max(720).default(24),
  priority: z.number().int().default(0),
});

const popupUpdateSchema = popupCreateSchema.partial();

export const popupRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /** GET /api/popups — tenant'ning hamma popup'lari (admin) */
  app.get("/", async (req) => {
    const popups = await app.prisma.popup.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return { popups };
  });

  /** POST /api/popups — yangi popup yaratish */
  app.post("/", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req) => {
    const data = popupCreateSchema.parse(req.body);
    return app.prisma.popup.create({
      data: {
        ...data,
        tenantId: req.session.tenantId,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
  });

  /** PATCH /api/popups/:id */
  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const data = popupUpdateSchema.parse(req.body);
      const existing = await app.prisma.popup.findFirst({
        where: { id: req.params.id, tenantId: req.session.tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "Popup topilmadi" });
      await app.prisma.popup.updateMany({
        where: { id: req.params.id, tenantId: req.session.tenantId },
        data: {
          ...data,
          startsAt: data.startsAt === undefined ? undefined : data.startsAt ? new Date(data.startsAt) : null,
          endsAt: data.endsAt === undefined ? undefined : data.endsAt ? new Date(data.endsAt) : null,
        },
      });
      return app.prisma.popup.findFirstOrThrow({
        where: { id: req.params.id, tenantId: req.session.tenantId },
      });
    },
  );

  /** DELETE /api/popups/:id */
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [app.requireRole("OWNER", "ADMIN") ] },
    async (req, reply) => {
      const existing = await app.prisma.popup.findFirst({
        where: { id: req.params.id, tenantId: req.session.tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "Popup topilmadi" });
      await app.prisma.popup.deleteMany({ where: { id: req.params.id, tenantId: req.session.tenantId } });
      return reply.code(204).send();
    },
  );
};
