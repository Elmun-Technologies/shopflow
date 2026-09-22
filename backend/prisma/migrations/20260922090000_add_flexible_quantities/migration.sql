-- Flexible e-commerce quantities: piece, length, area, weight, volume and services.
ALTER TABLE "Product"
  ADD COLUMN "productType" TEXT NOT NULL DEFAULT 'PHYSICAL',
  ADD COLUMN "quantityMode" TEXT NOT NULL DEFAULT 'PIECE',
  ADD COLUMN "inputMode" TEXT NOT NULL DEFAULT 'STEPPER',
  ADD COLUMN "quantityStep" DECIMAL(12,3) NOT NULL DEFAULT 1,
  ADD COLUMN "minQuantity" DECIMAL(12,3),
  ADD COLUMN "maxQuantity" DECIMAL(12,3),
  ADD COLUMN "trackStock" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requiresDelivery" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "OrderItem"
  ADD COLUMN "quantity" DECIMAL(14,3),
  ADD COLUMN "unit" TEXT,
  ADD COLUMN "measurement" JSONB,
  ADD COLUMN "trackStock" BOOLEAN NOT NULL DEFAULT true;
