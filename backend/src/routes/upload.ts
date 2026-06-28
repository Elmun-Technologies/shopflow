import type { FastifyPluginAsync } from "fastify";
import { mkdir, unlink, writeFile } from "node:fs/promises";
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

    // Butun faylni bufferga o'qish (MAX_SIZE=8MB bilan cheklangan).
    // for-await iterator va pipe() ni aralashtirib bo'lmaydi — stream yarim iste'mol
    // bo'lsa pipe() finish eventini olmaydi va promise hech qachon resolve bo'lmaydi.
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    if (data.file.truncated) {
      return reply.code(413).send({ error: `Rasm hajmi ${MAX_SIZE / 1024 / 1024}MB dan oshmasligi kerak` });
    }

    const fileBuffer = Buffer.concat(chunks);

    // Magic bytes tekshiruvi — Content-Type'ga ishonib bo'lmaydi
    const detectedMime = detectMagicMime(fileBuffer);
    if (!detectedMime || !ALLOWED_MIMES.has(detectedMime)) {
      return reply.code(400).send({ error: "Fayl turi mos kelmayapti (magic bytes tekshiruvi muvaffaqiyatsiz)" });
    }

    const ext = EXT_MAP[detectedMime] ?? ".jpg";
    const tenantSeg = String(req.session.tenantId).replace(/[^a-zA-Z0-9_-]/g, "");
    if (!tenantSeg) return reply.code(403).send({ error: "Tenant kontekst yo'q" });
    const tenantDir = path.join(UPLOADS_DIR, tenantSeg);
    await mkdir(tenantDir, { recursive: true });
    const filename = `${crypto.randomUUID()}${ext}`;
    const filepath = path.join(tenantDir, filename);

    try {
      await writeFile(filepath, fileBuffer);
    } catch (err) {
      unlink(filepath).catch(() => null);
      throw err;
    }

    return { url: `/uploads/${tenantSeg}/${filename}` };
  });
};
