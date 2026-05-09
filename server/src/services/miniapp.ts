import { createHash, createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { decrypt } from "../lib/crypto.js";

/**
 * Telegram WebApp initData validatsiyasi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export interface ValidatedInitData {
  user: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  authDate: number;
}

export function validateInitData(initData: string, botToken: string, maxAgeSec = 86400): ValidatedInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("hash yo'q");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computed !== hash) throw new Error("HMAC noto'g'ri — initData yolg'on yoki o'zgartirilgan");

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate) throw new Error("auth_date yo'q");
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > maxAgeSec) throw new Error("initData eskirgan");

  const userJson = params.get("user");
  if (!userJson) throw new Error("user yo'q");
  const user = JSON.parse(userJson) as ValidatedInitData["user"];

  return { user, authDate };
}

/** Test rejimi — agar initData bo'sh bo'lsa, faqat NODE_ENV=development'da bypass. */
export function isDevBypass(initData: string): boolean {
  return process.env.NODE_ENV !== "production" && (!initData || initData === "dev");
}

export async function authenticateMiniAppUser(input: { botId: string; initData: string }) {
  const bot = await db.query.bots.findFirst({ where: eq(schema.bots.id, input.botId) });
  if (!bot) throw new Error("Bot topilmadi");

  let tgUserId: string;
  let userInfo: ValidatedInitData["user"];

  if (isDevBypass(input.initData)) {
    tgUserId = "dev-user-1";
    userInfo = { id: 1, first_name: "Dev", username: "dev_user", language_code: "uz" };
  } else {
    const token = decrypt(bot.tokenEncrypted);
    const result = validateInitData(input.initData, token);
    tgUserId = String(result.user.id);
    userInfo = result.user;
  }

  let tgUser = await db.query.tgUsers.findFirst({
    where: and(eq(schema.tgUsers.shopId, bot.shopId), eq(schema.tgUsers.tgUserId, tgUserId)),
  });
  if (!tgUser) {
    [tgUser] = await db.insert(schema.tgUsers).values({
      shopId: bot.shopId,
      tgUserId,
      username: userInfo.username,
      firstName: userInfo.first_name,
      lastName: userInfo.last_name,
      languageCode: userInfo.language_code,
    }).returning();
  }

  const shop = await db.query.shops.findFirst({ where: eq(schema.shops.id, bot.shopId) });
  return { tgUser, shop, bot };
}

function shortHash(s: string) {
  return createHash("sha256").update(s).digest("hex").slice(0, 8);
}

export async function genOrderNumber(shopId: string) {
  const year = new Date().getFullYear();
  const tag = shortHash(shopId).slice(0, 4).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `SH-${tag}-${year}-${ts}`;
}
