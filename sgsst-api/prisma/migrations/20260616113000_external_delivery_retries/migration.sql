ALTER TABLE "ExternalDelivery"
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

CREATE INDEX "ExternalDelivery_status_nextAttemptAt_idx"
  ON "ExternalDelivery"("status", "nextAttemptAt");
