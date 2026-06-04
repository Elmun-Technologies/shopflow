// Admin Chat sahifasi uchun konversatsiyalar va xabarlar.
//
// Mijoz tomondan kelgan xabarlar (Telegram bot va h.k.) webhook'da
// avtomatik Conversation + ConversationMessage(INBOUND) yaratadi.
// Admin javob yozsa POST /chats/:id/messages — OUTBOUND yaratiladi va
// provayder'ga (hozircha Telegram) yuboriladi.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logAudit } from "../lib/audit.js";
import { sendTelegramRaw } from "../lib/telegram-notify.js";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Faol",
  WAITING: "Kutilmoqda",
  RESOLVED: "Yopildi",
  ARCHIVED: "Arxivlandi",
  SPAM: "Spam",
};

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // Konversatsiyalar ro'yxati
  const listQuerySchema = z.object({
    status: z.enum(["ACTIVE", "WAITING", "RESOLVED", "ARCHIVED", "SPAM"]).optional(),
    channelId: z.string().optional(),
    assigneeId: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(200).default(50),
  });
  app.get("/", async (req) => {
    const q = listQuerySchema.parse(req.query);
    const where = {
      tenantId: req.session.tenantId,
      ...(q.status && { status: q.status }),
      ...(q.channelId && { channelId: q.channelId }),
      ...(q.assigneeId && { assigneeId: q.assigneeId }),
      ...(q.search && {
        OR: [
          { customerName: { contains: q.search, mode: "insensitive" as const } },
          { lastMessagePreview: { contains: q.search, mode: "insensitive" as const } },
        ],
      }),
    };
    const [total, items] = await Promise.all([
      app.prisma.conversation.count({ where }),
      app.prisma.conversation.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true, telegramUserId: true } },
          channel: { select: { id: true, name: true, type: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      items: items.map((c) => ({
        id: c.id,
        status: c.status,
        customerId: c.customerId,
        customerName: c.customer?.name ?? c.customerName ?? "Mehmon",
        customerAvatar: c.customerAvatar,
        customerPhone: c.customer?.phone ?? null,
        externalUserId: c.externalUserId,
        channel: c.channel,
        assignee: c.assignee,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        lastMessagePreview: c.lastMessagePreview,
        unreadCount: c.unreadCount,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  });

  // Bitta konversatsiya + xabarlar tarixi
  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const conv = await app.prisma.conversation.findFirst({
      where: { id, tenantId: req.session.tenantId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true, telegramUserId: true } },
        channel: { select: { id: true, name: true, type: true } },
        assignee: { select: { id: true, name: true } },
      },
    });
    if (!conv) return reply.code(404).send({ error: "Not found" });
    const messages = await app.prisma.conversationMessage.findMany({
      where: { conversationId: id },
      orderBy: { sentAt: "asc" },
      take: 500,
    });
    return {
      id: conv.id,
      status: conv.status,
      customer: conv.customer,
      customerName: conv.customer?.name ?? conv.customerName ?? "Mehmon",
      customerAvatar: conv.customerAvatar,
      externalUserId: conv.externalUserId,
      channel: conv.channel,
      assignee: conv.assignee,
      lastMessageAt: conv.lastMessageAt?.toISOString() ?? null,
      unreadCount: conv.unreadCount,
      createdAt: conv.createdAt.toISOString(),
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        authorId: m.authorId,
        authorName: m.authorName,
        sentAt: m.sentAt.toISOString(),
        read: m.read,
      })),
    };
  });

  // Yangi xabar yuborish — provayder'ga uzatadi (Telegram bo'lsa bot orqali)
  app.post("/:id/messages", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = z.object({ content: z.string().min(1).max(4000) }).parse(req.body);

    const conv = await app.prisma.conversation.findFirst({
      where: { id, tenantId: req.session.tenantId },
      include: {
        customer: { select: { telegramUserId: true } },
        channel: { select: { type: true, config: true } },
      },
    });
    if (!conv) return reply.code(404).send({ error: "Not found" });

    const actor = await app.prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { name: true },
    });

    // Telegram orqali yuborish — agar kanal Telegram bo'lsa va token mavjud bo'lsa
    let deliveryReason: string | null = null;
    if (conv.channel?.type === "TELEGRAM") {
      const cfg = (conv.channel.config ?? {}) as { botToken?: string };
      const token = cfg.botToken?.trim();
      const targetId = conv.externalUserId || conv.customer?.telegramUserId?.toString();
      if (token && targetId) {
        const result = await sendTelegramRaw(token, targetId, data.content);
        if (!result.ok) {
          deliveryReason = result.errorCode === 403
            ? "Mijoz bot bilan suhbatni boshlamagan"
            : result.description ?? "Telegram xato";
        }
      } else {
        deliveryReason = !token ? "Bot token sozlanmagan" : "Mijoz Telegram ID yo'q";
      }
    }

    const msg = await app.prisma.conversationMessage.create({
      data: {
        conversationId: id,
        direction: "OUTBOUND",
        content: data.content,
        authorId: req.session.userId,
        authorName: actor?.name ?? null,
        read: true,
      },
    });
    await app.prisma.conversation.update({
      where: { id },
      data: {
        lastMessageAt: msg.sentAt,
        lastMessagePreview: data.content.slice(0, 120),
        // status ACTIVE'ga qaytariladi
        status: conv.status === "RESOLVED" || conv.status === "ARCHIVED" ? "ACTIVE" : conv.status,
      },
    });

    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "MESSAGE_SENT",
      resourceType: "conversation",
      resourceId: id,
      summary: deliveryReason
        ? `Javob yozildi (yetkazib bo'lmadi: ${deliveryReason})`
        : "Javob yuborildi",
    });

    return {
      message: {
        id: msg.id,
        direction: msg.direction,
        content: msg.content,
        authorName: msg.authorName,
        sentAt: msg.sentAt.toISOString(),
        read: msg.read,
      },
      deliveryReason,
    };
  });

  // Konversatsiya yangilash: status, assignee
  const patchSchema = z.object({
    status: z.enum(["ACTIVE", "WAITING", "RESOLVED", "ARCHIVED", "SPAM"]).optional(),
    assigneeId: z.string().nullable().optional(),
  });
  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = patchSchema.parse(req.body);
    const conv = await app.prisma.conversation.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!conv) return reply.code(404).send({ error: "Not found" });
    const affected = await app.prisma.conversation.updateMany({
      where: { id, tenantId: req.session.tenantId },
      data,
    });
    if (affected.count === 0) return reply.code(404).send({ error: "Not found" });
    const updated = await app.prisma.conversation.findFirstOrThrow({
      where: { id, tenantId: req.session.tenantId },
    });

    const actor = await app.prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { name: true },
    });
    if (data.status && data.status !== conv.status) {
      await logAudit({
        prisma: app.prisma,
        tenantId: req.session.tenantId,
        actorId: req.session.userId,
        actorName: actor?.name ?? null,
        action: "STATUS_CHANGE",
        resourceType: "conversation",
        resourceId: id,
        summary: `Status: ${STATUS_LABEL[conv.status] ?? conv.status} → ${STATUS_LABEL[data.status] ?? data.status}`,
      });
    }
    if (data.assigneeId !== undefined && data.assigneeId !== conv.assigneeId) {
      let summary = "Mas'ul olib tashlandi";
      if (data.assigneeId) {
        const assignee = await app.prisma.user.findFirst({
          where: { id: data.assigneeId, tenantId: req.session.tenantId },
          select: { name: true },
        });
        summary = `Mas'ul tayinlandi: ${assignee?.name ?? "?"}`;
      }
      await logAudit({
        prisma: app.prisma,
        tenantId: req.session.tenantId,
        actorId: req.session.userId,
        actorName: actor?.name ?? null,
        action: "ASSIGN",
        resourceType: "conversation",
        resourceId: id,
        summary,
      });
    }
    return updated;
  });

  // Konversatsiyani "o'qildi" deb belgilash
  app.post("/:id/mark-read", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const conv = await app.prisma.conversation.findFirst({
      where: { id, tenantId: req.session.tenantId },
      select: { id: true },
    });
    if (!conv) return reply.code(404).send({ error: "Not found" });
    await app.prisma.$transaction([
      app.prisma.conversationMessage.updateMany({
        where: { conversationId: id, direction: "INBOUND", read: false },
        data: { read: true },
      }),
      app.prisma.conversation.update({
        where: { id },
        data: { unreadCount: 0 },
      }),
    ]);
    return { ok: true };
  });
};
