import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

let keyCache: Buffer | null = null;

function getKey(): Buffer {
  if (keyCache) return keyCache;
  const secret = process.env.SECRETS_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SECRETS_ENCRYPTION_KEY (yoki JWT_SECRET) kamida 32 belgi bo'lishi kerak");
  }
  keyCache = scryptSync(secret, "shopflow-secrets-v1", 32);
  return keyCache;
}

/** AES-256-GCM bilan shifrlaydi, "iv:authTag:ciphertext" hex string qaytaradi. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Buzilgan shifr formati");
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) throw new Error("Buzilgan iv/tag o'lchamlari");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}
