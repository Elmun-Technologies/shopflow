// Combo / Add-on boshqaruvi — admin uchun.
// Mahsulotga qo'shimcha mahsulotlar biriktirish: Mini App quick view'da
// "Bularni ham qo'shing" bo'limi ko'rinadi.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const addonSchema = z.object({
  addonProductId: z.string(),
  position: z.number().int().default(0),
  discountPct: z.number().int().min(0).max(100).default(0),
  defaultSelected: z.boolean().default(false),
});

const bulkUpdateSchema = z.object({
  addons: z.array(addonSchema),
});

export const productAddonRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /** GET /api/products/:id/addons — mahsulotning combo qo'shimchalari */
  app.get<{ Params: { id: string } }>("/:id/addons", async (req, reply) => {
    const tenantId = req.session.tenantId;
    const product = await app.prisma.product.findFirst({
      where: { id: req.params.id, tenantId },
      select: { id: true },
    });
    if (!product) return reply.code(404).send({ error: "Mahsulot topilmadi" });

    const addons = await app.prisma.productAddon.findMany({
      where: { tenantId, mainProductId: product.id },
      orderBy: { position: "asc" },
      include: {
        addonProduct: {
          select: { id: true, name: true, sku: true, price: true, imageUrl: true, stock: true, active: true },
        },
      },
    });

    return {
      addons: addons.map((a) => ({
        id: a.id,
        addonProductId: a.addonProductId,
        position: a.position,
        discountPct: a.discountPct,
        defaultSelected: a.defaultSelected,
        product: a.addonProduct,
      })),
    };
  });

  /** PUT /api/products/:id/addons — combo ro'yxatini to'liq almashtirish */
  app.put<{ Params: { id: string } }>(
    "/:id/addons",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const data = bulkUpdateSchema.parse(req.body);
      const tenantId = req.session.tenantId;
      const product = await app.prisma.product.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!product) return reply.code(404).send({ error: "Mahsulot topilmadi" });

      // O'zini biriktirib qo'yishga ruxsat bermaslik
      const filtered = data.addons.filter((a) => a.addonProductId !== product.id);

      // Add-on mahsulotlar haqiqatdan ham shu tenant'ga tegishli ekanini tekshiramiz
      const addonIds = filtered.map((a) => a.addonProductId);
      if (addonIds.length) {
        const valid = await app.prisma.product.findMany({
          where: { id: { in: addonIds }, tenantId },
          select: { id: true },
        });
        const validIds = new Set(valid.map((p) => p.id));
        for (const a of filtered) {
          if (!validIds.has(a.addonProductId)) {
            return reply.code(400).send({ error: `Mahsulot topilmadi: ${a.addonProductId}` });
          }
        }
      }

      return app.prisma.$transaction(async (tx) => {
        await tx.productAddon.deleteMany({
          where: { tenantId, mainProductId: product.id },
        });
        if (filtered.length) {
          await tx.productAddon.createMany({
            data: filtered.map((a, i) => ({
              tenantId,
              mainProductId: product.id,
              addonProductId: a.addonProductId,
              position: a.position ?? i,
              discountPct: a.discountPct,
              defaultSelected: a.defaultSelected,
            })),
          });
        }
        return { ok: true, count: filtered.length };
      });
    },
  );
};
