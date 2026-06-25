-- Bot Voronka (sales funnel): sekanslar, qadamlar, ro'yxatga olishlar
-- + admin Telegram chat ID (yangi buyurtma/lid xabarlari uchun)

-- CreateEnum
CREATE TYPE "BotSequenceTrigger" AS ENUM ('NEW_CUSTOMER', 'FIRST_PURCHASE', 'INACTIVE_DAYS', 'VIP_STATUS', 'BIRTHDAY', 'WEEKLY');

-- AlterTable
ALTER TABLE "TenantNotifSettings" ADD COLUMN     "adminTelegramChatId" BIGINT;

-- CreateTable
CREATE TABLE "BotSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "BotSequenceTrigger" NOT NULL,
    "inactiveDays" INTEGER,
    "weekDay" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSequenceStep" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,

    CONSTRAINT "BotSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSequenceEnrollment" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextSendAt" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotSequenceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotSequence_tenantId_active_idx" ON "BotSequence"("tenantId", "active");

-- CreateIndex
CREATE INDEX "BotSequenceStep_sequenceId_stepOrder_idx" ON "BotSequenceStep"("sequenceId", "stepOrder");

-- CreateIndex
CREATE INDEX "BotSequenceEnrollment_nextSendAt_completed_idx" ON "BotSequenceEnrollment"("nextSendAt", "completed");

-- CreateIndex
CREATE INDEX "BotSequenceEnrollment_customerId_idx" ON "BotSequenceEnrollment"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "BotSequenceEnrollment_sequenceId_customerId_key" ON "BotSequenceEnrollment"("sequenceId", "customerId");

-- AddForeignKey
ALTER TABLE "BotSequence" ADD CONSTRAINT "BotSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotSequenceStep" ADD CONSTRAINT "BotSequenceStep_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "BotSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotSequenceEnrollment" ADD CONSTRAINT "BotSequenceEnrollment_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "BotSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotSequenceEnrollment" ADD CONSTRAINT "BotSequenceEnrollment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

