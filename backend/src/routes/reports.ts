// Email reports — admin "Hozir yuborish" tugmasini bossagina test/snapshot.
// Avtomatik rejasi TenantNotifSettings.reportFrequency'da, scheduler tomonidan.

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendReportToTenant } from "../lib/email-reports.js";
import { isEmailConfigured, verifyEmailConnection } from "../lib/email.js";

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // SMTP konfiguratsiya statusi
  app.get("/status", async () => ({
    configured: isEmailConfigured(),
  }));

  // SMTP ulanish testi (Settings'da "Tekshirish" tugmasi)
  app.post("/verify", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async () => {
    return verifyEmailConnection();
  });

  // Hozir yuborish — tanlangan davr bo'yicha
  app.post("/send-now", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = z.object({
      frequency: z.enum(["daily", "weekly", "monthly"]).default("daily"),
    }).parse(req.body ?? {});
    const res = await sendReportToTenant(app.prisma, req.session.tenantId, data.frequency);
    if (!res.ok) return reply.code(400).send({ error: res.reason ?? "send_failed" });
    return { ok: true, sent: res.sent };
  });
};
