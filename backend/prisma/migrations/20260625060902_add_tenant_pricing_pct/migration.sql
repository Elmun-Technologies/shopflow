-- AlterTable: Tenant narxlash breakdown foizlari (yetkazib berish + xizmat)
ALTER TABLE "Tenant" ADD COLUMN     "deliveryPct" DOUBLE PRECISION NOT NULL DEFAULT 3,
ADD COLUMN     "servicePct" DOUBLE PRECISION NOT NULL DEFAULT 15;
