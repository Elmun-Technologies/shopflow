import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class SecretCipher {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new Error("Expected 32-byte (256-bit) encryption key");
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString("hex")}.${tag.toString("hex")}.${ct.toString("base64")}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(".");
    if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Invalid encrypted secret");
    const iv = Buffer.from(parts[1]!, "hex");
    const tag = Buffer.from(parts[2]!, "hex");
    const ct = Buffer.from(parts[3]!, "base64");
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  }
}
