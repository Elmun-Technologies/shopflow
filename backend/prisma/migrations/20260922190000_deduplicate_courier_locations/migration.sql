-- Keep the first received point when an older installation already contains
-- duplicate uploads from offline retries.
DELETE FROM "CourierLocation" duplicate
USING "CourierLocation" original
WHERE duplicate."employeeId" = original."employeeId"
  AND duplicate."capturedAt" = original."capturedAt"
  AND duplicate."id" > original."id";

CREATE UNIQUE INDEX "CourierLocation_employeeId_capturedAt_key"
ON "CourierLocation"("employeeId", "capturedAt");
