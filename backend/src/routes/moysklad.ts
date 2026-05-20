import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  clearMoyskladTokenCache,
  createMoyskladWebhook,
  deleteMoyskladWebhook,
  listMoyskladWebhooks,
  testMoyskladToken,
} from "../lib/moysklad-client.js";
import { encryptSecret } from "../lib/secret-cipher.js";
import { runInitialImport } from "../lib/moysklad-sync.js";

const connectSchema = z.object({
  token: z.string().min(20, "Token kamida 20 belgi bo'lishi kerak"),
});

export const moyskladRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /** GET /api/moysklad/status — ulanish holati va oxirgi sync vaqti */
  app.get("/status", async (req) => {
    const acc = await app.prisma.moyskladAccount.findUnique({
      where: { tenantId: req.session.tenantId },
    });
    if (!acc) {
      return { status: "DISCONNECTED" as const, accountName: null, lastSyncAt: null, lastError: null };
    }
    return {
      status: acc.status,
      accountName: acc.accountName,
      accountUuid: acc.accountUuid,
      connectedAt: acc.connectedAt,
      lastSyncAt: acc.lastSyncAt,
      lastWebhookAt: acc.lastWebhookAt,
      lastError: acc.lastError,
      webhookCount: acc.webhookIds.length,
    };
  });

  /** POST /api/moysklad/connect — token saqlash va dastlabki tekshirish */
  app.post("/connect", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { token } = connectSchema.parse(req.body);

    const test = await testMoyskladToken(token);
    if (!test.ok) {
      return reply.code(400).send({ error: "MoySklad token noto'g'ri", detail: test.error });
    }

    const encryptedToken = encryptSecret(token);
    const tenantId = req.session.tenantId;

    const account = await app.prisma.moyskladAccount.upsert({
      where: { tenantId },
      create: {
        tenantId,
        encryptedToken,
        accountUuid: test.accountUuid,
        accountName: test.accountName,
        status: "CONNECTED",
        connectedAt: new Date(),
        lastError: null,
      },
      update: {
        encryptedToken,
        accountUuid: test.accountUuid,
        accountName: test.accountName,
        status: "CONNECTED",
        connectedAt: new Date(),
        lastError: null,
      },
    });
    clearMoyskladTokenCache(tenantId);

    return {
      ok: true,
      status: account.status,
      accountName: account.accountName,
      accountUuid: account.accountUuid,
    };
  });

  /** POST /api/moysklad/disconnect — token o'chiriladi (sync history qoladi) */
  app.post("/disconnect", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req) => {
    const tenantId = req.session.tenantId;

    // Webhook'larni MoySklad tomonida ham o'chirish (failsoft)
    const acc = await app.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (acc && acc.webhookIds.length) {
      for (const id of acc.webhookIds) {
        await deleteMoyskladWebhook(app.prisma, tenantId, id).catch((err) => {
          app.log.warn({ err, id }, "MoySklad webhook'ni o'chirishda xato");
        });
      }
    }

    await app.prisma.moyskladAccount.deleteMany({ where: { tenantId } });
    clearMoyskladTokenCache(tenantId);
    return { ok: true };
  });

  /** POST /api/moysklad/sync — to'liq import (fonda) */
  app.post("/sync", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const tenantId = req.session.tenantId;
    const acc = await app.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (!acc || acc.status === "DISCONNECTED") {
      return reply.code(400).send({ error: "MoySklad ulanmagan" });
    }

    // Allaqachon ishlayotgan job bormi?
    const running = await app.prisma.syncJob.findFirst({
      where: { tenantId, type: "INITIAL_IMPORT", status: { in: ["QUEUED", "RUNNING"] } },
    });
    if (running) {
      return reply.code(409).send({ error: "Sync allaqachon ishlamoqda", jobId: running.id });
    }

    const job = await app.prisma.syncJob.create({
      data: { tenantId, type: "INITIAL_IMPORT", status: "QUEUED" },
    });

    // Fonda ishga tushiramiz (await emas)
    runInitialImport(app.prisma, tenantId, job.id, async (pct) => {
      await app.prisma.syncJob.update({ where: { id: job.id }, data: { progress: pct } }).catch(() => {});
    }).catch((err) => {
      app.log.error({ err, jobId: job.id }, "MoySklad initial import xato");
    });

    return reply.code(202).send({ ok: true, jobId: job.id });
  });

  /** GET /api/moysklad/sync/:jobId — joriy sync progressi */
  app.get<{ Params: { jobId: string } }>("/sync/:jobId", async (req, reply) => {
    const job = await app.prisma.syncJob.findUnique({ where: { id: req.params.jobId } });
    if (!job || job.tenantId !== req.session.tenantId) {
      return reply.code(404).send({ error: "Job topilmadi" });
    }
    return job;
  });

  /** GET /api/moysklad/sync — sync tarixi */
  app.get("/sync", async (req) => {
    const jobs = await app.prisma.syncJob.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return { jobs };
  });

  /** POST /api/moysklad/webhooks/subscribe — MoySklad'da webhook'larni ro'yxatdan o'tkazish */
  app.post("/webhooks/subscribe", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const tenantId = req.session.tenantId;
    const acc = await app.prisma.moyskladAccount.findUnique({ where: { tenantId } });
    if (!acc) return reply.code(400).send({ error: "MoySklad ulanmagan" });

    const baseUrl = process.env.PUBLIC_URL ?? `https://${process.env.DOMAIN ?? "shop-flow.uz"}`;
    const callbackUrl = `${baseUrl}/api/webhooks/moysklad/${tenantId}`;

    // Avval mavjudlarini o'chirib, qaytadan yaratamiz
    if (acc.webhookIds.length) {
      for (const id of acc.webhookIds) {
        await deleteMoyskladWebhook(app.prisma, tenantId, id).catch(() => {});
      }
    }

    const entities: Array<{ entityType: string; action: "CREATE" | "UPDATE" | "DELETE" }> = [
      { entityType: "product", action: "UPDATE" },
      { entityType: "product", action: "CREATE" },
      { entityType: "product", action: "DELETE" },
      { entityType: "customerorder", action: "UPDATE" },
      { entityType: "customerorder", action: "CREATE" },
      { entityType: "counterparty", action: "UPDATE" },
      { entityType: "counterparty", action: "CREATE" },
    ];

    const newIds: string[] = [];
    const errors: string[] = [];
    for (const e of entities) {
      try {
        const hook = await createMoyskladWebhook(app.prisma, tenantId, { ...e, url: callbackUrl });
        newIds.push(hook.id);
      } catch (err) {
        errors.push(`${e.entityType}/${e.action}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await app.prisma.moyskladAccount.update({
      where: { tenantId },
      data: { webhookIds: newIds },
    });

    return { ok: errors.length === 0, registered: newIds.length, errors };
  });

  /** GET /api/moysklad/webhooks — MoySklad tomonidagi mavjud subscription'lar */
  app.get("/webhooks", async (req, reply) => {
    const tenantId = req.session.tenantId;
    try {
      const list = await listMoyskladWebhooks(app.prisma, tenantId);
      return { webhooks: list.rows };
    } catch (err) {
      return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });
};
