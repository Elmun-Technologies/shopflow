// 1C «Обмен с сайтом» endpointi — 1C BIZGA ulanadi (Basic auth).
//
// 1C on-prem va odatda NAT ortida turadi, shuning uchun tortib olish (pull)
// imkonsiz. Protokol (CommerceML 2, Bitrix `1c_exchange.php` bilan bir xil):
//
//   GET  ?type=catalog&mode=checkauth  → "success\n<cookie nomi>\n<cookie qiymati>"
//   GET  ?type=catalog&mode=init       → "zip=no\nfile_limit=<bayt>"
//   POST ?type=catalog&mode=file&filename=import.xml     → fayl bo'lagi
//   GET  ?type=catalog&mode=import&filename=import.xml   → "progress\n…" | "success"
//
// 1C `progress` javobini olsa AYNAN SHU so'rovni qaytaradi — shu tufayli katta
// katalogni timeout'siz bo'lakma-bo'lak import qilamiz.
//
// 1C'dagi sozlama: Администрирование → Обмен с сайтом → «Узел обмена»,
// URL: https://<domen>/api/1c/exchange

import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { decryptSecret } from "../lib/secret-cipher.js";
import {
  ONEC_COOKIE_NAME,
  appendStagedChunk,
  credentialFingerprint,
  issueSessionToken,
  parseBasicAuth,
  readSessionCookie,
  resetStaging,
  verifySessionToken,
} from "../lib/onec-exchange.js";
import { clearImportCache, runCatalogImportStep } from "../lib/onec-import.js";
import { isCatalogFilename } from "../lib/onec-commerceml.js";

/** 1C bitta `mode=file` so'rovida yuboradigan maksimal bo'lak. */
const FILE_LIMIT = 20 * 1024 * 1024; // 20 MB
/** Fastify body cheklovi — FILE_LIMIT'dan biroz kattaroq bo'lishi shart. */
const BODY_LIMIT = 25 * 1024 * 1024;

interface ExchangeQuery {
  type?: string;
  mode?: string;
  filename?: string;
}

/**
 * Javob matnini ASCII'ga keltiradi. 1C platformasining eski versiyalari
 * javobni windows-1251 deb o'qiydi — ASCII ikkala kodlashda ham bir xil,
 * shuning uchun xato matnlari hech qachon buzilmaydi.
 */
function toAscii(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(new RegExp("[^\\u0020-\\u007e\\n]", "g"), "?");
}

function textReply(reply: FastifyReply, body: string, code = 200): FastifyReply {
  return reply
    .code(code)
    .header("Content-Type", "text/plain; charset=utf-8")
    .header("Cache-Control", "no-store")
    .send(toAscii(body));
}

