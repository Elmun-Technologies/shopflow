// Bot konstruktori — per-tenant Telegram bot oqimini boshqarish.
//
// GET    /api/bot-flow              — joriy oqim (+ diagnostika)
// PUT    /api/bot-flow              — oqimni saqlash
// PATCH  /api/bot-flow/enabled      — botni yoqish/o'chirish
// GET    /api/bot-flow/templates    — tayyor shablonlar ro'yxati
// POST   /api/bot-flow/template     — shablonni qo'llash (saqlamasdan qaytaradi)
// POST   /api/bot-flow/generate     — AI brifdan oqim generatsiya qiladi
// POST   /api/bot-flow/reset-session— test paytida o'z suhbat holatini tozalash

import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  botFlowDefinitionSchema,
  findOrphanScreens,
  validateFlowRefs,
} from "../lib/bot-flow-schema.js";
import { TEMPLATE_LIST, getTemplate, type BotTemplateId } from "../lib/bot-flow-templates.js";
import { generateBotFlow } from "../lib/bot-flow-ai.js";
import { logAuditFor } from "../lib/audit.js";

const EMPTY_DEFINITION = botFlowDefinitionSchema.parse({
  screens: [
    {
      id: "main",
      name: "Bosh menyu",
      text: { uz: "Kerakli bo'limni tanlang:", ru: "Выберите нужный раздел:" },
      buttons: [],
      showBack: false,
    },
  ],
});

