// 1C integratsiyasining admin API'si (JWT bilan himoyalangan).
// Almashinuvning o'zi `routes/onec-exchange.ts` da — u Basic auth ishlatadi.

import type { FastifyPluginAsync } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { encryptSecret, decryptSecret } from "../lib/secret-cipher.js";
import { logAudit } from "../lib/audit.js";

const LOGIN_RE = /^[a-zA-Z0-9._-]{4,60}$/;

const connectSchema = z.object({
  login: z.string().regex(LOGIN_RE, "Login: 4-60 belgi, faqat harf/raqam/._-").optional(),
  password: z.string().min(8).max(120).optional(),
});

const settingsSchema = z.object({
  createInactive: z.boolean(),
  importImages: z.boolean(),
  overwriteNames: z.boolean(),
});

/** 1C'ning "Обмен с сайтом" sozlamasiga kiritiladigan parol. */
function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

function exchangeUrl(): string {
  const base = process.env.PUBLIC_URL ?? `https://${process.env.DOMAIN ?? "shop-flow.uz"}`;
  return `${base.replace(/\/+$/, "")}/api/1c/exchange`;
}

export const oneCRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /** Tenant slug'idan bo'sh login tanlaydi ("1c_demo", band bo'lsa "1c_demo_a1b2"). */
  async function suggestLogin(tenantId: string): Promise<string> {
    const tenant = await app.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    const base = `1c_${(tenant?.slug ?? "shop").replace(/[^a-zA-Z0-9]/g, "").slice(0, 40) || "shop"}`;
    const taken = await app.prisma.oneCAccount.findUnique({
      where: { login: base },
      select: { tenantId: true },
    });
    if (!taken || taken.tenantId === tenantId) return base;
    return `${base}_${randomBytes(3).toString("hex")}`;
  }

  /** GET /api/1c/status — ulanish holati va oxirgi almashinuv ma'lumoti */
  app.get("/status", async (req) => {
    const tenantId = req.session.tenantId;
    const acc = await app.prisma.oneCAccount.findUnique({ where: { tenantId } });
    if (!acc) {
      return { status: "DISCONNECTED" as const, exchangeUrl: exchangeUrl() };
    }

    const [importedProducts, importedCategories, lastLog] = await Promise.all([
      app.prisma.product.count({ where: { tenantId, oneCId: { not: null } } }),
      app.prisma.category.count({ where: { tenantId, oneCId: { not: null } } }),
      app.prisma.oneCImportLog.findFirst({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      status: acc.status,
      login: acc.login,
      exchangeUrl: exchangeUrl(),
      settings: {
        createInactive: acc.createInactive,
        importImages: acc.importImages,
        overwriteNames: acc.overwriteNames,
      },
      lastExchangeAt: acc.lastExchangeAt,
      lastImportAt: acc.lastImportAt,
      lastError: acc.lastError,
      importedProducts,
      importedCategories,
      lastLog,
    };
  });

  /**
   * POST /api/1c/connect — login/parol yaratadi (yoki almashtiradi).
   * Parol javobda FAQAT shu yerda va `/credentials` da to'liq qaytariladi.
   */
  app.post("/connect", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = connectSchema.parse(req.body ?? {});
    const tenantId = req.session.tenantId;

    const login = data.login ?? (await suggestLogin(tenantId));
    const password = data.password ?? generatePassword();

    // Login global unique — boshqa tenant band qilgan bo'lsa aniq xato beramiz
    const clash = await app.prisma.oneCAccount.findUnique({
      where: { login },
      select: { tenantId: true },
    });
    if (clash && clash.tenantId !== tenantId) {
      return reply.code(409).send({ error: "Bu login band. Boshqa login tanlang." });
    }

    const acc = await app.prisma.oneCAccount.upsert({
      where: { tenantId },
      create: {
        tenantId,
        login,
        encryptedPassword: encryptSecret(password),
        status: "CONNECTED",
      },
      update: {
        login,
        encryptedPassword: encryptSecret(password),
        status: "CONNECTED",
        lastError: null,
      },
    });

    await logAudit({
      prisma: app.prisma,
      tenantId,
      actorId: req.session.userId,
      action: "ONEC_CONNECTED",
      resourceType: "integration",
      resourceId: "1c",
      summary: `1C almashinuv hisobi yaratildi/yangilandi: ${login}`,
    });

    return {
      ok: true,
      status: acc.status,
      login: acc.login,
      password,
      exchangeUrl: exchangeUrl(),
    };
  });

  /** POST /api/1c/credentials — parolni qayta ko'rsatish (audit qilinadi) */
  app.post("/credentials", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const tenantId = req.session.tenantId;
    const acc = await app.prisma.oneCAccount.findUnique({ where: { tenantId } });
    if (!acc) return reply.code(400).send({ error: "1C ulanmagan" });

    let password: string;
    try {
      password = decryptSecret(acc.encryptedPassword);
    } catch {
      return reply
        .code(500)
        .send({ error: "Parolni ochib bo'lmadi — qaytadan ulang (parol yangilanadi)." });
    }

    await logAudit({
      prisma: app.prisma,
      tenantId,
      actorId: req.session.userId,
      action: "ONEC_CREDENTIALS_VIEWED",
      resourceType: "integration",
      resourceId: "1c",
      summary: "1C almashinuv paroli ko'rildi",
    });

    return { login: acc.login, password, exchangeUrl: exchangeUrl() };
  });

  /** POST /api/1c/settings — import xulq-atvori sozlamalari */
  app.post("/settings", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = settingsSchema.parse(req.body);
    const tenantId = req.session.tenantId;
    const acc = await app.prisma.oneCAccount.findUnique({
      where: { tenantId },
      select: { id: true },
    });
    if (!acc) return reply.code(400).send({ error: "1C ulanmagan" });

    await app.prisma.oneCAccount.update({ where: { tenantId }, data });
    return { ok: true };
  });

  /** POST /api/1c/disconnect — almashinuv hisobini o'chirish */
  app.post("/disconnect", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req) => {
    const tenantId = req.session.tenantId;
    // Import qilingan mahsulotlar qoladi — faqat almashinuv to'xtaydi.
    await app.prisma.oneCAccount.deleteMany({ where: { tenantId } });
    await logAudit({
      prisma: app.prisma,
      tenantId,
      actorId: req.session.userId,
      action: "ONEC_DISCONNECTED",
      resourceType: "integration",
      resourceId: "1c",
      summary: "1C almashinuvi uzildi",
    });
    return { ok: true };
  });

  /** GET /api/1c/logs — oxirgi importlar tarixi */
  app.get("/logs", async (req) => {
    const logs = await app.prisma.oneCImportLog.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return { logs };
  });
};
