// Admin: abandoned cart'larni ko'rish va qo'lda eslatma yuborish.

import type { FastifyPluginAsync } from "fastify";
import { notifyCustomerByTelegramId } from "../lib/telegram-notify.js";
import { buildReminderText } from "../lib/cart-abandonment.js";

export const abandonedCartsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /** GET /api/abandoned-carts — tenant'ning abandoned cart'lari */
  app.get("/", async (req) => {
    const carts = await app.prisma.abandonedCart.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: { lastActiveAt: "desc" },
      take: 100,
    });

    const totalAtRisk = carts.reduce((s, c) => s + Number(c.total), 0);
    const remindedCount = carts.filter((c) => c.remindersSent > 0).length;

    return {
      carts: carts.map((c) => ({
        id: c.id,
        telegramUserId: c.telegramUserId.toString(),
        customerName: c.customerName,
        items: c.items,
        itemCount: Array.isArray(c.items) ? (c.items as unknown as Array<{ qty: number }>).reduce((s, i) => s + (i.qty ?? 0), 0) : 0,
        total: Number(c.total),
        currency: c.currency,
        lastActiveAt: c.lastActiveAt,
        reminderSentAt: c.reminderSentAt,
        remindersSent: c.remindersSent,
        createdAt: c.createdAt,
      })),
      summary: {
        total: carts.length,
        atRisk: totalAtRisk,
        currency: carts[0]?.currency ?? "UZS",
        remindedCount,
      },
    };
  });

  /** POST /api/abandoned-carts/:id/remind — qo'lda eslatma yuborish */
  app.post<{ Params: { id: string } }>(
    "/:id/remind",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const cart = await app.prisma.abandonedCart.findFirst({
        where: { id: req.params.id, tenantId: req.session.tenantId },
        include: { tenant: { select: { name: true } } },
      });
      if (!cart) return reply.code(404).send({ error: "Savat topilmadi" });

      const items = Array.isArray(cart.items)
        ? (cart.items as unknown as Array<{ productId: string; name: string; qty: number; price: number }>)
        : [];
      const customer = await app.prisma.customer.findFirst({
        where: { tenantId: cart.tenantId, telegramUserId: cart.telegramUserId },
        select: { language: true },
      });
      const text = buildReminderText({
        storeName: cart.tenant.name,
        customerName: cart.customerName,
        items,
        total: Number(cart.total),
        currency: cart.currency,
        lang: customer?.language === "ru" ? "ru" : "uz",
      });

      const result = await notifyCustomerByTelegramId(
        app.prisma,
        cart.tenantId,
        cart.telegramUserId,
        text,
      );

      if (result.sent) {
        await app.prisma.abandonedCart.update({
          where: { id: cart.id },
          data: {
            reminderSentAt: new Date(),
            remindersSent: { increment: 1 },
          },
        });
        return { ok: true };
      }
      return reply.code(400).send({ error: result.reason ?? "Eslatma yuborilmadi" });
    },
  );

  /** DELETE /api/abandoned-carts/:id */
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [app.requireRole("OWNER", "ADMIN") ] },
    async (req, reply) => {
      const cart = await app.prisma.abandonedCart.findFirst({
        where: { id: req.params.id, tenantId: req.session.tenantId },
      });
      if (!cart) return reply.code(404).send({ error: "Savat topilmadi" });
      await app.prisma.abandonedCart.delete({ where: { id: cart.id } });
      return reply.code(204).send();
    },
  );
};
