import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, registerUser } from "../services/auth.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  shopName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (req, reply) => {
    const body = registerSchema.parse(req.body);
    const { user, shop } = await registerUser(body);
    const token = app.jwt.sign({ userId: user.id, shopId: shop.id });
    return reply.send({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      shop: { id: shop.id, name: shop.name, currency: shop.currency },
    });
  });

  app.post("/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const { user, shop } = await authenticate(body.email, body.password);
    const token = app.jwt.sign({ userId: user.id, shopId: shop.id });
    return reply.send({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      shop: { id: shop.id, name: shop.name, currency: shop.currency },
    });
  });

  app.get("/me", { onRequest: [app.authenticate] }, async (req) => {
    return { userId: req.user.userId, shopId: req.user.shopId };
  });
}
