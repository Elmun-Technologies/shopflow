// secret-cipher uchun unit testlar — maxfiy ma'lumotlarni shifrlash/ochish.
// Bu xavfsizlik-kritik kod: 3rd-party API tokenlari shu bilan saqlanadi.

import { describe, it, expect, beforeAll } from "vitest";

// Kalit modul yuklanishidan oldin o'rnatilishi kerak (getKey() cache qiladi)
beforeAll(() => {
  process.env.SECRETS_ENCRYPTION_KEY = "test-encryption-key-at-least-32-chars-long";
});

describe("secret-cipher", () => {
  it("shifrlangan matnni qaytarib ocha oladi (roundtrip)", async () => {
    const { encryptSecret, decryptSecret } = await import("./secret-cipher.js");
    const secret = "my-super-secret-api-token-12345";
    const encrypted = encryptSecret(secret);
    expect(encrypted).not.toBe(secret);
    expect(decryptSecret(encrypted)).toBe(secret);
  });

  it("har safar har xil shifrmatn beradi (random IV)", async () => {
    const { encryptSecret, decryptSecret } = await import("./secret-cipher.js");
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b); // IV random — shifrmatn farq qiladi
    expect(decryptSecret(a)).toBe(decryptSecret(b)); // lekin ochilgani bir xil
  });

  it("iv:tag:ciphertext formatida bo'ladi", async () => {
    const { encryptSecret } = await import("./secret-cipher.js");
    const parts = encryptSecret("x").split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/); // 12-byte IV hex
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // 16-byte tag hex
  });

  it("buzilgan shifrmatnni rad etadi (tamper detection)", async () => {
    const { encryptSecret, decryptSecret } = await import("./secret-cipher.js");
    const enc = encryptSecret("sensitive");
    const [iv, tag, data] = enc.split(":");
    // Ciphertext'ning oxirgi belgisini buzamiz
    const tampered = `${iv}:${tag}:${data.slice(0, -2)}${data.slice(-2) === "00" ? "11" : "00"}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("noto'g'ri formatni rad etadi", async () => {
    const { decryptSecret } = await import("./secret-cipher.js");
    expect(() => decryptSecret("not-a-valid-payload")).toThrow();
    expect(() => decryptSecret("only:two")).toThrow();
  });

  it("bo'sh string ham to'g'ri ishlaydi", async () => {
    const { encryptSecret, decryptSecret } = await import("./secret-cipher.js");
    expect(decryptSecret(encryptSecret(""))).toBe("");
  });

  it("unicode (kirill/emoji) saqlaydi", async () => {
    const { encryptSecret, decryptSecret } = await import("./secret-cipher.js");
    const s = "Парол 🔐 maxfiy";
    expect(decryptSecret(encryptSecret(s))).toBe(s);
  });
});
