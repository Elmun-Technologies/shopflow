ALTER TABLE "DeliveryOrder"
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "weightKg" DECIMAL(12,3),
  ADD COLUMN "volumeM3" DECIMAL(12,4),
  ADD COLUMN "windowStartAt" TIMESTAMP(3),
  ADD COLUMN "windowEndAt" TIMESTAMP(3),
  ADD COLUMN "serviceMinutes" INTEGER NOT NULL DEFAULT 10;

CREATE INDEX "DeliveryOrder_tenantId_priority_scheduledAt_idx"
ON "DeliveryOrder"("tenantId", "priority", "scheduledAt");

ALTER TABLE "DeliveryOrder"
  ADD CONSTRAINT "DeliveryOrder_priority_check" CHECK ("priority" BETWEEN 0 AND 100),
  ADD CONSTRAINT "DeliveryOrder_serviceMinutes_check" CHECK ("serviceMinutes" BETWEEN 1 AND 240),
  ADD CONSTRAINT "DeliveryOrder_window_check" CHECK ("windowEndAt" IS NULL OR "windowStartAt" IS NULL OR "windowEndAt" > "windowStartAt");
