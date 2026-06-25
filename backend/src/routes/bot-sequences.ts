// Bot Voronka (Funnel) — sekanslar CRUD va statistika
// GET    /api/bot-sequences
// POST   /api/bot-sequences
// PATCH  /api/bot-sequences/:id
// DELETE /api/bot-sequences/:id
// POST   /api/bot-sequences/:id/test   — bitta test xabari yuborish

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendTelegramRaw } from "../lib/telegram-notify.js";

const stepSchema = z.object({
  id: z.string().optional(),
  stepOrder: z.number().int().min(0),
  delayHours: z.number().int().min(0).max(8760),  // max 1 yil
  message: z.string().min(1).max(4096),
});

const sequenceSchema = z.object({
  name: z.string().min(1).max(100),
  trigger: z.enum(["NEW_CUSTOMER", "FIRST_PURCHASE", "INACTIVE_DAYS", "VIP_STATUS", "BIRTHDAY", "WEEKLY"]),
  inactiveDays: z.number().int().min(1).max(365).optional().nullable(),
  weekDay: z.number().int().min(0).max(6).optional().nullable(),
  active: z.boolean().optional(),
  steps: z.array(stepSchema).min(1).max(20),
});

export const botSequencesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // ─── GET /api/bot-sequences ───────────────────────────────────────────────
  app.get("/", async (req) => {
    const tenantId = req.session.tenantId;
    const sequences = await app.prisma.botSequence.findMany({
      where: { tenantId },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = await Promise.all(sequences.map(async (seq) => {
      const completedCount = await app.prisma.botSequenceEnrollment.count({
        where: { sequenceId: seq.id, completed: true },
      });
      return { ...seq, completedCount };
    }));
    return enriched;
  });

  // ─── POST /api/bot-sequences ──────────────────────────────────────────────
  app.post("/", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = sequenceSchema.parse(req.body);
    const tenantId = req.session.tenantId;

    const seq = await app.prisma.botSequence.create({
      data: {
        tenantId,
        name: data.name,
        trigger: data.trigger,
        inactiveDays: data.inactiveDays ?? null,
        weekDay: data.weekDay ?? null,
        active: data.active ?? true,
        steps: {
          create: data.steps.map((s) => ({
            stepOrder: s.stepOrder,
            delayHours: s.delayHours,
            message: s.message,
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    reply.status(201);
    return seq;
  });

  // ─── PATCH /api/bot-sequences/:id ─────────────────────────────────────────
  app.patch("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = sequenceSchema.partial().parse(req.body);
    const tenantId = req.session.tenantId;

    const existing = await app.prisma.botSequence.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    await app.prisma.$transaction(async (tx) => {
      if (data.steps) {
        await tx.botSequenceStep.deleteMany({ where: { sequenceId: id } });
        await tx.botSequenceStep.createMany({
          data: data.steps.map((s) => ({
            sequenceId: id,
            stepOrder: s.stepOrder,
            delayHours: s.delayHours,
            message: s.message,
          })),
        });
      }
      return tx.botSequence.update({
        where: { id },
        data: {
          name: data.name,
          trigger: data.trigger,
          inactiveDays: data.inactiveDays ?? null,
          weekDay: data.weekDay ?? null,
          active: data.active,
        },
        include: { steps: { orderBy: { stepOrder: "asc" } } },
      });
    });

    return app.prisma.botSequence.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
  });

  // ─── DELETE /api/bot-sequences/:id ────────────────────────────────────────
  app.delete("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.session.tenantId;
    const existing = await app.prisma.botSequence.findFirst({ where: { id, tenantId } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    await app.prisma.botSequence.delete({ where: { id } });
    return { ok: true };
  });

  // ─── POST /api/bot-sequences/:id/test ─────────────────────────────────────
  // Admin birinchi step'ni o'ziga test sifatida yuboradi
  app.post("/:id/test", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { chatId } = z.object({ chatId: z.string().min(1) }).parse(req.body);
    const tenantId = req.session.tenantId;

    const seq = await app.prisma.botSequence.findFirst({
      where: { id, tenantId },
      include: { steps: { orderBy: { stepOrder: "asc" }, take: 1 } },
    });
    if (!seq || seq.steps.length === 0) return reply.status(404).send({ error: "Sequence or steps not found" });

    const token = await app.prisma.channel.findFirst({
      where: { tenantId, type: "TELEGRAM", active: true },
      select: { config: true },
    }).then((ch) => (ch?.config as { botToken?: string } | null)?.botToken?.trim() ?? null);

    if (!token) return reply.status(422).send({ error: "No Telegram bot token configured" });

    const result = await sendTelegramRaw(token, chatId, seq.steps[0].message);
    if (!result.ok) return reply.status(422).send({ error: result.description ?? "Send failed" });
    return { ok: true };
  });

  // ─── GET /api/bot-sequences/stats ─────────────────────────────────────────
  app.get("/stats", async (req) => {
    const tenantId = req.session.tenantId;
    const total = await app.prisma.botSequence.count({ where: { tenantId } });
    const active = await app.prisma.botSequence.count({ where: { tenantId, active: true } });
    const enrolled = await app.prisma.botSequenceEnrollment.count({
      where: { sequence: { tenantId }, completed: false },
    });
    const sent = await app.prisma.botSequenceEnrollment.count({
      where: { sequence: { tenantId }, completed: true },
    });
    return { total, active, enrolled, sent };
  });
};
