import type { FastifyPluginAsync } from "fastify";
import { Readable } from "node:stream";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// Magic bytes — real fayl turini aniqlash uchun
const MAGIC: Array<{ bytes: number[]; mime: string }> = [
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: "image/png" },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: "image/gif" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp" }, // RIFF (WebP)
];

function detectMagicMime(buf: Buffer): string | null {
  for (const sig of MAGIC) {
    if (sig.bytes.every((b, i) => buf[i] === b)) return sig.mime;
  }
  return null;
}

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  await mkdir(UPLOADS_DIR, { recursive: true });
  app.addHook("preHandler", app.authenticate);

  app.post("/", async (req, reply) => {
    const data = await req.file({ limits: { fileSize: MAX_SIZE } });
    if (!data) return reply.code(400).send({ error: "Fayl topilmadi" });

    if (!ALLOWED_MIMES.has(data.mimetype)) {
      data.file.resume();
      return reply.code(400).send({ error: "Faqat rasm fayllari: JPEG, PNG, WebP, GIF" });
    }

    // Magic bytes ni tekshirish — aslida mos kelmaydigan faylni rad etish
    const chunks: Buffer[] = [];
    const headerSize = 12;
    let consumed = 0;
    for await (const chunk of data.file) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      consumed += chunk.length;
      if (consumed >= headerSize) break;
    }

    const header = Buffer.concat(chunks);
    const detectedMime = detectMagicMime(header);

    if (!detectedMime || !ALLOWED_MIMES.has(detectedMime)) {
      // Stream bo'sh qolmasligi uchun to'liq o'qib tashlash
      for await (const _ of data.file) { /* drain */ }
      return reply.code(400).send({ error: "Fayl turi mos kelmayapti (magic bytes tekshiruvi muvaffaqiyatsiz)" });
    }

    const ext = EXT_MAP[detectedMime] ?? ".jpg";
    const filename = `${crypto.randomUUID()}${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    // Header qismi + qolgan stream ni birlashtirish
    const headStream = Readable.from(header);
    const writeStream = createWriteStream(filepath);

    try {
      await new Promise<void>((resolve, reject) => {
        writeStream.on("error", reject);
        writeStream.on("finish", resolve);
        headStream.pipe(writeStream, { end: false });
        headStream.on("end", () => {
          data.file.pipe(writeStream);
        });
        data.file.on("error", reject);
      });
    } catch (err) {
      // Yozish muvaffaqiyatsiz bo'lsa — faylni tozalash
      unlink(filepath).catch(() => null);
      throw err;
    }

    return { url: `/uploads/${filename}` };
  });
};
