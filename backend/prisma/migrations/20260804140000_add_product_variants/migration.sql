-- Mahsulot variantlari (marketplace uslubi): bitta karta, ichida 50 gr / 1 kg / 5 kg…
-- Har variantda o'z narxi, zaxirasi, rasmlari va xarakteristikasi.
--
-- To'liq orqaga mos: Product.options default '[]' — mavjud mahsulotlar variantsiz
-- qoladi va avvalgidek Product.price/stock bilan ishlaydi. Hech qanday backfill yo'q.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "options" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
-- 1C importi endi «Характеристика»ni variant sifatida yozadi — jurnalda alohida ko'rinsin
ALTER TABLE "OneCImportLog" ADD COLUMN     "variantsCreated" INTEGER NOT NULL DEFAULT 0,
                            ADD COLUMN     "variantsUpdated" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "variantId" TEXT,
                        ADD COLUMN     "variantLabel" TEXT;

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "optionValues" JSONB NOT NULL DEFAULT '{}',
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "oldPrice" DECIMAL(14,2),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attributes" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "oneCId" TEXT,
    "moyskladId" TEXT,
    "salesDoctorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_tenantId_sku_key" ON "ProductVariant"("tenantId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_tenantId_oneCId_key" ON "ProductVariant"("tenantId", "oneCId");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_sortOrder_idx" ON "ProductVariant"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductVariant_tenantId_active_idx" ON "ProductVariant"("tenantId", "active");

-- CreateIndex
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
