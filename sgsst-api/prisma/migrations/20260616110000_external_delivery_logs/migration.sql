CREATE TYPE "ExternalDeliveryProvider" AS ENUM (
  'WHATSAPP',
  'EMAIL',
  'TEAMS',
  'SLACK'
);

CREATE TYPE "ExternalDeliveryStatus" AS ENUM (
  'PENDING',
  'SENT',
  'FAILED',
  'SKIPPED'
);

CREATE TABLE "ExternalDelivery" (
  "id" TEXT NOT NULL,
  "provider" "ExternalDeliveryProvider" NOT NULL,
  "status" "ExternalDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "target" TEXT,
  "subject" TEXT,
  "payload" JSONB,
  "response" JSONB,
  "error" TEXT,
  "entity" TEXT,
  "entityId" TEXT,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT,
  "notificationId" TEXT,

  CONSTRAINT "ExternalDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExternalDelivery_provider_status_attemptedAt_idx"
  ON "ExternalDelivery"("provider", "status", "attemptedAt");

CREATE INDEX "ExternalDelivery_companyId_attemptedAt_idx"
  ON "ExternalDelivery"("companyId", "attemptedAt");

CREATE INDEX "ExternalDelivery_entity_entityId_idx"
  ON "ExternalDelivery"("entity", "entityId");

ALTER TABLE "ExternalDelivery"
  ADD CONSTRAINT "ExternalDelivery_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExternalDelivery"
  ADD CONSTRAINT "ExternalDelivery_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
