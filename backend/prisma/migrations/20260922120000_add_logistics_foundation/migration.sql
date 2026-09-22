CREATE TYPE "EmployeePosition" AS ENUM ('ADMINISTRATOR','MANAGER','OPERATOR','WAREHOUSE','COURIER','DRIVER','OTHER');
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE','IN_USE','MAINTENANCE','INACTIVE');
CREATE TYPE "DriverShiftStatus" AS ENUM ('ACTIVE','PAUSED','COMPLETED');
CREATE TYPE "DeliveryRunStatus" AS ENUM ('DRAFT','PLANNED','ACTIVE','COMPLETED','CANCELLED');
CREATE TYPE "DeliveryStopStatus" AS ENUM ('PENDING','ARRIVED','COMPLETED','FAILED','SKIPPED');

CREATE TABLE "EmployeeProfile" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "position" "EmployeePosition" NOT NULL DEFAULT 'OTHER', "phone" TEXT,
  "employeeCode" TEXT, "branch" TEXT, "licenseNumber" TEXT,
  "canDrive" BOOLEAN NOT NULL DEFAULT false, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeProfile_userId_key" ON "EmployeeProfile"("userId");
CREATE UNIQUE INDEX "EmployeeProfile_tenantId_employeeCode_key" ON "EmployeeProfile"("tenantId","employeeCode");
CREATE INDEX "EmployeeProfile_tenantId_position_active_idx" ON "EmployeeProfile"("tenantId","position","active");

CREATE TABLE "Vehicle" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "plateNumber" TEXT NOT NULL,
  "make" TEXT, "model" TEXT, "color" TEXT, "capacityKg" DECIMAL(12,3), "capacityM3" DECIMAL(12,3),
  "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE', "notes" TEXT, "defaultDriverId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Vehicle_tenantId_plateNumber_key" ON "Vehicle"("tenantId","plateNumber");
CREATE INDEX "Vehicle_tenantId_status_idx" ON "Vehicle"("tenantId","status");
CREATE INDEX "Vehicle_defaultDriverId_idx" ON "Vehicle"("defaultDriverId");

CREATE TABLE "DriverShift" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "vehicleId" TEXT, "status" "DriverShiftStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" TIMESTAMP(3),
  CONSTRAINT "DriverShift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DriverShift_tenantId_status_idx" ON "DriverShift"("tenantId","status");
CREATE INDEX "DriverShift_employeeId_startedAt_idx" ON "DriverShift"("employeeId","startedAt");

CREATE TABLE "CourierLocation" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "lat" DECIMAL(10,7) NOT NULL, "lng" DECIMAL(10,7) NOT NULL, "accuracy" DOUBLE PRECISION,
  "speed" DOUBLE PRECISION, "heading" DOUBLE PRECISION, "altitude" DOUBLE PRECISION,
  "capturedAt" TIMESTAMP(3) NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourierLocation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CourierLocation_tenantId_employeeId_capturedAt_idx" ON "CourierLocation"("tenantId","employeeId","capturedAt");
CREATE INDEX "CourierLocation_capturedAt_idx" ON "CourierLocation"("capturedAt");

CREATE TABLE "DeliveryRun" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "code" TEXT NOT NULL,
  "status" "DeliveryRunStatus" NOT NULL DEFAULT 'DRAFT', "driverId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "vehicleId" TEXT, "plannedStartAt" TIMESTAMP(3), "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "totalDistanceMeters" INTEGER, "totalDurationSeconds" INTEGER, "routeProvider" TEXT, "routeData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeliveryRun_tenantId_code_key" ON "DeliveryRun"("tenantId","code");
CREATE INDEX "DeliveryRun_tenantId_status_plannedStartAt_idx" ON "DeliveryRun"("tenantId","status","plannedStartAt");
CREATE INDEX "DeliveryRun_driverId_status_idx" ON "DeliveryRun"("driverId","status");

CREATE TABLE "DeliveryStop" (
  "id" TEXT NOT NULL, "runId" TEXT NOT NULL, "deliveryOrderId" TEXT NOT NULL, "sequence" INTEGER NOT NULL,
  "status" "DeliveryStopStatus" NOT NULL DEFAULT 'PENDING', "lat" DECIMAL(10,7) NOT NULL, "lng" DECIMAL(10,7) NOT NULL,
  "address" TEXT, "estimatedArrivalAt" TIMESTAMP(3), "arrivedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "serviceMinutes" INTEGER NOT NULL DEFAULT 10, "notes" TEXT,
  CONSTRAINT "DeliveryStop_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DeliveryStop_deliveryOrderId_key" ON "DeliveryStop"("deliveryOrderId");
CREATE UNIQUE INDEX "DeliveryStop_runId_sequence_key" ON "DeliveryStop"("runId","sequence");
CREATE INDEX "DeliveryStop_runId_status_idx" ON "DeliveryStop"("runId","status");

ALTER TABLE "DeliveryOrder" ADD COLUMN "courierId" TEXT, ADD COLUMN "vehicleId" TEXT;
CREATE INDEX "DeliveryOrder_courierId_status_idx" ON "DeliveryOrder"("courierId","status");
CREATE INDEX "DeliveryOrder_vehicleId_idx" ON "DeliveryOrder"("vehicleId");

ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_defaultDriverId_fkey" FOREIGN KEY ("defaultDriverId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DriverShift" ADD CONSTRAINT "DriverShift_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverShift" ADD CONSTRAINT "DriverShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverShift" ADD CONSTRAINT "DriverShift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverShift" ADD CONSTRAINT "DriverShift_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CourierLocation" ADD CONSTRAINT "CourierLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourierLocation" ADD CONSTRAINT "CourierLocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourierLocation" ADD CONSTRAINT "CourierLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryRun" ADD CONSTRAINT "DeliveryRun_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryStop" ADD CONSTRAINT "DeliveryStop_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeliveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryStop" ADD CONSTRAINT "DeliveryStop_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "EmployeeProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
