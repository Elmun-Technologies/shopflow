import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

export const trackingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { token: string } }>("/:token", { config: { rateLimit: { max: 90, timeWindow: "1 minute" } } }, async (req, reply) => {
    const token = z.string().min(20).max(100).parse(req.params.token);
    const delivery = await app.prisma.deliveryOrder.findFirst({
      where: { trackingToken: token, trackingExpiresAt: { gt: new Date() } },
      include: {
        order: { select: { code: true, status: true, shippingAddress: true, customer: { select: { name: true } } } },
        courier: { include: { user: { select: { name: true } }, locations: { take: 1, orderBy: { capturedAt: "desc" } } } },
        vehicle: { select: { plateNumber: true, make: true, model: true } },
        deliveryStop: { include: { run: { include: { stops: { orderBy: { sequence: "asc" }, select: { id: true, sequence: true, status: true, estimatedArrivalAt: true } } } } } },
      },
    });
    if (!delivery) return reply.code(404).send({ error: "Kuzatuv havolasi topilmadi yoki muddati tugagan" });
    const stop = delivery.deliveryStop;
    const preceding = stop ? stop.run.stops.filter((item) => item.sequence < stop.sequence && !["COMPLETED", "FAILED", "SKIPPED"].includes(item.status)).length : null;
    const latest = delivery.courier?.locations[0];
    const fresh = latest && Date.now() - latest.capturedAt.getTime() < 5 * 60 * 1000 && (latest.accuracy == null || latest.accuracy <= 200);
    return {
      orderCode: delivery.order.code,
      status: delivery.status,
      address: delivery.order.shippingAddress,
      courier: delivery.courier ? { name: delivery.courier.user.name, phone: delivery.courierPhone } : null,
      vehicle: delivery.vehicle,
      sequence: stop?.sequence ?? null,
      stopsBefore: preceding,
      estimatedArrivalAt: stop?.estimatedArrivalAt ?? null,
      location: fresh && latest ? { lat: Number(latest.lat), lng: Number(latest.lng), heading: latest.heading, capturedAt: latest.capturedAt } : null,
      deliveredAt: delivery.deliveredAt,
    };
  });
};
