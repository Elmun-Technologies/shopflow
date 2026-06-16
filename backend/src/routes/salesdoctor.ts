// Sales Doctor integratsiya endpoint'lari.
// /api/salesdoctor/connect|disconnect|test|references|defaults|status|push-order|pull-catalog

import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { loginToSalesDoctor, SalesDoctorClient, SalesDoctorError } from "../lib/salesdoctor-client.js";
import { encryptSecret, decryptSecret } from "../lib/secret-cipher.js";
import { pushOrderToSalesDoctor, normalizePhone } from "../lib/salesdoctor-push.js";
import { logAudit } from "../lib/audit.js";
import { uniqueProductSlug } from "../lib/slug.js";

const connectSchema = z.object({
  domain: z.string().min(3).max(200),
  login: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});

const defaultsSchema = z.object({
  defaultAgentSdId: z.string().min(1),
  defaultPriceTypeSdId: z.string().min(1),
  defaultWarehouseSdId: z.string().min(1),
  statusMap: z.record(z.string(), z.number().int().min(1).max(5)).optional().nullable(),
});

async function getClientForTenant(prisma: import("@prisma/client").PrismaClient, tenantId: string): Promise<SalesDoctorClient | null> {
  const acc = await prisma.salesDoctorAccount.findUnique({ where: { tenantId } });
  if (!acc || !acc.userId || !acc.encryptedToken) return null;
  try {
    const token = decryptSecret(acc.encryptedToken);
    return new SalesDoctorClient(acc.domain, acc.userId, token);
  } catch {
    return null;
  }
}

