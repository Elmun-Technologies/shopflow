// Outbound webhook CRUD — admin paneldan tashqi tizimlarga event yuborishni
// sozlash. Tenant-scoped. Secret shifrlanib saqlanadi, frontend'ga qaytarilmaydi.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { encryptSecret } from "../lib/secret-cipher.js";
import { fireWebhookEvent } from "../lib/outbound-webhook.js";
import { logAudit } from "../lib/audit.js";

const EVENTS = ["order.created", "order.status_changed", "order.paid", "lead.created"] as const;

const upsertSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.enum(EVENTS)).min(1),
  secret: z.string().max(200).optional().nullable(),
  description: z.string().max(200).optional().nullable(),
  active: z.boolean().optional(),
});

function publicView(w: {
  id: string; url: string; events: string[]; description: string | null;
  active: boolean; lastStatus: number | null; lastFiredAt: Date | null;
  lastError: string | null; failureCount: number; encryptedSecret: string | null; createdAt: Date;
}) {
  return {
    id: w.id,
    url: w.url,
    events: w.events,
    description: w.description,
    active: w.active,
    hasSecret: !!w.encryptedSecret,
    lastStatus: w.lastStatus,
    lastFiredAt: w.lastFiredAt?.toISOString() ?? null,
    lastError: w.lastError,
    failureCount: w.failureCount,
    createdAt: w.createdAt.toISOString(),
  };
}

export const outboundWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const items = await app.prisma.outboundWebhook.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: { createdAt: "desc" },
    });
    return { items: items.map(publicView), availableEvents: EVENTS };
  });

  app.post("/", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = upsertSchema.parse(req.body);
    const created = await app.prisma.outboundWebhook.create({
      data: {
        tenantId: req.session.tenantId,
        url: data.url,
        events: data.events,
        description: data.description ?? null,
        active: data.active ?? true,
        encryptedSecret: data.secret ? encryptSecret(data.secret) : null,
      },
    });
    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      action: "WEBHOOK_CREATED",
      resourceType: "outbound_webhook",
      resourceId: created.id,
      summary: `Webhook qo'shildi: ${data.url}`,
    });
    return reply.code(201).send(publicView(created));
  });

  app.patch<{ Params: { id: string } }>("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = upsertSchema.partial().parse(req.body);
    const existing = await app.prisma.outboundWebhook.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Topilmadi" });
    await app.prisma.outboundWebhook.updateMany({
      where: { id: req.params.id, tenantId: req.session.tenantId },
      data: {
        ...(data.url !== undefined && { url: data.url }),
        ...(data.events !== undefined && { events: data.events }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.active !== undefined && { active: data.active }),
        // secret: "" yuborilsa o'chiriladi, undefined bo'lsa o'zgarmaydi
        ...(data.secret !== undefined && { encryptedSecret: data.secret ? encryptSecret(data.secret) : null }),
        // Qayta yoqilganda failure hisoblagichni 0 ga tushiramiz
        ...(data.active === true && { failureCount: 0, lastError: null }),
      },
    });
    const updated = await app.prisma.outboundWebhook.findFirstOrThrow({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    return publicView(updated);
  });

  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const existing = await app.prisma.outboundWebhook.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Topilmadi" });
    await app.prisma.outboundWebhook.deleteMany({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    return { ok: true };
  });

  // Test ping — webhook'ni sinash uchun namuna payload yuboradi
  app.post<{ Params: { id: string } }>("/:id/test", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const hook = await app.prisma.outboundWebhook.findFirst({
      where: { id: req.params.id, tenantId: req.session.tenantId },
    });
    if (!hook) return reply.code(404).send({ error: "Topilmadi" });
    await fireWebhookEvent(app.prisma, req.session.tenantId, "order.created", {
      test: true,
      order: { id: "test_123", code: "ORD-TEST", total: 100000, currency: "UZS", status: "PENDING" },
    });
    // Yangilangan diagnostika holatini qaytaramiz
    const updated = await app.prisma.outboundWebhook.findFirstOrThrow({ where: { id: hook.id } });
    return { ok: true, lastStatus: updated.lastStatus, lastError: updated.lastError };
  });
};
