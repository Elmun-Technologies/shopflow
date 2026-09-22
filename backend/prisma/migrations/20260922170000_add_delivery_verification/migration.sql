CREATE TYPE "DeliveryProofType" AS ENUM ('OTP','PHOTO','SIGNATURE','NOTE');
ALTER TABLE "DeliveryOrder"
  ADD COLUMN "verificationCodeHash" TEXT,
  ADD COLUMN "verificationExpiresAt" TIMESTAMP(3);
CREATE TABLE "DeliveryProof" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deliveryOrderId" TEXT NOT NULL,
  "type" "DeliveryProofType" NOT NULL,
  "fileUrl" TEXT,
  "note" TEXT,
  "lat" DECIMAL(10,7),
  "lng" DECIMAL(10,7),
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryProof_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DeliveryProof_tenantId_deliveryOrderId_createdAt_idx" ON "DeliveryProof"("tenantId","deliveryOrderId","createdAt");
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryProof" ADD CONSTRAINT "DeliveryProof_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
