import type { FastifyPluginAsync } from "fastify";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  await mkdir(UPLOADS_DIR, { recursive: true });
  app.addHook("preHandler", app.authenticate);

  app.post("/", async (req, reply) => {
    const data = await req.file({ limits: { fileSize: MAX_SIZE } });
    if (!data) return reply.code(400).send({ error: "Fayl topilmadi" });

    if (!ALLOWED.has(data.mimetype)) {
      // drain stream to avoid memory leak
      data.file.resume();
      return reply.code(400).send({ error: "Faqat rasm fayllari: JPEG, PNG, WebP, GIF" });
    }

    const ext = EXT_MAP[data.mimetype] ?? path.extname(data.filename) ?? ".jpg";
    const filename = `${crypto.randomUUID()}${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    await pipeline(data.file, createWriteStream(filepath));

    return { url: `/api/uploads/${filename}` };
  });
};
