import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { nextLeadCode } from "../lib/codes.js";

// Channel webhook — har bir kanal `webhookKey` ga ega.
// URL: POST /api/webhooks/lead/:webhookKey
// Body: { name, phone?, email?, ...utm, value? }
//
// Bu endpoint lid yaratadi va uni kanalga bog'laydi.

const leadInSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().max(120).optional(),
  location: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
  value: z.number().nonnegative().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.post("/lead/:webhookKey", async (req, reply) => {
    const { webhookKey } = z.object({ webhookKey: z.string() }).parse(req.params);
    const data = leadInSchema.parse(req.body);

    const channel = await app.prisma.channel.findUnique({ where: { webhookKey } });
    if (!channel || !channel.active) {
      return reply.code(404).send({ error: "Channel topilmadi yoki aktiv emas" });
    }

    const code = await nextLeadCode(app.prisma, channel.tenantId);
    const lead = await app.prisma.lead.create({
      data: {
        tenantId: channel.tenantId,
        channelId: channel.id,
        code,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        company: data.company,
        location: data.location,
        notes: data.notes,
        value: data.value ?? 0,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        tags: data.tags ?? [],
        status: "NEW",
        interactions: {
          create: {
            tenantId: channel.tenantId,
            type: "STATUS_CHANGE",
            direction: "INBOUND",
            content: `Yangi lid — ${channel.name} (${channel.type}) orqali`,
            createdBy: "system",
          },
        },
      },
    });
    return reply.code(201).send({ id: lead.id, code: lead.code });
  });

  // Telegram bot webhook — eng oddiy: matn xabarini lid sifatida saqlash
  app.post("/telegram/:webhookKey", async (req, reply) => {
    const { webhookKey } = z.object({ webhookKey: z.string() }).parse(req.params);
    const channel = await app.prisma.channel.findUnique({ where: { webhookKey } });
    if (!channel || channel.type !== "TELEGRAM" || !channel.active) {
      return reply.code(404).send({ error: "Channel topilmadi" });
    }

    const body = req.body as { message?: { from?: { first_name?: string; username?: string }; text?: string } };
    const msg = body?.message;
    if (!msg?.from || !msg?.text) {
      return { ok: true, skipped: true };
    }

    const name = [msg.from.first_name, msg.from.username && `@${msg.from.username}`]
      .filter(Boolean)
      .join(" ") || "Telegram foydalanuvchi";

    const code = await nextLeadCode(app.prisma, channel.tenantId);
    const lead = await app.prisma.lead.create({
      data: {
        tenantId: channel.tenantId,
        channelId: channel.id,
        code,
        name,
        notes: msg.text.slice(0, 500),
        status: "NEW",
        interactions: {
          create: {
            tenantId: channel.tenantId,
            type: "TELEGRAM",
            direction: "INBOUND",
            content: msg.text,
            createdBy: name,
          },
        },
      },
    });
    return { ok: true, leadId: lead.id, code: lead.code };
  });
};
