import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";

const sourceEnum = z.enum([
  "telegram", "miniapp", "web_form", "instagram", "facebook", "whatsapp",
  "marketplace", "landing_page", "email", "google_ads", "yandex_direct", "phone", "other",
]);
const statusEnum = z.enum(["new", "contacted", "qualified", "converted", "lost"]);
const priorityEnum = z.enum(["low", "medium", "high"]);

const createSchema = z.object({
  source: sourceEnum,
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
  company: z.string().optional(),
  value: z.number().min(0).default(0),
  priority: priorityEnum.default("medium"),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSchema = z.object({
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
  company: z.string().optional(),
  value: z.number().min(0).optional(),
  assignedTo: z.string().nullable().optional(),
  notes: z.string().optional(),
});

export default async function leadRoutes(app: FastifyInstance) {
  // ─── ADMIN endpoints ─────────────────────────────────────────────
  app.register(async (admin) => {
    admin.addHook("onRequest", app.authenticate);

    function shopIdOf(req: { user: unknown }): string {
      const u = req.user as { kind?: string; shopId?: string };
      if (u.kind === "miniapp") throw new Error("Admin token kerak");
      if (!u.shopId) throw new Error("shopId yo'q");
      return u.shopId;
    }

    admin.get("/", async (req) => {
      const sid = shopIdOf(req);
      const query = z.object({
        status: statusEnum.optional(),
        source: sourceEnum.optional(),
        limit: z.coerce.number().int().min(1).max(500).default(100),
      }).parse(req.query);

      let where = eq(schema.leads.shopId, sid);
      if (query.status) where = and(where, eq(schema.leads.status, query.status))!;
      if (query.source) where = and(where, eq(schema.leads.source, query.source))!;

      return await db.query.leads.findMany({
        where,
        orderBy: [desc(schema.leads.createdAt)],
        limit: query.limit,
      });
    });

    admin.get("/stats", async (req) => {
      const sid = shopIdOf(req);
      const all = await db.query.leads.findMany({ where: eq(schema.leads.shopId, sid) });
      const bySource = new Map<string, number>();
      for (const l of all) bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);

      const total = all.length;
      const newCount = all.filter((l) => l.status === "new").length;
      const converted = all.filter((l) => l.status === "converted").length;
      const wonValue = all.filter((l) => l.status === "converted").reduce((s, l) => s + l.value, 0);
      const conversionRate = total > 0 ? (converted / total) * 100 : 0;

      return {
        total,
        new: newCount,
        contacted: all.filter((l) => l.status === "contacted").length,
        qualified: all.filter((l) => l.status === "qualified").length,
        converted,
        lost: all.filter((l) => l.status === "lost").length,
        conversionRate,
        wonValue,
        bySource: Object.fromEntries(bySource),
      };
    });

    admin.get("/:id", async (req, reply) => {
      const sid = shopIdOf(req);
      const params = z.object({ id: z.string() }).parse(req.params);
      const lead = await db.query.leads.findFirst({
        where: and(eq(schema.leads.id, params.id), eq(schema.leads.shopId, sid)),
      });
      if (!lead) return reply.code(404).send({ error: "Lid topilmadi" });
      return lead;
    });

    admin.post("/", async (req, reply) => {
      const sid = shopIdOf(req);
      const body = createSchema.parse(req.body);
      const [lead] = await db.insert(schema.leads).values({
        shopId: sid,
        source: body.source,
        name: body.name,
        phone: body.phone,
        email: body.email,
        company: body.company,
        value: body.value,
        priority: body.priority,
        notes: body.notes,
        metadata: body.metadata,
      }).returning();
      return reply.code(201).send(lead);
    });

    admin.patch("/:id", async (req, reply) => {
      const sid = shopIdOf(req);
      const params = z.object({ id: z.string() }).parse(req.params);
      const body = updateSchema.parse(req.body);
      const [updated] = await db.update(schema.leads)
        .set({ ...body, updatedAt: new Date() })
        .where(and(eq(schema.leads.id, params.id), eq(schema.leads.shopId, sid)))
        .returning();
      if (!updated) return reply.code(404).send({ error: "Lid topilmadi" });
      return updated;
    });

    admin.delete("/:id", async (req) => {
      const sid = shopIdOf(req);
      const params = z.object({ id: z.string() }).parse(req.params);
      await db.delete(schema.leads)
        .where(and(eq(schema.leads.id, params.id), eq(schema.leads.shopId, sid)));
      return { ok: true };
    });
  });

  // ─── PUBLIC endpoint (web form, landing page'dan) ─────────────────
  app.post("/public/:shopId", async (req, reply) => {
    const params = z.object({ shopId: z.string() }).parse(req.params);
    const body = z.object({
      name: z.string().min(1).max(200),
      phone: z.string().max(50).optional(),
      email: z.string().email().optional().or(z.literal("")).transform((v) => v || undefined),
      company: z.string().max(200).optional(),
      source: sourceEnum.default("web_form"),
      notes: z.string().max(2000).optional(),
      metadata: z.record(z.unknown()).optional(),
    }).parse(req.body);

    const shop = await db.query.shops.findFirst({ where: eq(schema.shops.id, params.shopId) });
    if (!shop) return reply.code(404).send({ error: "Do'kon topilmadi" });

    const [lead] = await db.insert(schema.leads).values({
      shopId: shop.id,
      source: body.source,
      status: "new",
      priority: "medium",
      name: body.name,
      phone: body.phone,
      email: body.email,
      company: body.company,
      notes: body.notes,
      metadata: body.metadata,
      value: 0,
    }).returning();

    return reply.code(201).send({ ok: true, leadId: lead.id });
  });

  // Source statistics — analytics widget uchun
  app.get("/by-source", { onRequest: app.authenticate }, async (req) => {
    const u = req.user as { kind?: string; shopId?: string };
    if (u.kind === "miniapp" || !u.shopId) throw new Error("Admin token kerak");
    const rows = await db.select({
      source: schema.leads.source,
      count: sql<number>`count(*)`.as("count"),
      value: sql<number>`coalesce(sum(${schema.leads.value}), 0)`.as("value"),
    })
      .from(schema.leads)
      .where(eq(schema.leads.shopId, u.shopId))
      .groupBy(schema.leads.source);
    return rows;
  });
}
