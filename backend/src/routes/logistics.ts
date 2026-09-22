import type { FastifyPluginAsync } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { logAuditFor } from "../lib/audit.js";
import { distanceMeters, orderNearest, routeDistance } from "../lib/route-planner.js";
import { createDeliveryCode, verifyDeliveryCode } from "../lib/delivery-verification.js";
import { notifyCustomer } from "../lib/telegram-notify.js";

const employeeSchema = z.object({
  userId: z.string(),
  position: z.enum(["ADMINISTRATOR", "MANAGER", "OPERATOR", "WAREHOUSE", "COURIER", "DRIVER", "OTHER"]),
  phone: z.string().max(40).nullable().optional(),
  employeeCode: z.string().max(40).nullable().optional(),
  branch: z.string().max(80).nullable().optional(),
  licenseNumber: z.string().max(80).nullable().optional(),
  canDrive: z.boolean().default(false),
  active: z.boolean().default(true),
});

const vehicleSchema = z.object({
  plateNumber: z.string().trim().min(2).max(24),
  make: z.string().max(60).nullable().optional(),
  model: z.string().max(60).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  capacityKg: z.number().positive().nullable().optional(),
  capacityM3: z.number().positive().nullable().optional(),
  status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE", "INACTIVE"]).default("AVAILABLE"),
  defaultDriverId: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

const locationSchema = z.object({
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().max(10_000).optional(),
  speed: z.number().nonnegative().max(150).optional(),
  heading: z.number().min(0).max(360).optional(), altitude: z.number().optional(),
  capturedAt: z.string().datetime(),
});

export const logisticsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/employees", async (req) => app.prisma.employeeProfile.findMany({
    where: { tenantId: req.session.tenantId }, orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true, email: true, active: true } }, assignedVehicles: true },
  }));

  app.post("/employees", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = employeeSchema.parse(req.body);
    const user = await app.prisma.user.findFirst({ where: { id: data.userId, tenantId: req.session.tenantId } });
    if (!user) return reply.code(400).send({ error: "Xodim foydalanuvchisi topilmadi" });
    const profile = await app.prisma.employeeProfile.create({ data: { tenantId: req.session.tenantId, ...data } });
    await logAuditFor(app.prisma, req.session, { action: "CREATE", resourceType: "employee_profile", resourceId: profile.id, summary: `Xodim profili yaratildi: ${user.name}` });
    return reply.code(201).send(profile);
  });

  app.patch<{ Params: { id: string } }>("/employees/:id", { preHandler: [app.requireRole("OWNER", "ADMIN")] }, async (req, reply) => {
    const data = employeeSchema.omit({ userId: true }).partial().parse(req.body);
    const found = await app.prisma.employeeProfile.findFirst({ where: { id: req.params.id, tenantId: req.session.tenantId } });
    if (!found) return reply.code(404).send({ error: "Xodim topilmadi" });
    return app.prisma.employeeProfile.update({ where: { id: found.id }, data });
  });

  app.get("/vehicles", async (req) => app.prisma.vehicle.findMany({
    where: { tenantId: req.session.tenantId }, orderBy: { plateNumber: "asc" },
    include: { defaultDriver: { include: { user: { select: { name: true, email: true } } } } },
  }));

  app.post("/vehicles", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const data = vehicleSchema.parse(req.body);
    if (data.defaultDriverId) {
      const driver = await app.prisma.employeeProfile.findFirst({ where: { id: data.defaultDriverId, tenantId: req.session.tenantId, active: true } });
      if (!driver) return reply.code(400).send({ error: "Haydovchi topilmadi" });
    }
    const vehicle = await app.prisma.vehicle.create({ data: { tenantId: req.session.tenantId, ...data } });
    return reply.code(201).send(vehicle);
  });

  app.patch<{ Params: { id: string } }>("/vehicles/:id", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const data = vehicleSchema.partial().parse(req.body);
    const found = await app.prisma.vehicle.findFirst({ where: { id: req.params.id, tenantId: req.session.tenantId } });
    if (!found) return reply.code(404).send({ error: "Mashina topilmadi" });
    return app.prisma.vehicle.update({ where: { id: found.id }, data });
  });

  app.get("/driver/shifts/current", async (req) => app.prisma.driverShift.findFirst({
    where: { userId: req.session.userId, tenantId: req.session.tenantId, status: { in: ["ACTIVE", "PAUSED"] } },
    include: { vehicle: true }, orderBy: { startedAt: "desc" },
  }));

  // Driver app: smenani boshlash. Bitta foydalanuvchida bir vaqtda bitta faol smena.
  app.post("/driver/shifts/start", async (req, reply) => {
    const { vehicleId } = z.object({ vehicleId: z.string().optional() }).parse(req.body);
    const employee = await app.prisma.employeeProfile.findFirst({ where: { userId: req.session.userId, tenantId: req.session.tenantId, active: true, canDrive: true } });
    if (!employee) return reply.code(403).send({ error: "Siz haydovchi sifatida sozlanmagansiz" });
    const active = await app.prisma.driverShift.findFirst({ where: { employeeId: employee.id, status: { in: ["ACTIVE", "PAUSED"] } } });
    if (active) return reply.code(409).send({ error: "Faol smena allaqachon mavjud", shift: active });
    if (vehicleId) {
      const vehicle = await app.prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId: req.session.tenantId, status: { in: ["AVAILABLE", "IN_USE"] } } });
      if (!vehicle) return reply.code(400).send({ error: "Mashina mavjud emas" });
    }
    const shift = await app.prisma.driverShift.create({ data: { tenantId: req.session.tenantId, userId: req.session.userId, employeeId: employee.id, vehicleId } });
    if (vehicleId) await app.prisma.vehicle.update({ where: { id: vehicleId }, data: { status: "IN_USE" } });
    return reply.code(201).send(shift);
  });

  app.post("/driver/shifts/finish", async (req, reply) => {
    const shift = await app.prisma.driverShift.findFirst({ where: { userId: req.session.userId, tenantId: req.session.tenantId, status: { in: ["ACTIVE", "PAUSED"] } }, orderBy: { startedAt: "desc" } });
    if (!shift) return reply.code(404).send({ error: "Faol smena topilmadi" });
    const updated = await app.prisma.driverShift.update({ where: { id: shift.id }, data: { status: "COMPLETED", endedAt: new Date() } });
    if (shift.vehicleId) await app.prisma.vehicle.updateMany({ where: { id: shift.vehicleId, tenantId: req.session.tenantId }, data: { status: "AVAILABLE" } });
    return updated;
  });

  // Driver app GPS telemetry. capturedAt qurilma vaqti; receivedAt server vaqti.
  app.post("/driver/location", async (req, reply) => {
    const data = locationSchema.parse(req.body);
    const employee = await app.prisma.employeeProfile.findFirst({ where: { userId: req.session.userId, tenantId: req.session.tenantId, active: true, canDrive: true } });
    if (!employee) return reply.code(403).send({ error: "Haydovchi profili topilmadi" });
    const shift = await app.prisma.driverShift.findFirst({ where: { employeeId: employee.id, status: "ACTIVE" } });
    if (!shift) return reply.code(409).send({ error: "GPS yuborish uchun faol smenani boshlang" });
    const capturedAt = new Date(data.capturedAt);
    if (Math.abs(Date.now() - capturedAt.getTime()) > 24 * 60 * 60 * 1000) return reply.code(400).send({ error: "GPS vaqti noto'g'ri" });
    const point = await app.prisma.courierLocation.create({ data: { tenantId: req.session.tenantId, employeeId: employee.id, userId: req.session.userId, ...data, capturedAt } });

    // Faol marshrut ETA'larini yangi GPS nuqtasidan qayta hisoblaymiz. Qurilma
    // bergan tezlik juda past/yo'q bo'lsa shahar fallback tezligi ishlaydi.
    const activeRun = await app.prisma.deliveryRun.findFirst({
      where: { driverId: employee.id, status: "ACTIVE" },
      include: { stops: { where: { status: { in: ["PENDING", "ARRIVED"] } }, orderBy: { sequence: "asc" } } },
      orderBy: { startedAt: "desc" },
    });
    if (activeRun?.stops.length) {
      const metersPerSecond = data.speed && data.speed >= 2 ? Math.min(data.speed, 40) : 25_000 / 3_600;
      let cursor = { lat: data.lat, lng: data.lng };
      let elapsed = 0;
      await Promise.all(activeRun.stops.map((stop) => {
        const target = { lat: Number(stop.lat), lng: Number(stop.lng) };
        elapsed += Math.round(distanceMeters(cursor, target) / metersPerSecond);
        const eta = new Date(Date.now() + elapsed * 1_000);
        elapsed += stop.serviceMinutes * 60;
        cursor = target;
        return app.prisma.deliveryStop.update({ where: { id: stop.id }, data: { estimatedArrivalAt: eta } });
      }));
    }
    return reply.code(201).send({ ok: true, id: point.id, receivedAt: point.receivedAt });
  });

  app.get("/analytics", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req) => {
    const q = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).parse(req.query);
    const since = new Date(Date.now() - q.days * 24 * 60 * 60 * 1000);
    const deliveries = await app.prisma.deliveryOrder.findMany({
      where: { tenantId: req.session.tenantId, createdAt: { gte: since } },
      select: { status: true, createdAt: true, deliveredAt: true, failedAt: true, courierId: true, courier: { include: { user: { select: { name: true } } } } }, take: 10_000,
    });
    const completed = deliveries.filter((item) => item.status === "DELIVERED");
    const durations = completed.filter((item) => item.deliveredAt).map((item) => item.deliveredAt!.getTime() - item.createdAt.getTime());
    const courierMap = new Map<string, { id: string; name: string; delivered: number; failed: number }>();
    for (const item of deliveries) {
      if (!item.courierId || !item.courier) continue;
      const row = courierMap.get(item.courierId) ?? { id: item.courierId, name: item.courier.user.name, delivered: 0, failed: 0 };
      if (item.status === "DELIVERED") row.delivered++; if (item.status === "FAILED") row.failed++;
      courierMap.set(item.courierId, row);
    }
    return { days: q.days, total: deliveries.length, delivered: completed.length, failed: deliveries.filter((item) => item.status === "FAILED").length,
      successRate: deliveries.length ? Math.round(completed.length / deliveries.length * 1000) / 10 : 0,
      averageDeliveryMinutes: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length / 60_000) : null,
      couriers: [...courierMap.values()].sort((a, b) => b.delivered - a.delivered) };
  });

  // Admin live map: har bir faol kuryerning faqat eng so'nggi nuqtasi.
  app.get("/live", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req) => {
    const employees = await app.prisma.employeeProfile.findMany({
      where: { tenantId: req.session.tenantId, active: true, canDrive: true },
      include: { user: { select: { name: true } }, shifts: { where: { status: { in: ["ACTIVE", "PAUSED"] } }, take: 1, orderBy: { startedAt: "desc" }, include: { vehicle: true } }, locations: { take: 1, orderBy: { capturedAt: "desc" } } },
    });
    return employees.map((e) => ({ id: e.id, name: e.user.name, position: e.position, shift: e.shifts[0] ?? null, location: e.locations[0] ? { ...e.locations[0], lat: Number(e.locations[0].lat), lng: Number(e.locations[0].lng) } : null }));
  });

  app.patch<{ Params: { id: string } }>("/deliveries/:id/assign", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const { courierId, vehicleId } = z.object({ courierId: z.string(), vehicleId: z.string().nullable().optional() }).parse(req.body);
    const delivery = await app.prisma.deliveryOrder.findFirst({ where: { id: req.params.id, tenantId: req.session.tenantId } });
    const courier = await app.prisma.employeeProfile.findFirst({ where: { id: courierId, tenantId: req.session.tenantId, active: true, canDrive: true }, include: { user: true } });
    if (!delivery || !courier) return reply.code(404).send({ error: "Yetkazish yoki kuryer topilmadi" });
    const updated = await app.prisma.deliveryOrder.update({ where: { id: delivery.id }, data: { courierId, vehicleId: vehicleId ?? null, courierName: courier.user.name, courierPhone: courier.phone, status: "ASSIGNED" } });
    return updated;
  });

  app.get<{ Params: { id: string } }>("/deliveries/:id/proofs", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const delivery = await app.prisma.deliveryOrder.findFirst({ where: { id: req.params.id, tenantId: req.session.tenantId }, select: { id: true } });
    if (!delivery) return reply.code(404).send({ error: "Yetkazish topilmadi" });
    return app.prisma.deliveryProof.findMany({ where: { deliveryOrderId: delivery.id, tenantId: req.session.tenantId }, orderBy: { createdAt: "desc" } });
  });

  // Dispatcher pool: koordinatasi bor va hali marshrutga kiritilmagan yetkazishlar.
  app.get("/dispatch/pool", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req) => {
    const rows = await app.prisma.deliveryOrder.findMany({
      where: { tenantId: req.session.tenantId, status: { in: ["PENDING", "ASSIGNED"] }, deliveryStop: null,
        order: { shippingLat: { not: null }, shippingLng: { not: null } } },
      include: { order: { select: { code: true, shippingAddress: true, shippingLat: true, shippingLng: true, customer: { select: { name: true, phone: true } } } }, method: { select: { name: true } } },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((row) => ({ ...row, price: Number(row.price), lat: Number(row.order.shippingLat), lng: Number(row.order.shippingLng) }));
  });

  const runSchema = z.object({
    driverId: z.string(), vehicleId: z.string().nullable().optional(), deliveryOrderIds: z.array(z.string()).min(1).max(100),
    startLat: z.number().min(-90).max(90), startLng: z.number().min(-180).max(180),
    plannedStartAt: z.string().datetime().nullable().optional(), serviceMinutes: z.number().int().min(1).max(240).default(10),
  });

  // Marshrut yaratish atomik: bir delivery ikki run'ga tushmaydi (unique stop).
  app.post("/runs", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const data = runSchema.parse(req.body);
    const tenantId = req.session.tenantId;
    const driver = await app.prisma.employeeProfile.findFirst({ where: { id: data.driverId, tenantId, active: true, canDrive: true }, include: { user: true } });
    if (!driver) return reply.code(400).send({ error: "Faol haydovchi topilmadi" });
    if (data.vehicleId) {
      const vehicle = await app.prisma.vehicle.findFirst({ where: { id: data.vehicleId, tenantId, status: { in: ["AVAILABLE", "IN_USE"] } } });
      if (!vehicle) return reply.code(400).send({ error: "Mashina mavjud emas" });
    }
    const deliveries = await app.prisma.deliveryOrder.findMany({
      where: { id: { in: data.deliveryOrderIds }, tenantId, deliveryStop: null, order: { shippingLat: { not: null }, shippingLng: { not: null } } },
      include: { order: { select: { shippingLat: true, shippingLng: true, shippingAddress: true, code: true, customerId: true, customer: { select: { language: true } } } } },
    });
    if (deliveries.length !== new Set(data.deliveryOrderIds).size) return reply.code(409).send({ error: "Ba'zi buyurtmalar topilmadi, koordinatasiz yoki boshqa marshrutga qo'shilgan" });
    const points = deliveries.map((d) => ({ id: d.id, lat: Number(d.order.shippingLat), lng: Number(d.order.shippingLng) }));
    const ordered = orderNearest({ lat: data.startLat, lng: data.startLng }, points);
    const byId = new Map(deliveries.map((d) => [d.id, d]));
    const distance = routeDistance({ lat: data.startLat, lng: data.startLng }, ordered);
    const departure = data.plannedStartAt ? new Date(data.plannedStartAt) : new Date();
    const etaById = new Map<string, Date>();
    let cursor = { lat: data.startLat, lng: data.startLng };
    let elapsedSeconds = 0;
    for (const point of ordered) {
      elapsedSeconds += Math.round(distanceMeters(cursor, point) / (25_000 / 3_600));
      etaById.set(point.id, new Date(departure.getTime() + elapsedSeconds * 1_000));
      elapsedSeconds += data.serviceMinutes * 60;
      cursor = point;
    }
    const code = `RUN-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Date.now().toString(36).toUpperCase()}`;
    const verification = new Map(deliveries.map((delivery) => [delivery.id, createDeliveryCode()]));
    const run = await app.prisma.$transaction(async (tx) => {
      const created = await tx.deliveryRun.create({ data: {
        tenantId, code, status: "PLANNED", driverId: driver.id, userId: driver.userId, vehicleId: data.vehicleId ?? null,
        plannedStartAt: data.plannedStartAt ? new Date(data.plannedStartAt) : null,
        totalDistanceMeters: distance, totalDurationSeconds: elapsedSeconds, routeProvider: "FALLBACK_HAVERSINE",
        routeData: { start: { lat: data.startLat, lng: data.startLng }, assumedAverageSpeedKmh: 25 },
        stops: { create: ordered.map((point, index) => ({ deliveryOrderId: point.id, sequence: index + 1, lat: point.lat, lng: point.lng, address: byId.get(point.id)?.order.shippingAddress, serviceMinutes: data.serviceMinutes, estimatedArrivalAt: etaById.get(point.id) })) },
      }, include: { stops: { orderBy: { sequence: "asc" }, include: { deliveryOrder: { include: { order: { include: { customer: true } } } } } }, driver: { include: { user: true } }, vehicle: true } });
      for (const deliveryId of data.deliveryOrderIds) {
        const current = deliveries.find((delivery) => delivery.id === deliveryId)!;
        await tx.deliveryOrder.update({ where: { id: deliveryId }, data: {
          courierId: driver.id, vehicleId: data.vehicleId ?? null, courierName: driver.user.name,
          courierPhone: driver.phone, status: "ASSIGNED",
          ...(!current.trackingToken && { trackingToken: randomBytes(24).toString("base64url"), trackingExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }),
          verificationCodeHash: verification.get(deliveryId)!.hash,
          verificationExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        } });
      }
      return created;
    });
    // Xabar yuborish transactiondan tashqarida: Telegram muammosi marshrutni rollback qilmaydi.
    for (const delivery of deliveries) {
      if (!delivery.order.customerId) continue;
      const otp = verification.get(delivery.id)!.code;
      const isRu = delivery.order.customer?.language === "ru";
      const text = isRu
        ? `🚚 Заказ <b>#${delivery.order.code}</b> передан курьеру. Код подтверждения при получении: <b>${otp}</b>`
        : `🚚 <b>#${delivery.order.code}</b> buyurtmangiz kuryerga berildi. Qabul qilish tasdiqlash kodi: <b>${otp}</b>`;
      void notifyCustomer(app.prisma, tenantId, delivery.order.customerId, text).catch((error) => app.log.warn({ error, deliveryId: delivery.id }, "delivery OTP notification failed"));
    }
    return reply.code(201).send(run);
  });

  app.get("/runs", async (req) => {
    const q = z.object({ status: z.enum(["DRAFT", "PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional() }).parse(req.query);
    return app.prisma.deliveryRun.findMany({ where: { tenantId: req.session.tenantId, ...(q.status && { status: q.status }) },
      include: { driver: { include: { user: { select: { name: true, email: true } } } }, vehicle: true, stops: { orderBy: { sequence: "asc" }, include: { deliveryOrder: { include: { order: { select: { code: true, shippingAddress: true, customer: { select: { name: true, phone: true } } } } } } } }, orderBy: { createdAt: "desc" }, take: 100 });
  });

  app.patch<{ Params: { id: string } }>("/runs/:id/cancel", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const run = await app.prisma.deliveryRun.findFirst({ where: { id: req.params.id, tenantId: req.session.tenantId, status: { in: ["DRAFT", "PLANNED"] } }, include: { stops: true } });
    if (!run) return reply.code(404).send({ error: "Bekor qilish mumkin bo'lgan marshrut topilmadi" });
    await app.prisma.$transaction(async (tx) => {
      const deliveryIds = run.stops.map((stop) => stop.deliveryOrderId);
      await tx.deliveryStop.deleteMany({ where: { runId: run.id } });
      if (deliveryIds.length) await tx.deliveryOrder.updateMany({ where: { id: { in: deliveryIds }, tenantId: req.session.tenantId, status: "ASSIGNED" }, data: { status: "PENDING", courierId: null, vehicleId: null, courierName: null, courierPhone: null } });
      await tx.deliveryRun.update({ where: { id: run.id }, data: { status: "CANCELLED", completedAt: new Date() } });
    });
    return { ok: true };
  });

  app.patch<{ Params: { id: string } }>("/runs/:id/reorder", { preHandler: [app.requireRole("OWNER", "ADMIN", "MANAGER")] }, async (req, reply) => {
    const { stopIds } = z.object({ stopIds: z.array(z.string()).min(1).max(100) }).parse(req.body);
    const run = await app.prisma.deliveryRun.findFirst({ where: { id: req.params.id, tenantId: req.session.tenantId, status: { in: ["DRAFT", "PLANNED"] } }, include: { stops: true } });
    if (!run || stopIds.length !== run.stops.length || new Set(stopIds).size !== stopIds.length || stopIds.some((id) => !run.stops.some((stop) => stop.id === id))) return reply.code(400).send({ error: "Stoplar ro'yxati marshrutga mos emas" });
    const orderedStops = stopIds.map((id) => run.stops.find((stop) => stop.id === id)!);
    const routeData = run.routeData as { start?: { lat?: number; lng?: number } } | null;
    let cursor = { lat: Number(routeData?.start?.lat ?? orderedStops[0].lat), lng: Number(routeData?.start?.lng ?? orderedStops[0].lng) };
    let elapsed = 0;
    const departure = run.plannedStartAt ?? new Date();
    const eta = new Map<string, Date>();
    for (const stop of orderedStops) {
      const target = { lat: Number(stop.lat), lng: Number(stop.lng) };
      elapsed += Math.round(distanceMeters(cursor, target) / (25_000 / 3_600)); eta.set(stop.id, new Date(departure.getTime() + elapsed * 1000));
      elapsed += stop.serviceMinutes * 60; cursor = target;
    }
    await app.prisma.$transaction(async (tx) => {
      // Unique(runId, sequence) to'qnashmasligi uchun avval vaqtinchalik manfiy tartib.
      for (let index = 0; index < stopIds.length; index++) await tx.deliveryStop.update({ where: { id: stopIds[index] }, data: { sequence: -(index + 1) } });
      for (let index = 0; index < stopIds.length; index++) await tx.deliveryStop.update({ where: { id: stopIds[index] }, data: { sequence: index + 1, estimatedArrivalAt: eta.get(stopIds[index]) } });
      await tx.deliveryRun.update({ where: { id: run.id }, data: { totalDurationSeconds: elapsed } });
    });
    return { ok: true };
  });

  app.get("/driver/run", async (req, reply) => {
    const employee = await app.prisma.employeeProfile.findFirst({ where: { userId: req.session.userId, tenantId: req.session.tenantId, active: true } });
    if (!employee) return reply.code(403).send({ error: "Haydovchi profili topilmadi" });
    return app.prisma.deliveryRun.findFirst({ where: { driverId: employee.id, status: { in: ["PLANNED", "ACTIVE"] } },
      include: { vehicle: true, stops: { orderBy: { sequence: "asc" }, include: { deliveryOrder: { include: { order: { select: { code: true, shippingAddress: true, shippingLat: true, shippingLng: true, customer: { select: { name: true, phone: true } } } } } } } }, orderBy: { createdAt: "desc" } });
  });

  app.post<{ Params: { id: string } }>("/driver/stops/:id/proofs", async (req, reply) => {
    const body = z.object({ type: z.enum(["PHOTO", "SIGNATURE", "NOTE"]), fileUrl: z.string().max(500).optional(), note: z.string().max(1000).optional(), lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() }).refine((value) => value.fileUrl || value.note, { message: "Fayl yoki izoh kerak" }).parse(req.body);
    const employee = await app.prisma.employeeProfile.findFirst({ where: { userId: req.session.userId, tenantId: req.session.tenantId, active: true }, include: { user: { select: { name: true } } } });
    if (!employee) return reply.code(403).send({ error: "Haydovchi profili topilmadi" });
    const stop = await app.prisma.deliveryStop.findFirst({ where: { id: req.params.id, run: { tenantId: req.session.tenantId, driverId: employee.id, status: { in: ["PLANNED", "ACTIVE"] } } } });
    if (!stop) return reply.code(404).send({ error: "Marshrut manzili topilmadi" });
    const proof = await app.prisma.deliveryProof.create({ data: { tenantId: req.session.tenantId, deliveryOrderId: stop.deliveryOrderId, ...body, createdById: req.session.userId, createdByName: employee.user.name } });
    return reply.code(201).send(proof);
  });

  app.patch<{ Params: { id: string } }>("/driver/stops/:id", async (req, reply) => {
    const { status, notes, verificationCode, proofFileUrl } = z.object({ status: z.enum(["ARRIVED", "COMPLETED", "FAILED", "SKIPPED"]), notes: z.string().trim().max(500).optional(), verificationCode: z.string().regex(/^\d{6}$/).optional(), proofFileUrl: z.string().url().max(2_000).optional() }).parse(req.body);
    if (status === "FAILED" && (!notes || notes.length < 3 || !proofFileUrl)) return reply.code(400).send({ error: "Yetkazilmagan sabab va tasdiqlovchi surat majburiy" });
    const employee = await app.prisma.employeeProfile.findFirst({ where: { userId: req.session.userId, tenantId: req.session.tenantId, active: true }, include: { user: { select: { name: true } } } });
    if (!employee) return reply.code(403).send({ error: "Haydovchi profili topilmadi" });
    const stop = await app.prisma.deliveryStop.findFirst({ where: { id: req.params.id, run: { tenantId: req.session.tenantId, driverId: employee.id, status: { in: ["PLANNED", "ACTIVE"] } } }, include: { run: true, deliveryOrder: true } });
    if (!stop) return reply.code(404).send({ error: "Marshrut manzili topilmadi" });
    if (status === "COMPLETED" && stop.deliveryOrder.verificationCodeHash) {
      if (!verificationCode || !stop.deliveryOrder.verificationExpiresAt || stop.deliveryOrder.verificationExpiresAt < new Date() || !verifyDeliveryCode(verificationCode, stop.deliveryOrder.verificationCodeHash)) {
        return reply.code(422).send({ error: "Tasdiqlash kodi noto'g'ri yoki muddati tugagan" });
      }
    }
    const now = new Date();
    const updated = await app.prisma.$transaction(async (tx) => {
      if (stop.run.status === "PLANNED") await tx.deliveryRun.update({ where: { id: stop.runId }, data: { status: "ACTIVE", startedAt: now } });
      const changed = await tx.deliveryStop.update({ where: { id: stop.id }, data: { status, notes, ...(status === "ARRIVED" && { arrivedAt: now }), ...(["COMPLETED", "FAILED", "SKIPPED"].includes(status) && { completedAt: now }) } });
      const deliveryStatus = status === "COMPLETED" ? "DELIVERED" : status === "FAILED" ? "FAILED" : status === "ARRIVED" ? "IN_TRANSIT" : undefined;
      if (deliveryStatus) await tx.deliveryOrder.update({ where: { id: stop.deliveryOrderId }, data: { status: deliveryStatus, ...(status === "COMPLETED" && { deliveredAt: now, verificationCodeHash: null, verificationExpiresAt: null }), ...(status === "FAILED" && { failedAt: now }) } });
      if (status === "COMPLETED" && verificationCode) await tx.deliveryProof.create({ data: { tenantId: req.session.tenantId, deliveryOrderId: stop.deliveryOrderId, type: "OTP", note: "Mijozning 6 xonali kodi bilan tasdiqlandi", createdById: req.session.userId, createdByName: employee.user.name } });
      if (status === "FAILED" && proofFileUrl) await tx.deliveryProof.create({ data: { tenantId: req.session.tenantId, deliveryOrderId: stop.deliveryOrderId, type: "PHOTO", fileUrl: proofFileUrl, note: `Yetkazilmadi: ${notes}`, createdById: req.session.userId, createdByName: employee.user.name } });
      const remaining = await tx.deliveryStop.count({ where: { runId: stop.runId, status: { in: ["PENDING", "ARRIVED"] }, id: { not: stop.id } } });
      if (remaining === 0 && ["COMPLETED", "FAILED", "SKIPPED"].includes(status)) await tx.deliveryRun.update({ where: { id: stop.runId }, data: { status: "COMPLETED", completedAt: now } });
      return changed;
    });
    return updated;
  });
};
