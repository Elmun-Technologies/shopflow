import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { emit } from "../lib/events.js";

const productCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  stock: z.number().int().min(0).default(0),
  categoryId: z.string().nullable().optional(),
  sku: z.string().optional(),
  images: z.array(z.string().url()).default([]),
  active: z.boolean().default(true),
});

const productUpdateSchema = productCreateSchema.partial();

const categoryCreateSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export default async function productRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  function shopIdOf(req: { user: unknown }): string {
    const u = req.user as { kind?: string; shopId?: string };
    if (u.kind === "miniapp") throw new Error("Admin token kerak");
    if (!u.shopId) throw new Error("shopId yo'q");
    return u.shopId;
  }

  // Categories
  app.get("/categories", async (req) => {
    const sid = shopIdOf(req);
    return await db.query.categories.findMany({
      where: eq(schema.categories.shopId, sid),
      orderBy: [schema.categories.sortOrder],
    });
  });

  app.post("/categories", async (req, reply) => {
    const sid = shopIdOf(req);
    const body = categoryCreateSchema.parse(req.body);
    const [cat] = await db.insert(schema.categories).values({ shopId: sid, ...body }).returning();
    return reply.code(201).send(cat);
  });

  app.patch("/categories/:id", async (req) => {
    const sid = shopIdOf(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = categoryCreateSchema.partial().parse(req.body);
    const [updated] = await db.update(schema.categories)
      .set(body)
      .where(and(eq(schema.categories.id, params.id), eq(schema.categories.shopId, sid)))
      .returning();
    return updated;
  });

  app.delete("/categories/:id", async (req) => {
    const sid = shopIdOf(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    await db.delete(schema.categories).where(and(eq(schema.categories.id, params.id), eq(schema.categories.shopId, sid)));
    return { ok: true };
  });

  // Products
  app.get("/", async (req) => {
    const sid = shopIdOf(req);
    return await db.query.products.findMany({
      where: eq(schema.products.shopId, sid),
    });
  });

  app.get("/:id", async (req, reply) => {
    const sid = shopIdOf(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const p = await db.query.products.findFirst({
      where: and(eq(schema.products.id, params.id), eq(schema.products.shopId, sid)),
    });
    if (!p) return reply.code(404).send({ error: "Mahsulot topilmadi" });
    return p;
  });

  app.post("/", async (req, reply) => {
    const sid = shopIdOf(req);
    const body = productCreateSchema.parse(req.body);
    const [p] = await db.insert(schema.products).values({ shopId: sid, ...body }).returning();
    emit({ type: "product.updated", shopId: sid, productId: p.id });
    return reply.code(201).send(p);
  });

  app.patch("/:id", async (req, reply) => {
    const sid = shopIdOf(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    const body = productUpdateSchema.parse(req.body);
    const [updated] = await db.update(schema.products)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(schema.products.id, params.id), eq(schema.products.shopId, sid)))
      .returning();
    if (!updated) return reply.code(404).send({ error: "Mahsulot topilmadi" });
    emit({ type: "product.updated", shopId: sid, productId: updated.id });
    return updated;
  });

  app.delete("/:id", async (req) => {
    const sid = shopIdOf(req);
    const params = z.object({ id: z.string() }).parse(req.params);
    await db.delete(schema.products).where(and(eq(schema.products.id, params.id), eq(schema.products.shopId, sid)));
    return { ok: true };
  });
}
