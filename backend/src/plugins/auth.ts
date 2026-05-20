import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import type { UserRole } from "@prisma/client";

export interface SessionContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: UserRole[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    session: SessionContext;
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
      reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.decorate("requireRole", (...roles: UserRole[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      if (!req.session || !roles.includes(req.session.role)) {
        reply.code(403).send({ error: "Forbidden" });
      }
    };
  });
};

export const authPlugin = fp(plugin, { name: "auth", dependencies: ["@fastify/jwt"] });
