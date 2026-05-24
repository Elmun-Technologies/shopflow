// SMS marketing — kampaniyalar va yuborish
// Hozir: Eskiz integratsiyasi, kelajakda Ucell

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendSmsEskiz, sendBulkSmsEskiz } from "../lib/sms.js";

// Channel config'idan SMS sozlamalarini olish
async function getSmsConfig(prisma: Parameters<FastifyPluginAsync>[0]["prisma"], tenantId: string) {
  // SMS config'ni tenant channel'idan olamiz yoki env'dan
  const envLogin = process.env.ESKIZ_LOGIN;
  const envPassword = process.env.ESKIZ_PASSWORD;
  const envFrom = process.env.ESKIZ_FROM ?? "ShopFlow";

  if (envLogin && envPassword) {
    return { login: envLogin, password: envPassword, from: envFrom };
  }

  // Channel'dan olish (kelajakda)
  void prisma;
  void tenantId;
  return null;
}

export const smsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  // SMS sozlamalarini tekshirish
  app.get("/status", async (req) => {
    const config = await getSmsConfig(app.prisma, req.session.tenantId);
    return {
      configured: !!config,
      provider: config ? "eskiz" : null,
    };
  });

  // Bitta telefonga SMS yuborish (test)
  app.post("/send-test", {
    preHandler: [app.requireRole("OWNER", "ADMIN")],
  }, async (req, reply) => {
    const { phone, message } = z.object({
      phone: z.string().min(9).max(20),
      message: z.string().min(1).max(160),
    }).parse(req.body);

    const config = await getSmsConfig(app.prisma, req.session.tenantId);
    if (!config) return reply.code(400).send({ error: "SMS provayder sozlanmagan (ESKIZ_LOGIN va ESKIZ_PASSWORD env'da kerak)" });

    const result = await sendSmsEskiz(config, phone, message);
    return result;
  });

  // Bulk SMS — segmentga yoki barcha mijozlarga
  app.post("/send-bulk", {
    preHandler: [app.requireRole("OWNER", "ADMIN")],
  }, async (req, reply) => {
    const data = z.object({
      message: z.string().min(1).max(160),
      // Kimga: segment yoki barcha telefonli mijozlar
      segmentId: z.string().optional(),
      // Yoki to'g'ridan-to'g'ri telefonlar
      phones: z.array(z.string()).max(10000).optional(),
    }).parse(req.body);

    const config = await getSmsConfig(app.prisma, req.session.tenantId);
    if (!config) return reply.code(400).send({ error: "SMS provayder sozlanmagan" });

    let phones: string[] = data.phones ?? [];

    if (data.segmentId && phones.length === 0) {
      const segment = await app.prisma.customerSegment.findFirst({
        where: { id: data.segmentId, tenantId: req.session.tenantId },
      });
      if (!segment) return reply.code(404).send({ error: "Segment topilmadi" });

      const members = await app.prisma.segmentMember.findMany({
        where: { segmentId: data.segmentId },
        select: { customerId: true },
      });
      const customerIds = members.map((m) => m.customerId);
      const customers = await app.prisma.customer.findMany({
        where: { id: { in: customerIds }, phone: { not: null } },
        select: { phone: true },
      });
      phones = customers.map((c) => c.phone!).filter(Boolean);
    }

    if (phones.length === 0 && !data.segmentId) {
      // Barcha telefonli mijozlar
      const customers = await app.prisma.customer.findMany({
        where: { tenantId: req.session.tenantId, phone: { not: null } },
        select: { phone: true },
        take: 10000,
      });
      phones = customers.map((c) => c.phone!).filter(Boolean);
    }

    if (phones.length === 0) {
      return reply.code(400).send({ error: "Telefon raqamlar topilmadi" });
    }

    app.log.info({ count: phones.length, tenantId: req.session.tenantId }, "[sms] bulk send started");

    // Fonda yuboramiz — response darhol qaytaramiz
    const jobId = `sms_${Date.now()}`;
    reply.code(202).send({ jobId, total: phones.length, status: "queued" });

    // Fon jarayon
    sendBulkSmsEskiz(config, phones, data.message)
      .then((r) => app.log.info({ jobId, ...r }, "[sms] bulk send done"))
      .catch((e) => app.log.error({ jobId, error: e }, "[sms] bulk send error"));

    return reply;
  });

  // Tezkor xabar — bitta telefon yoki customerId
  app.post("/send-one", async (req, reply) => {
    const data = z.object({
      customerId: z.string().optional(),
      phone: z.string().optional(),
      message: z.string().min(1).max(160),
    }).parse(req.body);

    if (!data.customerId && !data.phone) {
      return reply.code(400).send({ error: "customerId yoki phone kerak" });
    }

    const config = await getSmsConfig(app.prisma, req.session.tenantId);
    if (!config) return reply.code(400).send({ error: "SMS provayder sozlanmagan" });

    let phone = data.phone;
    if (data.customerId && !phone) {
      const customer = await app.prisma.customer.findFirst({
        where: { id: data.customerId, tenantId: req.session.tenantId },
        select: { phone: true },
      });
      if (!customer?.phone) return reply.code(400).send({ error: "Mijoz telefon raqami topilmadi" });
      phone = customer.phone;
    }

    const result = await sendSmsEskiz(config, phone!, data.message);
    if (!result.success) return reply.code(500).send({ error: result.error });
    return result;
  });
};
