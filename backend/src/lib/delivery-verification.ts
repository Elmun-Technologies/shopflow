import { randomInt, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function createDeliveryCode(): { code: string; hash: string } {
  const code = randomInt(100_000, 1_000_000).toString();
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(code, salt, 32).toString("hex");
  return { code, hash: `${salt}:${digest}` };
}

export function verifyDeliveryCode(code: string, stored: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(code, salt, 32);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