function failure(reply: FastifyReply, message: string, code = 200): FastifyReply {
  return textReply(reply, `failure\n${message}`, code);
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export const oneCExchangeRoutes: FastifyPluginAsync = async (app) => {
  // 1C faylni xom holda (octet-stream / text/xml / hech qanday turisiz) yuboradi.
  // Bu parserlar faqat shu plagin ichida amal qiladi.
  app.removeContentTypeParser(["application/json", "text/plain"]);
  app.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: BODY_LIMIT }, (_req, body, done) => {
    done(null, body);
  });

  /**
   * So'rovni autentifikatsiya qiladi: avval sessiya cookie'si (checkauth'dan
   * keyin), bo'lmasa HTTP Basic. tenantId qaytaradi.
   */
  const authenticate = async (
    headers: Record<string, unknown>,
  ): Promise<{ tenantId: string; encryptedPassword: string } | { error: string }> => {
    const session = verifySessionToken(readSessionCookie(headers.cookie as string | undefined));
    if (session) {
      const acc = await app.prisma.oneCAccount.findUnique({
        where: { tenantId: session.tenantId },
        select: { tenantId: true, encryptedPassword: true },
      });
      // Cookie credential "versiyasi"ga bog'langan: parol almashtirilsa yoki
      // hisob o'chirilib qayta yaratilsa, eski cookie darhol kuchini yo'qotadi.
      if (acc && safeEqual(session.fingerprint, credentialFingerprint(acc.encryptedPassword))) {
        return { tenantId: acc.tenantId, encryptedPassword: acc.encryptedPassword };
      }
    }

    const basic = parseBasicAuth(headers.authorization as string | undefined);
    if (!basic) return { error: "Auth required" };

    const acc = await app.prisma.oneCAccount.findUnique({
      where: { login: basic.login },
      select: { tenantId: true, encryptedPassword: true },
    });
    if (!acc) return { error: "Invalid login or password" };

    let expected: string;
    try {
      expected = decryptSecret(acc.encryptedPassword);
    } catch {
      return { error: "Stored credential is unreadable, please reconnect in admin panel" };
    }
    if (!safeEqual(basic.password, expected)) return { error: "Invalid login or password" };
    return { tenantId: acc.tenantId, encryptedPassword: acc.encryptedPassword };
  };

  const handler = async (
    req: { query: ExchangeQuery; headers: Record<string, unknown>; body?: unknown; method: string },
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const type = String(req.query.type ?? "").toLowerCase();
    const mode = String(req.query.mode ?? "").toLowerCase();
    const filename = req.query.filename ? String(req.query.filename) : "";

    const auth = await authenticate(req.headers);
    if ("error" in auth) {
      reply.header("WWW-Authenticate", 'Basic realm="ShopFlow 1C"');
      return failure(reply, auth.error, 401);
    }
    const { tenantId } = auth;

    // ── checkauth: sessiya cookie'sini beramiz ──────────────────────────
    if (mode === "checkauth") {
      await touch(tenantId);
      const token = issueSessionToken(tenantId, auth.encryptedPassword);
      return textReply(reply, `success\n${ONEC_COOKIE_NAME}\n${token}`);
    }

    // ── Buyurtma bosqichi (type=sale) — hozircha eksport qilinmaydi ─────
    // Katalog qamrovidan tashqarida. `mode=query` da bo'sh, lekin YAROQLI
    // CommerceML hujjati qaytaramiz: shunda 1C tomonida almashinuv xatosiz
    // yakunlanadi ("0 ta buyurtma"), operator xato oynasini ko'rmaydi.
    if (type === "sale") {
      if (mode === "query") {
        return reply
          .code(200)
          .header("Content-Type", "text/xml; charset=utf-8")
          .header("Cache-Control", "no-store")
          .send(
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
              '<КоммерческаяИнформация ВерсияСхемы="2.05" ДатаФормирования="' +
              new Date().toISOString().slice(0, 19) +
              '"></КоммерческаяИнформация>',
          );
      }
      if (mode === "init") {
        return textReply(reply, `zip=no\nfile_limit=${FILE_LIMIT}`);
      }
      return textReply(reply, "success");
    }

    // ── Katalog bosqichi ────────────────────────────────────────────────
    switch (mode) {
      case "init": {
        await touch(tenantId);
        clearImportCache(tenantId);
        try {
          await resetStaging(tenantId);
        } catch (err) {
          app.log.error({ err, tenantId }, "1C staging tozalanmadi");
          return failure(reply, "Staging directory error");
        }
        return textReply(reply, `zip=no\nfile_limit=${FILE_LIMIT}`);
      }

      case "file": {
        if (!filename) return failure(reply, "filename parameter is required");
        const chunk = Buffer.isBuffer(req.body) ? req.body : null;
        if (!chunk || chunk.length === 0) return failure(reply, "Empty body");

        const res = await appendStagedChunk(tenantId, filename, chunk);
        if (!res.ok) {
          app.log.warn({ tenantId, filename, error: res.error }, "1C fayl saqlanmadi");
          return failure(reply, `File write error: ${res.error}`);
        }
        return textReply(reply, "success");
      }

      case "import": {
        if (!filename) return failure(reply, "filename parameter is required");
        await touch(tenantId);

        const acc = await app.prisma.oneCAccount.findUnique({ where: { tenantId } });
        if (!acc) return failure(reply, "Integration is not configured");

        // offers.xml (narx/qoldiq) hozircha qo'llanmaydi — qabul qilamiz,
        // lekin operator ko'rishi uchun jurnalga yozamiz.
        if (!isCatalogFilename(filename)) {
          await app.prisma.oneCImportLog.create({
            data: {
              tenantId,
              filename,
              ok: true,
              message:
                "Fayl qabul qilindi, lekin qo'llanmadi — narx va qoldiq sinxroni (offers.xml) hozircha yoqilmagan.",
            },
          }).catch(() => {});
          return textReply(reply, "success");
        }

        try {
          const step = await runCatalogImportStep(app.prisma, tenantId, filename, {
            createInactive: acc.createInactive,
            importImages: acc.importImages,
            overwriteNames: acc.overwriteNames,
          });

          if (!step.done) {
            // 1C shu so'rovni qaytadan yuboradi — keyingi bo'lakni olamiz
            return textReply(reply, `progress\nImported ${step.processed} of ${step.total}`);
          }

          const s = step.stats;
          await app.prisma.oneCImportLog.create({
            data: {
              tenantId,
              filename,
              ok: true,
              message: step.warnings.length ? step.warnings.slice(0, 20).join("; ") : null,
              categoriesCreated: s.categoriesCreated,
              categoriesUpdated: s.categoriesUpdated,
              productsCreated: s.productsCreated,
              productsUpdated: s.productsUpdated,
              productsHidden: s.productsHidden,
              imagesImported: s.imagesImported,
              durationMs: step.durationMs,
            },
          }).catch(() => {});

          await app.prisma.oneCAccount.update({
            where: { tenantId },
            data: { lastImportAt: new Date(), status: "CONNECTED", lastError: null },
          }).catch(() => {});

          return textReply(reply, "success");
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          app.log.error({ err, tenantId, filename }, "1C import xatosi");
          clearImportCache(tenantId);
          await app.prisma.oneCImportLog.create({
            data: { tenantId, filename, ok: false, message },
          }).catch(() => {});
          await app.prisma.oneCAccount.update({
            where: { tenantId },
            data: { status: "ERROR", lastError: message },
          }).catch(() => {});
          return failure(reply, `Import error: ${message}`);
        }
      }

      // `deactivate` — 1C fayllarda kelmagan tovarlarni o'chirishni so'raydi.
      // Ataylab bajarmaymiz: qisman (СодержитТолькоИзменения) yuklamada bu
      // butun katalogni yashirib qo'yardi. `complete` — almashinuv yakuni.
      case "deactivate":
      case "complete":
        return textReply(reply, "success");

      default:
        return failure(reply, `Unsupported mode: ${mode || "(empty)"}`);
    }
  };

  async function touch(tenantId: string): Promise<void> {
    await app.prisma.oneCAccount
      .update({ where: { tenantId }, data: { lastExchangeAt: new Date() } })
      .catch(() => {});
  }

  const routeOpts = {
    bodyLimit: BODY_LIMIT,
    // 1C katta katalogni yuzlab so'rov bilan yuboradi — umumiy 300/min
    // cheklovi almashinuvni yarim yo'lda uzib qo'yardi.
    config: { rateLimit: false as const },
  };

  app.get<{ Querystring: ExchangeQuery }>("/", routeOpts, (req, reply) =>
    handler(req as never, reply),
  );
  app.post<{ Querystring: ExchangeQuery }>("/", routeOpts, (req, reply) =>
    handler(req as never, reply),
  );
};