export const botFlowRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  /** Oqim + bot ulanish holati. */
  app.get("/", async (req) => {
    const tenantId = req.session.tenantId;

    const [row, channel, productCount] = await Promise.all([
      app.prisma.botFlow.findUnique({ where: { tenantId } }),
      app.prisma.channel.findFirst({
        where: { tenantId, type: "TELEGRAM", active: true },
        select: { id: true, name: true, config: true, webhookKey: true },
      }),
      app.prisma.product.count({ where: { tenantId, active: true } }),
    ]);

    const parsed = row ? botFlowDefinitionSchema.safeParse(row.definition) : null;
    const definition = parsed?.success ? parsed.data : EMPTY_DEFINITION;

    const cfg = (channel?.config ?? {}) as Record<string, unknown>;

    return {
      enabled: row?.enabled ?? false,
      template: row?.template ?? null,
      lastBrief: row?.lastBrief ?? null,
      updatedAt: row?.updatedAt ?? null,
      definition,
      /** Saqlangan JSON sxemaga mos kelmasa admin buni ko'rishi kerak */
      corrupted: row ? !parsed?.success : false,
      errors: parsed?.success ? validateFlowRefs(definition) : [],
      orphanScreens: parsed?.success ? findOrphanScreens(definition) : [],
      bot: {
        connected: Boolean(cfg.botToken),
        username: (cfg.botUsername as string | undefined) ?? null,
        channelId: channel?.id ?? null,
      },
      productCount,
      aiAvailable: Boolean(process.env.ANTHROPIC_API_KEY),
    };
  });

  /** Oqimni saqlash. Havola xatolari bo'lsa 400 — buzuq oqim saqlanmaydi. */
  app.put(
    "/",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const body = z
        .object({
          definition: z.unknown(),
          enabled: z.boolean().optional(),
          template: z.string().max(20).nullable().optional(),
        })
        .parse(req.body);

      const parsed = botFlowDefinitionSchema.safeParse(body.definition);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Oqim shakli noto'g'ri",
          issues: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join(".")}: ${i.message}`),
        });
      }

      const errors = validateFlowRefs(parsed.data);
      if (errors.length) {
        return reply.code(400).send({ error: "Oqimda xatolar bor", issues: errors });
      }

      const tenantId = req.session.tenantId;
      const definition = parsed.data as unknown as Prisma.InputJsonValue;

      const saved = await app.prisma.botFlow.upsert({
        where: { tenantId },
        create: {
          tenantId,
          definition,
          enabled: body.enabled ?? false,
          ...(body.template !== undefined && { template: body.template }),
        },
        update: {
          definition,
          ...(body.enabled !== undefined && { enabled: body.enabled }),
          ...(body.template !== undefined && { template: body.template }),
        },
      });

      await logAuditFor(app.prisma, req.session, {
        action: "UPDATE",
        resourceType: "bot_flow",
        resourceId: saved.id,
        summary: `Bot oqimi saqlandi — ${parsed.data.screens.length} ekran, ${parsed.data.forms.length} anketa`,
        changes: { enabled: saved.enabled },
      });

      return { ok: true, enabled: saved.enabled, updatedAt: saved.updatedAt };
    },
  );

  /** Botni yoqish/o'chirish — oqimni qayta yubormasdan. */
  app.patch(
    "/enabled",
    { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] },
    async (req, reply) => {
      const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
      const tenantId = req.session.tenantId;

      const row = await app.prisma.botFlow.findUnique({ where: { tenantId } });
      if (!row) return reply.code(404).send({ error: "Avval oqimni saqlang" });

      if (enabled) {
        const parsed = botFlowDefinitionSchema.safeParse(row.definition);
        if (!parsed.success || parsed.data.screens.length === 0) {
          return reply.code(400).send({ error: "Oqim bo'sh yoki buzuq — yoqib bo'lmaydi" });
        }
        const errors = validateFlowRefs(parsed.data);
        if (errors.length) return reply.code(400).send({ error: "Oqimda xatolar bor", issues: errors });
      }

      await app.prisma.botFlow.update({ where: { tenantId }, data: { enabled } });
      await logAuditFor(app.prisma, req.session, {
        action: "STATUS_CHANGE",
        resourceType: "bot_flow",
        resourceId: row.id,
        summary: enabled ? "Bot konstruktori yoqildi" : "Bot konstruktori o'chirildi",
      });

      return { ok: true, enabled };
    },
  );

  /** Shablonlar ro'yxati (metadata). */
  app.get("/templates", async () => ({ templates: TEMPLATE_LIST }));

  /**
   * Shablonni qaytaradi — saqlamaydi. Admin UI uni tahrirlab, keyin PUT qiladi,
   * shuning uchun "Qo'llash" tugmasi tasodifan ishni yo'q qilmaydi.
   */
  app.post("/template", async (req, reply) => {
    const { id } = z.object({ id: z.enum(["retail", "b2b", "blank"]) }).parse(req.body);
    const definition = getTemplate(id as BotTemplateId);
    const errors = validateFlowRefs(definition);
    if (errors.length) {
      // Shablon buzuq bo'lsa bu bizning bugimiz — 500 munosib
      return reply.code(500).send({ error: "Shablon buzuq", issues: errors });
    }
    return { definition, template: id };
  });

  /** AI generator — brifdan oqim. Natija saqlanmaydi, admin ko'rib tasdiqlaydi. */
  app.post(
    "/generate",
    {
      preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")],
      config: { rateLimit: { max: 10, timeWindow: "10 minutes" } },
    },
    async (req, reply) => {
      const body = z
        .object({
          brief: z.string().min(20).max(24_000),
          /** Mavjud oqimni asos qilib olish (tahrirlash rejimi) */
          useExisting: z.boolean().default(false),
        })
        .parse(req.body);

      const tenantId = req.session.tenantId;
      const [tenant, productCount, row] = await Promise.all([
        app.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
        app.prisma.product.count({ where: { tenantId, active: true } }),
        app.prisma.botFlow.findUnique({ where: { tenantId } }),
      ]);

      let existing;
      if (body.useExisting && row) {
        const parsed = botFlowDefinitionSchema.safeParse(row.definition);
        if (parsed.success) existing = parsed.data;
      }

      const result = await generateBotFlow(body.brief, {
        storeName: tenant?.name ?? "Do'kon",
        hasProducts: productCount > 0,
        existing,
      });

      if (!result.ok || !result.definition) {
        return reply.code(422).send({ error: result.reason ?? "Generatsiya muvaffaqiyatsiz" });
      }

      // Brifni saqlaymiz — keyingi generatsiyada admin uni ko'radi va tahrirlaydi
      await app.prisma.botFlow.upsert({
        where: { tenantId },
        create: { tenantId, definition: {}, lastBrief: body.brief, template: "ai" },
        update: { lastBrief: body.brief },
      });

      await logAuditFor(app.prisma, req.session, {
        action: "CREATE",
        resourceType: "bot_flow",
        resourceId: tenantId,
        summary: `AI bot oqimini generatsiya qildi — ${result.definition.screens.length} ekran, ${result.definition.forms.length} anketa`,
        changes: { briefChars: body.brief.length },
      });

      return {
        definition: result.definition,
        summary: result.summary ?? null,
        warnings: result.warnings ?? [],
      };
    },
  );

  /**
   * Test qilayotgan adminning bot suhbat holatini tozalaydi — oqimni
   * o'zgartirgandan keyin botda /start bosmasdan yangidan boshlash uchun.
   */
  app.post("/reset-session", async (req) => {
    const { chatId } = z.object({ chatId: z.union([z.number(), z.string()]) }).parse(req.body);
    const tenantId = req.session.tenantId;
    const { count } = await app.prisma.botSession.deleteMany({
      where: { tenantId, chatId: BigInt(chatId) },
    });
    return { ok: true, cleared: count };
  });
};
