import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { logAuditFor } from "../lib/audit.js";

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
    return reply.code(201).send({ ok: true, id: point.id, receivedAt: point.receivedAt });
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
};
