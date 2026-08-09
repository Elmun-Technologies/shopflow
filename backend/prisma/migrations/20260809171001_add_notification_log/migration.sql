-- NotificationLog table — yuborilgan xabarlar tarixini saqlaydi

CREATE TYPE "NotificationType" AS ENUM ('CART_ABANDON', 'ORDER_CREATED', 'ORDER_READY', 'ORDER_STATUS', 'PROMOTION', 'MANUAL');

CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "channel" TEXT NOT NULL DEFAULT 'telegram',
    "telegramUserId" BIGINT,
    "telegramError" TEXT,
    "relatedObjectType" TEXT,
    "relatedObjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "NotificationLog_tenantId_createdAt_idx" ON "NotificationLog"("tenantId", "createdAt");
CREATE INDEX "NotificationLog_tenantId_customerId_idx" ON "NotificationLog"("tenantId", "customerId");
CREATE INDEX "NotificationLog_tenantId_type_idx" ON "NotificationLog"("tenantId", "type");
CREATE INDEX "NotificationLog_relatedObjectType_relatedObjectId_idx" ON "NotificationLog"("relatedObjectType", "relatedObjectId");

-- Foreign keys
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
