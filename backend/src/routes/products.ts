import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logAudit } from "../lib/audit.js";

const productSchema = z.object({
  sku: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().nonnegative(),
  oldPrice: z.number().nonnegative().optional().nullable(),
  currency: z.string().default("UZS"),
  stock: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  // Local upload paths ("/uploads/...") yoki absolute URL — har ikkalasi ham qabul
  imageUrl: z.string().max(500).optional().nullable(),
  images: z.array(z.string().max(500)).optional(),
  categoryId: z.string().optional().nullable(),
});

const listQuery = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const q = listQuery.parse(req.query);
    const where = {
      tenantId: req.session.tenantId,
      ...(q.categoryId && { categoryId: q.categoryId }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: "insensitive" as const } },
          { sku: { contains: q.search, mode: "insensitive" as const } },
        ],
      }),
    };
    const [total, items] = await Promise.all([
      app.prisma.product.count({ where }),
      app.prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, items };
  });

  app.post("/", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req) => {
    const data = productSchema.parse(req.body);
    const created = await app.prisma.product.create({
      data: {
        ...data,
        imageUrl: data.imageUrl || null,
        oldPrice: data.oldPrice ?? null,
        categoryId: data.categoryId || null,
        tenantId: req.session.tenantId,
      },
    });
    const actor = await app.prisma.user.findUnique({ where: { id: req.session.userId }, select: { name: true } });
    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "CREATE",
      resourceType: "product",
      resourceId: created.id,
      summary: `Mahsulot yaratildi: ${created.name}`,
    });
    return created;
  });

  app.patch("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = productSchema.partial().parse(req.body);
    const product = await app.prisma.product.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!product) return reply.code(404).send({ error: "Not found" });
    const updated = await app.prisma.product.update({
      where: { id },
      data: {
        ...data,
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl || null }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId || null }),
      },
    });
    const actor = await app.prisma.user.findUnique({ where: { id: req.session.userId }, select: { name: true } });
    const changedKeys = (Object.keys(data) as Array<keyof typeof data>).filter((k) => data[k] !== undefined);
    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "UPDATE",
      resourceType: "product",
      resourceId: id,
      summary: `Tahrirlandi: ${changedKeys.length ? changedKeys.join(", ") : "—"}`,
    });
    return updated;
  });

  // Bulk operations — admin tomondan ko'p mahsulotni bir vaqtda boshqarish
  // Hozir qo'llab-quvvatlangan: delete | setCategory | toggleActive | toggleFeatured
  const bulkSchema = z.object({
    ids: z.array(z.string()).min(1).max(500),
    action: z.enum(["delete", "setCategory", "setActive", "setFeatured"]),
    categoryId: z.string().nullable().optional(),
    value: z.boolean().optional(),
  });
  app.post(
    "/bulk",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const data = bulkSchema.parse(req.body);
      // tenant scope tekshiruvi — boshqa tenant mahsulotlariga ta'sir qilmaslik
      const owned = await app.prisma.product.findMany({
        where: { id: { in: data.ids }, tenantId: req.session.tenantId },
        select: { id: true, name: true },
      });
      const ownedIds = owned.map((p) => p.id);
      if (ownedIds.length === 0) return { affected: 0 };

      const actor = await app.prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { name: true },
      });

      let affected = 0;
      let summary = "";

      if (data.action === "delete") {
        const res = await app.prisma.product.deleteMany({
          where: { id: { in: ownedIds }, tenantId: req.session.tenantId },
        });
        affected = res.count;
        summary = `${affected} ta mahsulot o'chirildi`;
      } else if (data.action === "setCategory") {
        const res = await app.prisma.product.updateMany({
          where: { id: { in: ownedIds }, tenantId: req.session.tenantId },
          data: { categoryId: data.categoryId || null },
        });
        affected = res.count;
        const catName = data.categoryId
          ? (await app.prisma.category.findUnique({ where: { id: data.categoryId }, select: { name: true } }))?.name ?? "?"
          : "Kategoriyasiz";
        summary = `${affected} ta mahsulot kategoriyasi → ${catName}`;
      } else if (data.action === "setActive") {
        const res = await app.prisma.product.updateMany({
          where: { id: { in: ownedIds }, tenantId: req.session.tenantId },
          data: { active: data.value ?? false },
        });
        affected = res.count;
        summary = `${affected} ta mahsulot ${data.value ? "yoqildi" : "o'chirildi (active)"}`;
      } else if (data.action === "setFeatured") {
        const res = await app.prisma.product.updateMany({
          where: { id: { in: ownedIds }, tenantId: req.session.tenantId },
          data: { featured: data.value ?? false },
        });
        affected = res.count;
        summary = `${affected} ta mahsulot ${data.value ? "Vitrina'ga" : "Vitrina'dan"} qo'yildi/olindi`;
      }

      // Audit yozuvi — bitta umumiy bulk yozuv (har bir mahsulot uchun emas, log spam'ga aylanmasin)
      await logAudit({
        prisma: app.prisma,
        tenantId: req.session.tenantId,
        actorId: req.session.userId,
        actorName: actor?.name ?? null,
        action: "BULK_" + data.action.toUpperCase(),
        resourceType: "product",
        resourceId: ownedIds[0],
        summary,
        changes: { ids: ownedIds, action: data.action, value: data.value, categoryId: data.categoryId },
      });

      return reply.send({ affected, summary });
    },
  );

  app.delete("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const product = await app.prisma.product.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!product) return reply.code(404).send({ error: "Not found" });
    await app.prisma.product.delete({ where: { id } });
    const actor = await app.prisma.user.findUnique({ where: { id: req.session.userId }, select: { name: true } });
    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "DELETE",
      resourceType: "product",
      resourceId: id,
      summary: `Mahsulot o'chirildi: ${product.name}`,
    });
    return { ok: true };
  });
};
