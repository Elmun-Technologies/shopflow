import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

/**
 * Generic shop settings (key/value JSON).
 * Marketing pagelar shu yerda saqlaydi: rassilka.email_campaigns,
 * promo.codes, sovgalar.promotions va h.k.
 */
export default async function settingsRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  function shopIdOf(req: { user: unknown }): string {
    const u = req.user as { kind?: string; shopId?: string };
    if (u.kind === "miniapp") throw new Error("Admin token kerak");
    if (!u.shopId) throw new Error("shopId yo'q");
    return u.shopId;
  }

  app.get("/", async (req) => {
    const sid = shopIdOf(req);
    const rows = await db.query.shopSettings.findMany({ where: eq(schema.shopSettings.shopId, sid) });
    const result: Record<string, unknown> = {};
    for (const r of rows) result[r.key] = r.value;
    return result;
  });

  app.get("/:key", async (req, reply) => {
    const sid = shopIdOf(req);
    const params = z.object({ key: z.string().min(1).max(128) }).parse(req.params);
    const row = await db.query.shopSettings.findFirst({
      where: and(eq(schema.shopSettings.shopId, sid), eq(schema.shopSettings.key, params.key)),
    });
    if (!row) return reply.code(404).send({ error: "Topilmadi" });
    return { key: row.key, value: row.value, updatedAt: row.updatedAt };
  });

  app.put("/:key", async (req) => {
    const sid = shopIdOf(req);
    const params = z.object({ key: z.string().min(1).max(128) }).parse(req.params);
    const body = z.object({ value: z.unknown() }).parse(req.body);

    const existing = await db.query.shopSettings.findFirst({
      where: and(eq(schema.shopSettings.shopId, sid), eq(schema.shopSettings.key, params.key)),
    });
    if (existing) {
      await db.update(schema.shopSettings).set({ value: body.value as never, updatedAt: new Date() }).where(eq(schema.shopSettings.id, existing.id));
    } else {
      await db.insert(schema.shopSettings).values({ shopId: sid, key: params.key, value: body.value as never });
    }
    return { ok: true, key: params.key };
  });

  app.delete("/:key", async (req) => {
    const sid = shopIdOf(req);
    const params = z.object({ key: z.string() }).parse(req.params);
    await db.delete(schema.shopSettings)
      .where(and(eq(schema.shopSettings.shopId, sid), eq(schema.shopSettings.key, params.key)));
    return { ok: true };
  });
}
