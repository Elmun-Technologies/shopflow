// Vitrina (Storefront) — admin tomonidan boshqariladi.
// Har bir tenant uchun bitta layout. Bloklar drag-drop builder'dan keladi.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const blockSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  enabled: z.boolean(),
  settings: z.record(z.unknown()).default({}),
});

const layoutSchema = z.object({
  blocks: z.array(blockSchema),
  brand: z.record(z.unknown()).optional(),
  published: z.boolean().optional(),
  // "b2b" — savatsiz, lidga yo'naltiruvchi ulgurji rejim (bot `b2b` shabloniga juft).
  storeMode: z.enum(["multi", "single", "b2b"]).optional(),
  singleProductId: z.string().nullable().optional(),
});

export const vitrinaRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // Vitrina layoutini olish (yo'q bo'lsa bo'sh yaratiladi)
  app.get("/layout", async (req) => {
    const tenantId = req.session.tenantId;
    let storefront = await app.prisma.storefront.findUnique({ where: { tenantId } });
    if (!storefront) {
      storefront = await app.prisma.storefront.create({
        data: {
          tenantId,
          blocks: [],
          brand: {},
        },
      });
    }
    return storefront;
  });

  // Vitrina layoutini saqlash
  app.put(
    "/layout",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req) => {
      const data = layoutSchema.parse(req.body);
      const tenantId = req.session.tenantId;

      return app.prisma.storefront.upsert({
        where: { tenantId },
        create: {
          tenantId,
          blocks: data.blocks as unknown as Prisma.InputJsonValue,
          brand: (data.brand ?? {}) as Prisma.InputJsonValue,
          published: data.published ?? true,
          ...(data.storeMode !== undefined && { storeMode: data.storeMode }),
          ...(data.singleProductId !== undefined && {
            singleProductId: data.singleProductId,
          }),
        },
        update: {
          blocks: data.blocks as unknown as Prisma.InputJsonValue,
          ...(data.brand !== undefined && {
            brand: data.brand as Prisma.InputJsonValue,
          }),
          ...(data.published !== undefined && { published: data.published }),
          ...(data.storeMode !== undefined && { storeMode: data.storeMode }),
          ...(data.singleProductId !== undefined && {
            singleProductId: data.singleProductId,
          }),
        },
      });
    },
  );

  // Brand sozlamalarini alohida saqlash
  app.put(
    "/brand",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req) => {
      const brand = z.record(z.unknown()).parse(req.body);
      const tenantId = req.session.tenantId;

      return app.prisma.storefront.upsert({
        where: { tenantId },
        create: {
          tenantId,
          blocks: [],
          brand: brand as Prisma.InputJsonValue,
        },
        update: { brand: brand as Prisma.InputJsonValue },
      });
    },
  );
};
