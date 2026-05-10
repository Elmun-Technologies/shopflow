import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { saveCredentials, syncProducts, syncStock, disconnect, getClient, getSyncLogs } from "../integrations/moysklad/sync.js";

const msConnectSchema = z.union([
  z.object({ type: z.literal("token"), token: z.string().min(10) }),
  z.object({ type: z.literal("basic"), login: z.string().min(1), password: z.string().min(1) }),
]);

export default async function integrationRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  function shopIdOf(req: { user: unknown }): string {
    const u = req.user as { kind?: string; shopId?: string };
    if (u.kind === "miniapp") throw new Error("Admin token kerak");
    if (!u.shopId) throw new Error("shopId yo'q");
    return u.shopId;
  }

  app.get("/", async (req) => {
    const sid = shopIdOf(req);
    const rows = await db.query.integrations.findMany({ where: eq(schema.integrations.shopId, sid) });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      lastSyncAt: r.lastSyncAt,
      createdAt: r.createdAt,
    }));
  });

  // MoySklad
  app.post("/moysklad", async (req, reply) => {
    const sid = shopIdOf(req);
    const body = msConnectSchema.parse(req.body);
    const result = await saveCredentials(sid, body);
    return reply.code(201).send({ ok: true, account: result });
  });

  app.delete("/moysklad", async (req) => {
    const sid = shopIdOf(req);
    await disconnect(sid);
    return { ok: true };
  });

  app.post("/moysklad/sync", async (req, reply) => {
    const sid = shopIdOf(req);
    try {
      const result = await syncProducts(sid);
      return reply.send({ ok: true, ...result });
    } catch (err) {
      const integration = await db.query.integrations.findFirst({
        where: and(eq(schema.integrations.shopId, sid), eq(schema.integrations.type, "moysklad")),
      });
      if (integration) {
        await db.update(schema.integrations).set({ status: "error" }).where(eq(schema.integrations.id, integration.id));
      }
      return reply.code(500).send({ ok: false, error: err instanceof Error ? err.message : "Xato" });
    }
  });

  app.get("/moysklad/test", async (req, reply) => {
    const sid = shopIdOf(req);
    const client = await getClient(sid);
    if (!client) return reply.code(404).send({ error: "Ulanmagan" });
    try {
      const me = await client.me();
      return { ok: true, account: { name: me.name, email: me.email } };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: err instanceof Error ? err.message : "Xato" });
    }
  });

  app.post("/moysklad/sync-stock", async (req, reply) => {
    const sid = shopIdOf(req);
    try {
      const updated = await syncStock(sid);
      return reply.send({ ok: true, updated });
    } catch (err) {
      return reply.code(500).send({ ok: false, error: err instanceof Error ? err.message : "Xato" });
    }
  });

  app.get("/moysklad/logs", async (req) => {
    const sid = shopIdOf(req);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query);
    return await getSyncLogs(sid, query.limit);
  });

  app.get("/moysklad/status", async (req) => {
    const sid = shopIdOf(req);
    const integration = await db.query.integrations.findFirst({
      where: and(eq(schema.integrations.shopId, sid), eq(schema.integrations.type, "moysklad")),
    });
    if (!integration) return { connected: false };
    const productCount = (await db.query.products.findMany({ where: and(eq(schema.products.shopId, sid)) }))
      .filter((p) => p.externalId).length;
    return {
      connected: true,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
      config: integration.config,
      syncedProducts: productCount,
    };
  });
}
