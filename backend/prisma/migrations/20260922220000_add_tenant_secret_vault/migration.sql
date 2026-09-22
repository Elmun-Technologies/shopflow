CREATE TABLE "TenantSecret" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "encryptedValue" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantSecret_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantSecret_tenantId_key_key" ON "TenantSecret"("tenantId", "key");
CREATE INDEX "TenantSecret_tenantId_updatedAt_idx" ON "TenantSecret"("tenantId", "updatedAt");
ALTER TABLE "TenantSecret" ADD CONSTRAINT "TenantSecret_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
