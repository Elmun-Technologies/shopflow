// Email transport. Tenant SMTP credential platform env fallback'dan ustun.
import nodemailer, { type Transporter } from "nodemailer";
import type { PrismaClient } from "@prisma/client";
import { getTenantSecrets } from "./tenant-secrets.js";

const envConfig = {
  host: process.env.SMTP_HOST ?? "", port: Number(process.env.SMTP_PORT ?? 587), user: process.env.SMTP_USER ?? "",
  pass: process.env.SMTP_PASS ?? "", from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "", secure: process.env.SMTP_SECURE === "true",
};
let transporter: Transporter | null = envConfig.host && envConfig.user && envConfig.pass
  ? nodemailer.createTransport({ host: envConfig.host, port: envConfig.port, secure: envConfig.secure, auth: { user: envConfig.user, pass: envConfig.pass } }) : null;

export function isEmailConfigured(): boolean { return Boolean(transporter); }
export interface EmailMessage { to: string | string[]; subject: string; html?: string; text?: string; attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }> }

async function sendWith(transport: Transporter | null, from: string, msg: EmailMessage): Promise<{ ok: boolean; reason?: string }> {
  if (!transport) return { ok: false, reason: "not_configured" };
  try { await transport.sendMail({ from, to: Array.isArray(msg.to) ? msg.to.join(", ") : msg.to, subject: msg.subject, html: msg.html, text: msg.text, attachments: msg.attachments }); return { ok: true }; }
  catch (err) { return { ok: false, reason: err instanceof Error ? err.message : "unknown" }; }
}
export async function sendEmail(msg: EmailMessage) { return sendWith(transporter, envConfig.from, msg); }
export async function verifyEmailConnection(): Promise<{ ok: boolean; reason?: string }> {
  if (!transporter) return { ok: false, reason: "not_configured" };
  try { await transporter.verify(); return { ok: true }; } catch (err) { return { ok: false, reason: err instanceof Error ? err.message : "unknown" }; }
}

async function tenantTransport(prisma: PrismaClient, tenantId: string): Promise<{ transport: Transporter | null; from: string }> {
  const value = await getTenantSecrets(prisma, tenantId, ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "SMTP_SECURE"]);
  const host = value.SMTP_HOST ?? envConfig.host; const user = value.SMTP_USER ?? envConfig.user; const pass = value.SMTP_PASS ?? envConfig.pass;
  if (!host || !user || !pass) return { transport: null, from: value.SMTP_FROM ?? envConfig.from };
  return { transport: nodemailer.createTransport({ host, port: Number(value.SMTP_PORT ?? envConfig.port), secure: (value.SMTP_SECURE ?? String(envConfig.secure)) === "true", auth: { user, pass } }), from: value.SMTP_FROM ?? envConfig.from ?? user };
}
export async function isTenantEmailConfigured(prisma: PrismaClient, tenantId: string): Promise<boolean> { return Boolean((await tenantTransport(prisma, tenantId)).transport); }
export async function sendTenantEmail(prisma: PrismaClient, tenantId: string, msg: EmailMessage) { const config = await tenantTransport(prisma, tenantId); return sendWith(config.transport, config.from, msg); }
export async function verifyTenantEmailConnection(prisma: PrismaClient, tenantId: string): Promise<{ ok: boolean; reason?: string }> {
  const { transport } = await tenantTransport(prisma, tenantId); if (!transport) return { ok: false, reason: "not_configured" };
  try { await transport.verify(); return { ok: true }; } catch (err) { return { ok: false, reason: err instanceof Error ? err.message : "unknown" }; }
}
