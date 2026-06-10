// Email yuborish — SMTP credentials env'da bo'lsa ishlaydi, aks holda silent skip.
// Gmail App Password, SendGrid, Mailgun, o'z SMTP — istalganini qo'llab-quvvatlaydi.

import nodemailer, { type Transporter } from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST ?? "";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER ?? "";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;
const SMTP_SECURE = process.env.SMTP_SECURE === "true"; // 465 uchun true

let transporter: Transporter | null = null;
let configured = false;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  try {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    configured = true;
  } catch {
    /* config xato — silent */
  }
}

export function isEmailConfigured(): boolean {
  return configured;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}

/**
 * Email yuboradi. Configured bo'lmasa { ok: false, reason: 'not_configured' }.
 * Fire-and-forget rejimda ishlatish mumkin (throw qilmaydi).
 */
export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; reason?: string }> {
  if (!transporter || !configured) return { ok: false, reason: "not_configured" };
  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: Array.isArray(msg.to) ? msg.to.join(", ") : msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: msg.attachments,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}

/** SMTP ulanishni tekshirish (Settings'dagi "Test" tugmasi uchun). */
export async function verifyEmailConnection(): Promise<{ ok: boolean; reason?: string }> {
  if (!transporter || !configured) return { ok: false, reason: "not_configured" };
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "unknown" };
  }
}
