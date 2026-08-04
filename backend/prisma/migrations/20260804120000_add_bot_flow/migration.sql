-- Bot konstruktori: per-tenant suhbat oqimi (JSON) + davomiy suhbat holati.
-- BotFlow.enabled = false bo'lsa bot eski qattiq kodlangan oqimda qoladi (opt-in).

-- CreateTable
CREATE TABLE "BotFlow" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "definition" JSONB NOT NULL DEFAULT '{}',
    "template" TEXT,
    "lastBrief" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chatId" BIGINT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'uz',
    "state" TEXT NOT NULL DEFAULT 'idle',
    "screenId" TEXT,
    "screenPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "formId" TEXT,
    "fieldIndex" INTEGER NOT NULL DEFAULT 0,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotFlow_tenantId_key" ON "BotFlow"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BotSession_tenantId_chatId_key" ON "BotSession"("tenantId", "chatId");

-- CreateIndex
CREATE INDEX "BotSession_updatedAt_idx" ON "BotSession"("updatedAt");

-- AddForeignKey
ALTER TABLE "BotFlow" ADD CONSTRAINT "BotFlow_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotSession" ADD CONSTRAINT "BotSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
