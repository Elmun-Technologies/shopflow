ALTER TABLE "DeliveryOrder"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "DeliveryOrder"
ADD CONSTRAINT "DeliveryOrder_attemptCount_check" CHECK ("attemptCount" >= 0);
