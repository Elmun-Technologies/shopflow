import type { FastifyInstance } from "fastify";
import { syncStock, syncProducts } from "../integrations/moysklad/sync.js";

/**
 * MoySklad webhook receiver.
 * MoySklad: Sozlamalar → Webhooks → URL: https://api.shopflow.uz/moysklad/webhook/:shopId
 * Auth: webhook tomonidan signature qo'shilmaydi. shopId path'da, secret yo'q
 *   (kelajakda — secret tokenli HMAC qo'shsak bo'ladi).
 */
export default async function moyskladWebhookRoutes(app: FastifyInstance) {
  app.post("/moysklad/webhook/:shopId", async (req, reply) => {
    const { shopId } = req.params as { shopId: string };
    const body = req.body as { events?: Array<{ action: string; meta: { type?: string; href?: string } }> };

    if (!body?.events || body.events.length === 0) {
      return reply.send({ ok: true });
    }

    // Asynxron - webhook fast response qaytarsin
    setTimeout(() => {
      void (async () => {
        const types = new Set(body.events!.map((e) => e.meta?.type ?? ""));
        if (types.has("product") || types.has("productfolder")) {
          await syncProducts(shopId).catch((err) => console.warn("[ms webhook] product sync:", err));
        } else if (types.has("supply") || types.has("demand") || types.has("loss") || types.has("inventory")) {
          // Stock o'zgarishi - faqat stock sync
          await syncStock(shopId).catch((err) => console.warn("[ms webhook] stock sync:", err));
        }
      })();
    }, 100);

    return reply.send({ ok: true });
  });
}
