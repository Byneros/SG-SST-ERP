CREATE TYPE "NotificationType" AS ENUM (
  'INFO',
  'DOCUMENT_EXPIRING',
  'TRAINING_OVERDUE',
  'INCIDENT_OPEN',
  'TASK'
);

CREATE TYPE "NotificationPriority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

ALTER TABLE "Notification"
  ADD COLUMN "type" "NotificationType" NOT NULL DEFAULT 'INFO',
  ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "entity" TEXT,
  ADD COLUMN "entityId" TEXT,
  ADD COLUMN "readAt" TIMESTAMP(3),
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