export const salesDoctorRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /** GET /api/salesdoctor/status — ulanish holati va statistika */
  app.get("/status", async (req) => {
    const tenantId = req.session.tenantId;
    const acc = await app.prisma.salesDoctorAccount.findUnique({ where: { tenantId } });
    if (!acc) {
      return { status: "DISCONNECTED" as const };
    }

    const [pending, failed] = await Promise.all([
      app.prisma.salesDoctorRetry.count({ where: { tenantId, status: "PENDING" } }),
      app.prisma.salesDoctorRetry.count({ where: { tenantId, status: "FAILED" } }),
    ]);

    return {
      status: acc.status,
      domain: acc.domain,
      login: acc.login,
      lastSyncAt: acc.lastSyncAt,
      lastError: acc.lastError,
      defaults: {
        agentSdId: acc.defaultAgentSdId,
        priceTypeSdId: acc.defaultPriceTypeSdId,
        warehouseSdId: acc.defaultWarehouseSdId,
      },
      statusMap: acc.statusMap,
      pendingRetries: pending,
      failedRetries: failed,
    };
  });

  /** POST /api/salesdoctor/connect — login + password orqali ulanish */
  app.post("/connect", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = connectSchema.parse(req.body);
    const tenantId = req.session.tenantId;

    let loginResult: { userId: string; token: string };
    try {
      loginResult = await loginToSalesDoctor(data.domain, data.login, data.password);
    } catch (err) {
      const reason = err instanceof SalesDoctorError ? err.message : (err as Error).message;
      return reply.code(400).send({ error: "Sales Doctor login muvaffaqiyatsiz", detail: reason });
    }

    const encryptedPassword = encryptSecret(data.password);
    const encryptedToken = encryptSecret(loginResult.token);

    const acc = await app.prisma.salesDoctorAccount.upsert({
      where: { tenantId },
      create: {
        tenantId,
        domain: data.domain,
        login: data.login,
        encryptedPassword,
        encryptedToken,
        userId: loginResult.userId,
        status: "CONNECTED",
        lastError: null,
      },
      update: {
        domain: data.domain,
        login: data.login,
        encryptedPassword,
        encryptedToken,
        userId: loginResult.userId,
        status: "CONNECTED",
        lastError: null,
      },
    });

    await logAudit({
      prisma: app.prisma,
      tenantId,
      actorId: req.session.userId,
      action: "SD_CONNECTED",
      resourceType: "integration",
      resourceId: "salesdoctor",
      summary: `Sales Doctor ulandi: ${data.domain}`,
    });

    return { ok: true, status: acc.status, domain: acc.domain };
  });

  /** POST /api/salesdoctor/test — joriy token bilan getAgent chaqirish */
  app.post("/test", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const client = await getClientForTenant(app.prisma, req.session.tenantId);
    if (!client) return reply.code(400).send({ error: "Ulanmagan" });
    try {
      const agents = await client.getAgents();
      return { ok: true, agentCount: agents.length };
    } catch (err) {
      const reason = err instanceof SalesDoctorError ? err.message : (err as Error).message;
      return reply.code(400).send({ error: "Test muvaffaqiyatsiz", detail: reason });
    }
  });

  /** GET /api/salesdoctor/references — agent/priceType/warehouse ro'yxati */
  app.get("/references", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const client = await getClientForTenant(app.prisma, req.session.tenantId);
    if (!client) return reply.code(400).send({ error: "Ulanmagan" });
    try {
      const [agents, priceTypes, warehouses] = await Promise.all([
        client.getAgents().catch(() => []),
        client.getPriceTypes().catch(() => []),
        client.getWarehouses().catch(() => []),
      ]);
      return {
        agents: agents.map((a) => ({ id: a.SD_id, name: a.name })),
        priceTypes: priceTypes.map((p) => ({ id: p.SD_id, name: p.name })),
        warehouses: warehouses.map((w) => ({ id: w.SD_id, name: w.name })),
      };
    } catch (err) {
      const reason = err instanceof SalesDoctorError ? err.message : (err as Error).message;
      return reply.code(400).send({ error: "References olinmadi", detail: reason });
    }
  });

  /** POST /api/salesdoctor/defaults — defaultAgentSdId va boshqalarni saqlash */
  app.post("/defaults", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = defaultsSchema.parse(req.body);
    const tenantId = req.session.tenantId;
    const acc = await app.prisma.salesDoctorAccount.findUnique({ where: { tenantId } });
    if (!acc) return reply.code(400).send({ error: "Ulanmagan" });

    await app.prisma.salesDoctorAccount.update({
      where: { tenantId },
      data: {
        defaultAgentSdId: data.defaultAgentSdId,
        defaultPriceTypeSdId: data.defaultPriceTypeSdId,
        defaultWarehouseSdId: data.defaultWarehouseSdId,
        statusMap: data.statusMap == null
          ? Prisma.JsonNull
          : (data.statusMap as Prisma.InputJsonValue),
      },
    });
    return { ok: true };
  });

  /** POST /api/salesdoctor/disconnect — hisobni o'chirish */
  app.post("/disconnect", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req) => {
    const tenantId = req.session.tenantId;
    await app.prisma.salesDoctorAccount.deleteMany({ where: { tenantId } });
    await logAudit({
      prisma: app.prisma,
      tenantId,
      actorId: req.session.userId,
      action: "SD_DISCONNECTED",
      resourceType: "integration",
      resourceId: "salesdoctor",
      summary: "Sales Doctor uzildi",
    });
    return { ok: true };
  });

  /** POST /api/salesdoctor/push-order/:orderId — buyurtmani qo'lda push */
  app.post<{ Params: { orderId: string } }>("/push-order/:orderId", {
    preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")],
  }, async (req, reply) => {
    const order = await app.prisma.order.findFirst({
      where: { id: req.params.orderId, tenantId: req.session.tenantId },
      select: { id: true },
    });
    if (!order) return reply.code(404).send({ error: "Buyurtma topilmadi" });

    await pushOrderToSalesDoctor(app.prisma, req.session.tenantId, order.id);
    return { ok: true };
  });

  /** POST /api/salesdoctor/pull-catalog — SD'dan mahsulot va mijozlarni import */
  app.post("/pull-catalog", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const client = await getClientForTenant(app.prisma, req.session.tenantId);
    if (!client) return reply.code(400).send({ error: "Ulanmagan" });
    const tenantId = req.session.tenantId;

    let customersLinked = 0;
    let customersCreated = 0;
    let productsLinked = 0;
    let productsCreated = 0;

    // 1. Mijozlarni olib kelish — phone bo'yicha match
    try {
      const sdClients = await client.getClients({ limit: 1000 });
      for (const sd of sdClients) {
        const phone = normalizePhone(sd.phone);
        const existing = phone
          ? await app.prisma.customer.findFirst({
              where: { tenantId, phone: { contains: phone } },
              select: { id: true, salesDoctorId: true },
            })
          : null;
        if (existing) {
          if (!existing.salesDoctorId) {
            try {
              await app.prisma.customer.update({
                where: { id: existing.id },
                data: { salesDoctorId: sd.SD_id },
              });
              customersLinked++;
            } catch {
              // unique conflict — skip
            }
          }
        } else if (sd.name) {
          try {
            await app.prisma.customer.create({
              data: {
                tenantId,
                name: sd.name,
                phone: sd.phone ?? null,
                location: sd.address ?? null,
                salesDoctorId: sd.SD_id,
              },
            });
            customersCreated++;
          } catch {
            // unique conflict — skip
          }
        }
      }
    } catch (err) {
      app.log.warn({ err }, "SD pull customers failed");
    }

    // 2. Mahsulotlarni olib kelish — SKU/code_1C bo'yicha match
    try {
      const sdProducts = await client.getProducts({ limit: 1000 });
      for (const sd of sdProducts) {
        const sku = sd.code_1C ?? sd.SD_id;
        const existing = await app.prisma.product.findFirst({
          where: { tenantId, OR: [{ sku }, { salesDoctorId: sd.SD_id }] },
          select: { id: true, salesDoctorId: true },
        });
        if (existing) {
          if (!existing.salesDoctorId) {
            try {
              await app.prisma.product.update({
                where: { id: existing.id },
                data: { salesDoctorId: sd.SD_id },
              });
              productsLinked++;
            } catch {
              // skip
            }
          }
        } else if (sd.name && sku) {
          try {
            const slug = await uniqueProductSlug(app.prisma, tenantId, sd.name);
            await app.prisma.product.create({
              data: {
                tenantId,
                sku,
                slug,
                name: sd.name,
                price: 0,
                currency: "UZS",
                stock: 0,
                active: true,
                salesDoctorId: sd.SD_id,
              },
            });
            productsCreated++;
          } catch {
            // skip — unique conflict bo'lishi mumkin
          }
        }
      }
    } catch (err) {
      app.log.warn({ err }, "SD pull products failed");
    }

    await app.prisma.salesDoctorAccount.update({
      where: { tenantId },
      data: { lastSyncAt: new Date() },
    });

    await logAudit({
      prisma: app.prisma,
      tenantId,
      actorId: req.session.userId,
      action: "SD_PULL_CATALOG",
      resourceType: "integration",
      resourceId: "salesdoctor",
      summary: `Pull: ${customersLinked} link + ${customersCreated} yangi mijoz; ${productsLinked} link + ${productsCreated} yangi mahsulot`,
    });

    return reply.send({
      ok: true,
      customers: { linked: customersLinked, created: customersCreated },
      products: { linked: productsLinked, created: productsCreated },
    });
  });

  /** GET /api/salesdoctor/retries — failed/pending ro'yxati (debug uchun) */
  app.get("/retries", async (req) => {
    const retries = await app.prisma.salesDoctorRetry.findMany({
      where: { tenantId: req.session.tenantId, status: { in: ["PENDING", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, resourceType: true, resourceId: true, method: true,
        status: true, attempts: true, lastError: true, nextAttemptAt: true, createdAt: true,
      },
    });
    return { items: retries };
  });
};
