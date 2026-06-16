import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "@prisma/client";
import { hashApiKey, API_KEY_PREFIX } from "../lib/api-key.js";

export interface SessionContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

// Public API (v1) — API kalit orqali aniqlangan tenant konteksti.
export interface ApiAuthContext {
  tenantId: string;
  apiKeyId: string;
  scopes: string[];
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: UserRole[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateApiKey: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    session: SessionContext;
    apiAuth: ApiAuthContext;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: SessionContext;
    user: SessionContext;
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  app.decorate("authenticate", async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
      req.session = req.user;
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.decorate("requireRole", (...roles: UserRole[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.session || !roles.includes(req.session.role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }
    };
  });

  // Public API (v1) auth — `Authorization: Bearer sf_...` kalitini tekshiradi
  // va req.apiAuth ga tenant kontekstini o'rnatadi.
  app.decorate("authenticateApiKey", async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "API kalit talab qilinadi (Authorization: Bearer ...)" });
    }
    const raw = header.slice("Bearer ".length).trim();
    if (!raw.startsWith(API_KEY_PREFIX)) {
      return reply.code(401).send({ error: "Yaroqsiz API kalit" });
    }

    const key = await app.prisma.apiKey.findFirst({
      where: { keyHash: hashApiKey(raw) },
      select: { id: true, tenantId: true, scopes: true, active: true, expiresAt: true },
    });
    if (!key || !key.active) {
      return reply.code(401).send({ error: "Yaroqsiz API kalit" });
    }
    if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
      return reply.code(401).send({ error: "API kalit muddati tugagan" });
    }

    req.apiAuth = { tenantId: key.tenantId, apiKeyId: key.id, scopes: key.scopes };

    // lastUsedAt — har so'rovda emas, 60 soniyada bir marta yangilaymiz (write spam yo'q).
    const cutoff = new Date(Date.now() - 60_000);
    void app.prisma.apiKey
      .updateMany({
        where: { id: key.id, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: cutoff } }] },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => undefined);
  });
};

export const authPlugin = fp(plugin, { name: "auth", dependencies: ["@fastify/jwt", "prisma"] });
