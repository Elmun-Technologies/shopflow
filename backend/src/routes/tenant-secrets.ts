import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { encryptSecret, decryptSecret } from "../lib/secret-cipher.js";
import { TENANT_CREDENTIALS, isTenantCredentialKey } from "../lib/tenant-secrets.js";
import { logAuditFor } from "../lib/audit.js";

export const tenantSecretRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/runtime", async (req) => {
    const keys = Object.entries(TENANT_CREDENTIALS).filter(([, meta]) => "exposable" in meta && meta.exposable).map(([key]) => key);
    const rows = await app.prisma.tenantSecret.findMany({ where: { tenantId: req.session.tenantId, key: { in: keys } }, select: { key: true, encryptedValue: true } });
    return Object.fromEntries(rows.flatMap((row) => { try { return [[row.key, decryptSecret(row.encryptedValue)]]; } catch { return []; } }));
  });

  app.get("/", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req) => {
    const rows = await app.prisma.tenantSecret.findMany({ where: { tenantId: req.session.tenantId }, select: { key: true, encryptedValue: true, updatedAt: true, updatedById: true } });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return Object.entries(TENANT_CREDENTIALS).map(([key, meta]) => {
      const row = byKey.get(key); let value: string | null = null;
      if (row && !meta.secret) { try { value = decryptSecret(row.encryptedValue); } catch { value = null; } }
      return { key, ...meta, configured: Boolean(row), value, maskedValue: row && meta.secret ? "••••••••" : null, updatedAt: row?.updatedAt ?? null };
    });
  });

  app.put<{ Params: { key: string } }>("/:key", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    if (!isTenantCredentialKey(req.params.key)) return reply.code(400).send({ error: "Bu kalit tenant darajasida boshqarilmaydi" });
    const { value } = z.object({ value: z.string().trim().min(1).max(10_000) }).parse(req.body);
    if (req.params.key === "AI_PROVIDER" && !["openai", "anthropic"].includes(value.toLowerCase())) return reply.code(400).send({ error: "AI provider openai yoki anthropic bo'lishi kerak" });
    if (req.params.key === "SMTP_PORT" && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)) return reply.code(400).send({ error: "SMTP port noto'g'ri" });
    if (req.params.key === "SMTP_SECURE" && !["true", "false"].includes(value.toLowerCase())) return reply.code(400).send({ error: "SMTP TLS true yoki false bo'lishi kerak" });
    const row = await app.prisma.tenantSecret.upsert({
      where: { tenantId_key: { tenantId: req.session.tenantId, key: req.params.key } },
      create: { tenantId: req.session.tenantId, key: req.params.key, encryptedValue: encryptSecret(value), updatedById: req.session.userId },
      update: { encryptedValue: encryptSecret(value), updatedById: req.session.userId },
      select: { key: true, updatedAt: true },
    });
    await logAuditFor(app.prisma, req.session, { action: "UPDATE", resourceType: "tenant_secret", resourceId: req.params.key, summary: `${TENANT_CREDENTIALS[req.params.key].label} yangilandi` });
    return { ...row, configured: true };
  });

  app.delete<{ Params: { key: string } }>("/:key", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    if (!isTenantCredentialKey(req.params.key)) return reply.code(400).send({ error: "Noto'g'ri kalit" });
    await app.prisma.tenantSecret.deleteMany({ where: { tenantId: req.session.tenantId, key: req.params.key } });
    await logAuditFor(app.prisma, req.session, { action: "DELETE", resourceType: "tenant_secret", resourceId: req.params.key, summary: `${TENANT_CREDENTIALS[req.params.key].label} o'chirildi` });
    return { ok: true };
  });
};
