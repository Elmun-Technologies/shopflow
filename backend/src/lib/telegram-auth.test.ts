// Telegram Mini App initData HMAC tekshiruvi uchun testlar.
// Xavfsizlik-kritik: bu mijozning Telegram identifikatsiyasini soxtalashtirishdan himoya qiladi.

import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyTelegramInitData } from "./telegram-auth.js";

const BOT_TOKEN = "123456:TEST-BOT-TOKEN-abcdef";

// Telegram imzosini real algoritm bo'yicha yasaydigan helper
function signInitData(fields: Record<string, string>): string {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const params = new URLSearchParams(fields);
  params.set("hash", hash);
  return params.toString();
}

describe("verifyTelegramInitData", () => {
  it("to'g'ri imzolangan initData'ni qabul qiladi", () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = signInitData({
      auth_date: String(now),
      query_id: "AAH",
      user: encodeURIComponent(JSON.stringify({ id: 42, username: "aziz", first_name: "Aziz" })),
    });
    const res = verifyTelegramInitData(initData, BOT_TOKEN);
    expect(res.valid).toBe(true);
    expect(res.userId).toBe(42);
    expect(res.username).toBe("aziz");
    expect(res.firstName).toBe("Aziz");
  });

  it("buzilgan hash'ni rad etadi", () => {
    const now = Math.floor(Date.now() / 1000);
    let initData = signInitData({ auth_date: String(now), user: encodeURIComponent(JSON.stringify({ id: 1 })) });
    initData = initData.replace(/hash=[0-9a-f]+/, "hash=deadbeef");
    expect(verifyTelegramInitData(initData, BOT_TOKEN).valid).toBe(false);
  });

  it("boshqa bot token bilan imzoni rad etadi", () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = signInitData({ auth_date: String(now), user: encodeURIComponent(JSON.stringify({ id: 1 })) });
    expect(verifyTelegramInitData(initData, "999:WRONG-TOKEN").valid).toBe(false);
  });

  it("eskirgan auth_date'ni rad etadi", () => {
    const old = Math.floor(Date.now() / 1000) - 90000; // 25 soat oldin
    const initData = signInitData({ auth_date: String(old), user: encodeURIComponent(JSON.stringify({ id: 1 })) });
    expect(verifyTelegramInitData(initData, BOT_TOKEN).valid).toBe(false);
  });

  it("hash yo'q bo'lsa rad etadi", () => {
    expect(verifyTelegramInitData("auth_date=123&user=%7B%7D", BOT_TOKEN).valid).toBe(false);
  });

  it("buzilgan/bo'sh initData'da crash bermaydi", () => {
    expect(verifyTelegramInitData("", BOT_TOKEN).valid).toBe(false);
    expect(verifyTelegramInitData("garbage", BOT_TOKEN).valid).toBe(false);
  });

  it("user maydoni bo'lmasa ham valid (faqat hash to'g'ri bo'lsa)", () => {
    const now = Math.floor(Date.now() / 1000);
    const initData = signInitData({ auth_date: String(now), query_id: "X" });
    const res = verifyTelegramInitData(initData, BOT_TOKEN);
    expect(res.valid).toBe(true);
    expect(res.userId).toBeUndefined();
  });
});
