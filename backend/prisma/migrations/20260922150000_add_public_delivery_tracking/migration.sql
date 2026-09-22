ALTER TABLE "DeliveryOrder"
  ADD COLUMN "trackingToken" TEXT,
  ADD COLUMN "trackingExpiresAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "DeliveryOrder_trackingToken_key" ON "DeliveryOrder"("trackingToken");
