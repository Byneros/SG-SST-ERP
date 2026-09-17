CREATE TYPE "AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'CLOSED', 'CANCELLED');
CREATE TYPE "FindingSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');
CREATE TYPE "CorrectiveActionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');

ALTER TABLE "Audit"
  RENAME COLUMN "date" TO "scheduledAt";

ALTER TABLE "Audit"
  ADD COLUMN "status" "AuditStatus" NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN "scope" TEXT,
  ADD COLUMN "auditorName" TEXT,
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "AuditFinding" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" "FindingSeverity" NOT NULL DEFAULT 'MINOR',
  "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "auditId" TEXT NOT NULL,
  CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorrectiveAction" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "responsible" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "CorrectiveActionStatus" NOT NULL DEFAULT 'PENDING',
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "findingId" TEXT NOT NULL,
  CONSTRAINT "CorrectiveAction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuditFinding"
  ADD CONSTRAINT "AuditFinding_auditId_fkey"
  FOREIGN KEY ("auditId") REFERENCES "Audit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CorrectiveAction"
  ADD CONSTRAINT "CorrectiveAction_findingId_fkey"
  FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
