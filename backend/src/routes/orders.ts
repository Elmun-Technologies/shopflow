import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { nextOrderCode } from "../lib/codes.js";
import { notifyOrderStatusChange } from "../lib/telegram-notify.js";
import { logAudit } from "../lib/audit.js";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Yangi",
  PROCESSING: "Tayyorlanmoqda",
  COMPLETED: "Yetkazildi",
  CANCELLED: "Bekor qilindi",
  REFUNDED: "Qaytarildi",
};

const statusEnum = z.enum(["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"]);

const itemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
  price: z.number().nonnegative(),
});

const createOrderSchema = z.object({
  customerId: z.string().optional(),
  channelId: z.string().optional(),
  status: statusEnum.optional(),
  notes: z.string().max(2000).optional(),
  items: z.array(itemSchema).min(1),
  currency: z.string().optional(),
});

const listQuerySchema = z.object({
  status: statusEnum.optional(),
  channelId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const q = listQuerySchema.parse(req.query);
    const where = {
      tenantId: req.session.tenantId,
      ...(q.status && { status: q.status }),
      ...(q.channelId && { channelId: q.channelId }),
      ...(q.search && {
        OR: [
          { code: { contains: q.search, mode: "insensitive" as const } },
          { customer: { name: { contains: q.search, mode: "insensitive" as const } } },
        ],
      }),
    };
    const [total, items] = await Promise.all([
      app.prisma.order.count({ where }),
      app.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          channel: { select: { id: true, type: true, name: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { total, page: q.page, pageSize: q.pageSize, items };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const order = await app.prisma.order.findFirst({
      where: { id, tenantId: req.session.tenantId },
      include: {
        customer: true,
        channel: true,
        items: { include: { product: true } },
      },
    });
    if (!order) return reply.code(404).send({ error: "Not found" });
    return order;
  });

  app.post("/", async (req) => {
    const data = createOrderSchema.parse(req.body);
    const code = await nextOrderCode(app.prisma, req.session.tenantId);
    const total = data.items.reduce((s, i) => s + i.qty * i.price, 0);

    return app.prisma.order.create({
      data: {
        tenantId: req.session.tenantId,
        code,
        status: data.status ?? "PENDING",
        total,
        currency: data.currency ?? "UZS",
        notes: data.notes,
        customerId: data.customerId,
        channelId: data.channelId,
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            qty: i.qty,
            price: i.price,
          })),
        },
      },
      include: { items: true },
    });
  });

  app.patch("/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = z
      .object({
        status: statusEnum.optional(),
        notes: z.string().optional(),
        assigneeId: z.string().nullable().optional(),
      })
      .parse(req.body);
    const order = await app.prisma.order.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!order) return reply.code(404).send({ error: "Not found" });
    const updated = await app.prisma.order.update({ where: { id }, data });

    const tenantId = req.session.tenantId;
    const actorId = req.session.userId;
    const actor = await app.prisma.user.findUnique({ where: { id: actorId }, select: { name: true } });
    const actorName = actor?.name ?? null;

    // Audit log + Telegram push notification — status o'zgarganda
    if (data.status && data.status !== order.status) {
      const fromLabel = STATUS_LABEL[order.status] ?? order.status;
      const toLabel = STATUS_LABEL[data.status] ?? data.status;
      await logAudit({
        prisma: app.prisma,
        tenantId,
        actorId,
        actorName,
        action: "STATUS_CHANGE",
        resourceType: "order",
        resourceId: id,
        summary: `Status: ${fromLabel} → ${toLabel}`,
        changes: { from: order.status, to: data.status },
      });
      // Fonda yuboramiz, response'ni kutmaymiz
      notifyOrderStatusChange(app.prisma, tenantId, id, order.status, data.status)
        .then((result) => {
          if (!result.sent) {
            app.log.debug({ orderId: id, reason: result.reason }, "TG push skipped");
          }
        })
        .catch((err) => app.log.warn({ err, orderId: id }, "TG push failed"));
    }

    // Audit — assignee o'zgarishi
    if (data.assigneeId !== undefined && data.assigneeId !== order.assigneeId) {
      let summary = "Mas'ul olib tashlandi";
      if (data.assigneeId) {
        const assignee = await app.prisma.user.findFirst({
          where: { id: data.assigneeId, tenantId },
          select: { name: true },
        });
        summary = `Mas'ul tayinlandi: ${assignee?.name ?? "?"}`;
      }
      await logAudit({
        prisma: app.prisma,
        tenantId,
        actorId,
        actorName,
        action: "ASSIGN",
        resourceType: "order",
        resourceId: id,
        summary,
        changes: { from: order.assigneeId, to: data.assigneeId },
      });
    }

    return updated;
  });

  // Internal notes — buyurtmaga ichki izoh (admin team uchun, mijoz ko'rmaydi)
  app.get("/:id/notes", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const order = await app.prisma.order.findFirst({
      where: { id, tenantId: req.session.tenantId },
      select: { id: true },
    });
    if (!order) return reply.code(404).send({ error: "Not found" });
    const notes = await app.prisma.orderNote.findMany({
      where: { orderId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { notes };
  });

  app.post("/:id/notes", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = z.object({ content: z.string().min(1).max(2000) }).parse(req.body);
    const order = await app.prisma.order.findFirst({
      where: { id, tenantId: req.session.tenantId },
      select: { id: true },
    });
    if (!order) return reply.code(404).send({ error: "Not found" });
    const actor = await app.prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { name: true },
    });
    const note = await app.prisma.orderNote.create({
      data: {
        tenantId: req.session.tenantId,
        orderId: id,
        authorId: req.session.userId,
        authorName: actor?.name ?? null,
        content: data.content,
      },
    });
    await logAudit({
      prisma: app.prisma,
      tenantId: req.session.tenantId,
      actorId: req.session.userId,
      actorName: actor?.name ?? null,
      action: "NOTE_ADDED",
      resourceType: "order",
      resourceId: id,
      summary: `Izoh qoldirildi: "${data.content.slice(0, 80)}${data.content.length > 80 ? "..." : ""}"`,
    });
    return reply.code(201).send({ note });
  });

  app.delete("/:id/notes/:noteId", async (req, reply) => {
    const params = z.object({ id: z.string(), noteId: z.string() }).parse(req.params);
    const note = await app.prisma.orderNote.findFirst({
      where: { id: params.noteId, orderId: params.id, tenantId: req.session.tenantId },
    });
    if (!note) return reply.code(404).send({ error: "Not found" });
    await app.prisma.orderNote.delete({ where: { id: params.noteId } });
    return { ok: true };
  });

  // Bulk operations — operator bir nechta buyurtmani bir vaqtda boshqaradi
  // setStatus: tanlangan buyurtmalar statusini bir xil qiymatga o'zgartirish
  const bulkSchema = z.object({
    ids: z.array(z.string()).min(1).max(500),
    action: z.enum(["setStatus"]),
    status: statusEnum.optional(),
  });
  app.post(
    "/bulk",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const data = bulkSchema.parse(req.body);
      if (data.action === "setStatus" && !data.status) {
        return reply.code(400).send({ error: "status required for setStatus" });
      }
      const tenantId = req.session.tenantId;
      const owned = await app.prisma.order.findMany({
        where: { id: { in: data.ids }, tenantId },
        select: { id: true, status: true, code: true },
      });
      if (owned.length === 0) return reply.send({ affected: 0, summary: "Hech narsa topilmadi" });

      const actor = await app.prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { name: true },
      });
      const actorName = actor?.name ?? null;

      let affected = 0;
      let summary = "";

      if (data.action === "setStatus" && data.status) {
        const toStatus = data.status;
        // Faqat haqiqatda o'zgaradiganlarni yangilaymiz, audit/notify spam emas
        const targets = owned.filter((o) => o.status !== toStatus);
        if (targets.length === 0) {
          return reply.send({ affected: 0, summary: "Status allaqachon o'rnatilgan" });
        }
        const res = await app.prisma.order.updateMany({
          where: { id: { in: targets.map((t) => t.id) }, tenantId },
          data: { status: toStatus },
        });
        affected = res.count;
        const toLabel = STATUS_LABEL[toStatus] ?? toStatus;
        summary = `${affected} ta buyurtma → ${toLabel}`;

        // Audit — bitta umumiy bulk yozuv
        await logAudit({
          prisma: app.prisma,
          tenantId,
          actorId: req.session.userId,
          actorName,
          action: "BULK_STATUS_CHANGE",
          resourceType: "order",
          resourceId: targets[0].id,
          summary,
          changes: { ids: targets.map((t) => t.id), to: toStatus },
        });

        // Mijozlarga Telegram push (fonda)
        for (const tgt of targets) {
          notifyOrderStatusChange(app.prisma, tenantId, tgt.id, tgt.status, toStatus)
            .catch((err) => app.log.warn({ err, orderId: tgt.id }, "TG push failed"));
        }
      }

      return reply.send({ affected, summary });
    },
  );
};
