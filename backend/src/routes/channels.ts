import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

const channelTypeEnum = z.enum([
  "WEBSITE",
  "LANDING_PAGE",
  "INSTAGRAM",
  "TELEGRAM",
  "FACEBOOK",
  "WHATSAPP",
  "EMAIL",
  "PHONE",
  "REFERRAL",
  "GOOGLE_ADS",
  "YANDEX_DIRECT",
  "MARKETPLACE",
  "OFFLINE",
]);

const channelSchema = z.object({
  type: channelTypeEnum,
  name: z.string().min(1).max(80),
  config: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
});

// config ichidagi maxfiy maydonlar — GET'da yashiringan qaytariladi
const SECRET_KEYS = ["botToken", "apiKey", "secret", "accessToken"];

function maskConfig(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object") return {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
    if (SECRET_KEYS.includes(key) && typeof value === "string" && value.length > 0) {
      // Oxirgi 4 belgi ko'rinadi: ●●●●●●●●●●xyzAB
      result[key] = "●".repeat(Math.max(value.length - 4, 8)) + value.slice(-4);
      result[`${key}_set`] = true;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function mergeConfig(
  existing: unknown,
  incoming: Record<string, unknown> | undefined,
): Prisma.InputJsonValue {
  const base = (existing && typeof existing === "object" ? existing : {}) as Record<string, unknown>;
  if (!incoming) return base as Prisma.InputJsonValue;

  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    // Maxfiy maydonni faqat haqiqiy qiymat bilan yangilaymiz
    // (foydalanuvchi yashiringan ko'rinishni qaytarib yuborsa, eski qiymat saqlanadi)
    if (SECRET_KEYS.includes(key)) {
      if (typeof value === "string" && value.length > 0 && !value.startsWith("●")) {
        merged[key] = value;
      }
      // bo'sh kelsa o'chiramiz
      else if (value === "" || value === null) {
        delete merged[key];
      }
    } else {
      merged[key] = value;
    }
  }
  return merged as Prisma.InputJsonValue;
}

export const channelRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (req) => {
    const channels = await app.prisma.channel.findMany({
      where: { tenantId: req.session.tenantId },
      orderBy: { createdAt: "asc" },
    });
    return channels.map((ch) => ({ ...ch, config: maskConfig(ch.config) }));
  });

  app.post("/", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req) => {
    const data = channelSchema.parse(req.body);
    const ch = await app.prisma.channel.create({
      data: {
        type: data.type,
        name: data.name,
        active: data.active,
        config: mergeConfig({}, data.config),
        tenantId: req.session.tenantId,
      },
    });
    return { ...ch, config: maskConfig(ch.config) };
  });

  app.patch("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const data = channelSchema.partial().parse(req.body);
    const ch = await app.prisma.channel.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!ch) return reply.code(404).send({ error: "Not found" });
    const updated = await app.prisma.channel.update({
      where: { id },
      data: {
        type: data.type,
        name: data.name,
        active: data.active,
        ...(data.config !== undefined && { config: mergeConfig(ch.config, data.config) }),
      },
    });
    return { ...updated, config: maskConfig(updated.config) };
  });

  app.delete("/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const ch = await app.prisma.channel.findFirst({
      where: { id, tenantId: req.session.tenantId },
    });
    if (!ch) return reply.code(404).send({ error: "Not found" });
    await app.prisma.channel.delete({ where: { id } });
    return { ok: true };
  });

  // Telegram bot uchun: setWebhook ni avtomatik bajarish
  // Token va public host'dan webhook URL'ni shakllantirib, Telegram API'ga yuboradi
  app.post(
    "/:id/telegram/setup",
    { preHandler: [app.requireRole("OWNER", "ADMIN")] },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const ch = await app.prisma.channel.findFirst({
        where: { id, tenantId: req.session.tenantId },
      });
      if (!ch) return reply.code(404).send({ error: "Channel topilmadi" });
      if (ch.type !== "TELEGRAM") {
        return reply.code(400).send({ error: "Faqat Telegram kanali uchun" });
      }
      const config = (ch.config ?? {}) as Record<string, unknown>;
      const token = config.botToken as string | undefined;
      if (!token) {
        return reply.code(400).send({ error: "Avval bot token kiriting" });
      }

      // Webhook URL — frontend yuboradi (chunki backend public hostni har doim ham bilmaydi)
      const { publicHost } = z.object({ publicHost: z.string().url() }).parse(req.body);
      const webhookUrl = `${publicHost.replace(/\/$/, "")}/api/webhooks/telegram/${ch.webhookKey}`;

      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: webhookUrl, drop_pending_updates: false }),
        });
        const json = (await res.json()) as { ok: boolean; description?: string };
        if (!json.ok) {
          return reply.code(400).send({ error: json.description || "Telegram xato qaytardi" });
        }

        // botInfo'ni olib config'ga saqlash (username, id)
        const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const meJson = (await meRes.json()) as {
          ok: boolean;
          result?: { id: number; username?: string; first_name?: string };
        };

        if (meJson.ok && meJson.result) {
          await app.prisma.channel.update({
            where: { id },
            data: {
              config: mergeConfig(ch.config, {
                botUsername: meJson.result.username,
                botId: meJson.result.id,
                botName: meJson.result.first_name,
                webhookUrl,
              }),
            },
          });
        }

        return { ok: true, webhookUrl, bot: meJson.result };
      } catch (err) {
        return reply.code(502).send({
          error: "Telegram API'ga ulanib bo'lmadi: " + (err instanceof Error ? err.message : "xato"),
        });
      }
    },
  );
};
