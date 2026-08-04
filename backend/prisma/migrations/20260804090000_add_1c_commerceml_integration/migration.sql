-- 1C integratsiyasi (CommerceML 2 «Обмен с сайтом»)
-- Katalog importi: Классификатор/Группы → Category, Каталог/Товары → Product.
-- 1C bizga ulanadi (Basic auth), shuning uchun per-tenant login/parol saqlanadi.

-- CreateEnum
CREATE TYPE "OneCStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR');

-- AlterEnum
ALTER TYPE "ProductSource" ADD VALUE 'ONEC';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "oneCId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "oneCId" TEXT,
ADD COLUMN     "oneCUpdated" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OneCAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "status" "OneCStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "createInactive" BOOLEAN NOT NULL DEFAULT true,
    "importImages" BOOLEAN NOT NULL DEFAULT true,
    "overwriteNames" BOOLEAN NOT NULL DEFAULT true,
    "lastExchangeAt" TIMESTAMP(3),
    "lastImportAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneCAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneCImportLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT,
    "categoriesCreated" INTEGER NOT NULL DEFAULT 0,
    "categoriesUpdated" INTEGER NOT NULL DEFAULT 0,
    "productsCreated" INTEGER NOT NULL DEFAULT 0,
    "productsUpdated" INTEGER NOT NULL DEFAULT 0,
    "productsHidden" INTEGER NOT NULL DEFAULT 0,
    "imagesImported" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneCImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OneCAccount_tenantId_key" ON "OneCAccount"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "OneCAccount_login_key" ON "OneCAccount"("login");

-- CreateIndex
CREATE INDEX "OneCImportLog_tenantId_createdAt_idx" ON "OneCImportLog"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_oneCId_key" ON "Category"("tenantId", "oneCId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_oneCId_key" ON "Product"("tenantId", "oneCId");

-- AddForeignKey
ALTER TABLE "OneCAccount" ADD CONSTRAINT "OneCAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneCImportLog" ADD CONSTRAINT "OneCImportLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
