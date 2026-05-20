// Sale campaign / aksiya boshqaruvi — admin CRUD.
// Public storefront API'da product'ning saleCampaign'i avtomatik include qilinadi.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const badgeColorEnum = z.enum(["RED", "ORANGE", "EMERALD", "PURPLE", "BLUE"]);

const createSchema = z.object({
  name: z.string().min(1).max(120),
  label: z.string().min(1).max(40),
  badgeColor: badgeColorEnum.default("RED"),
  active: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  priority: z.number().int().default(0),
  productIds: z.array(z.string()).optional(),
});

const updateSchema = createSchema.partial();

export const saleCampaignRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /** GET /api/sale-campaigns — tenant'ning hamma aksiyalari */
  app.get("/", async (req) => {
    const campaigns = await app.prisma.saleCampaign.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { products: true } } },
    });
    return {
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        label: c.label,
        badgeColor: c.badgeColor,
        active: c.active,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        priority: c.priority,
        productCount: c._count.products,
        createdAt: c.createdAt,
      })),
    };
  });

  /** GET /api/sale-campaigns/:id — bitta aksiya + qaysi mahsulotlar */
  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const campaign = await app.prisma.saleCampaign.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
      include: {
        products: {
          select: { id: true, name: true, sku: true, price: true, oldPrice: true, imageUrl: true },
        },
      },
    });
    if (!campaign) return reply.code(404).send({ error: "Aksiya topilmadi" });
    return campaign;
  });

  /** POST /api/sale-campaigns — yangi aksiya */
  app.post("/", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req) => {
    const data = createSchema.parse(req.body);
    const tenantId = req.session.tenantId;

    return app.prisma.$transaction(async (tx) => {
      const campaign = await tx.saleCampaign.create({
        data: {
          tenantId,
          name: data.name,
          label: data.label,
          badgeColor: data.badgeColor,
          active: data.active,
          startsAt: data.startsAt ? new Date(data.startsAt) : null,
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
          priority: data.priority,
        },
      });
      if (data.productIds?.length) {
        await tx.product.updateMany({
          where: { id: { in: data.productIds }, tenantId },
          data: { saleCampaignId: campaign.id },
        });
      }
      return campaign;
    });
  });

  /** PATCH /api/sale-campaigns/:id */
  app.patch<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const data = updateSchema.parse(req.body);
      const tenantId = req.session.tenantId;

      const existing = await app.prisma.saleCampaign.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "Aksiya topilmadi" });

      return app.prisma.$transaction(async (tx) => {
        const updated = await tx.saleCampaign.update({
          where: { id: req.params.id },
          data: {
            name: data.name,
            label: data.label,
            badgeColor: data.badgeColor,
            active: data.active,
            priority: data.priority,
            startsAt: data.startsAt === undefined ? undefined : data.startsAt ? new Date(data.startsAt) : null,
            endsAt: data.endsAt === undefined ? undefined : data.endsAt ? new Date(data.endsAt) : null,
          },
        });
        if (data.productIds) {
          // Avval barcha eski mahsulotlardan saleCampaignId ni olib tashlash
          await tx.product.updateMany({
            where: { saleCampaignId: req.params.id, tenantId },
            data: { saleCampaignId: null },
          });
          // Yangilarini biriktirish
          if (data.productIds.length) {
            await tx.product.updateMany({
              where: { id: { in: data.productIds }, tenantId },
              data: { saleCampaignId: req.params.id },
            });
          }
        }
        return updated;
      });
    },
  );

  /** DELETE /api/sale-campaigns/:id */
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [app.requireRole("OWNER", "ADMIN")] },
    async (req, reply) => {
      const existing = await app.prisma.saleCampaign.findFirst({
        where: { id: req.params.id, tenantId: req.session.tenantId },
      });
      if (!existing) return reply.code(404).send({ error: "Aksiya topilmadi" });
      await app.prisma.saleCampaign.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    },
  );
};
