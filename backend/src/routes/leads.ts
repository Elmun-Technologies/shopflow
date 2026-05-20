import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { nextLeadCode } from "../lib/codes.js";

const leadStatusEnum = z.enum([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
]);

const priorityEnum = z.enum(["HIGH", "MEDIUM", "LOW"]);

const createLeadSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().max(120).optional(),
  position: z.string().max(120).optional(),
  location: z.string().max(120).optional(),
  status: leadStatusEnum.optional(),
  priority: priorityEnum.optional(),
  value: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  channelId: z.string().optional(),
  assigneeId: z.string().optional(),
});

const updateLeadSchema = createLeadSchema.partial();

const listQuerySchema = z.object({
  status: leadStatusEnum.optional(),
  channelId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export const leadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const q = listQuerySchema.parse(req.query);
    const where = {
      tenantId: req.session.tenantId,
      ...(q.status && { status: q.status }),
      ...(q.channelId && { channelId: q.channelId }),
      ...(q.search && {
        OR: [
          { name: { contains: q.search, mode: "insensitive" as const } },
          { phone: { contains: q.search } },
          { email: { contains: q.search, mode: "insensitive" as const } },
          { company: { contains: q.search, mode: "insensitive" as const } },
        ],
      }),
    };
    const [total, items] = await Promise.all([
      app.prisma.lead.count({ where }),
      app.prisma.lead.findMany({
        where,
        include: {
          channel: { select: { id: true, type: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, items };
  });

  app.get("/stats", async (req) => {
    const tenantId = req.session.tenantId;
    const [byStatus, byChannel, totalValue] = await Promise.all([
      app.prisma.lead.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: true,
        _sum: { value: true },
      }),
      app.prisma.lead.groupBy({
        by: ["channelId"],
        where: { tenantId },
        _count: true,
        _sum: { value: true },
      }),
      app.prisma.lead.aggregate({
        where: { tenantId, status: "WON" },
        _sum: { value: true },
      }),
    ]);

    const channelIds = byChannel.map((c) => c.channelId).filter((id): id is string => !!id);
    const channels = await app.prisma.channel.findMany({
      where: { id: { in: channelIds } },
      select: { id: true, name: true, type: true },
    });

    return {
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
        value: Number(s._sum.value ?? 0),
      })),
      byChannel: byChannel.map((c) => ({
        channelId: c.channelId,
        channel: channels.find((ch) => ch.id === c.channelId) ?? null,
        count: c._count,
        value: Number(c._sum.value ?? 0),
      })),
      wonValue: Number(totalValue._sum.value ?? 0),
    };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lead = await app.prisma.lead.findFirst({
      where: { id, tenantId: req.session.tenantId },
      include: {
        channel: true,
        assignee: { select: { id: true, name: true } },
        interactions: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!lead) return reply.code(404).send({ error: "Not found" });
    return lead;
  });

  app.post("/", async (req) => {
    const data = createLeadSchema.parse(req.body);
    const code = await nextLeadCode(app.prisma, req.session.tenantId);
    return app.prisma.lead.create({
      data: {
        ...data,
        email: data.email || null,
        tenantId: req.session.tenantId,
        code,
        value: data.value ?? 0,
      },
    });
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = updateLeadSchema.parse(req.body);
    const lead = await app.prisma.lead.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!lead) return reply.code(404).send({ error: "Not found" });

    return app.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: { ...data, email: data.email || undefined },
      });
      if (data.status && data.status !== lead.status) {
        await tx.interaction.create({
          data: {
            tenantId: req.session.tenantId,
            leadId: id,
            type: "STATUS_CHANGE",
            direction: "OUTBOUND",
            content: `Status: ${lead.status} → ${data.status}`,
            createdBy: req.session.email,
          },
        });
      }
      return updated;
    });
  });

  app.delete("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const lead = await app.prisma.lead.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!lead) return reply.code(404).send({ error: "Not found" });
    await app.prisma.lead.delete({ where: { id } });
    return { ok: true };
  });

  const interactionSchema = z.object({
    type: z.enum(["CALL", "EMAIL", "SMS", "WHATSAPP", "TELEGRAM", "MEETING", "NOTE", "STATUS_CHANGE"]),
    direction: z.enum(["INBOUND", "OUTBOUND"]),
    content: z.string().min(1).max(2000),
    duration: z.number().int().nonnegative().optional(),
  });

  app.post("/:id/interactions", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = interactionSchema.parse(req.body);
    const lead = await app.prisma.lead.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!lead) return reply.code(404).send({ error: "Not found" });

    return app.prisma.$transaction(async (tx) => {
      const interaction = await tx.interaction.create({
        data: {
          ...data,
          tenantId: req.session.tenantId,
          leadId: id,
          createdBy: req.session.email,
        },
      });
      await tx.lead.update({
        where: { id },
        data: { lastContactAt: new Date() },
      });
      return interaction;
    });
  });
};
