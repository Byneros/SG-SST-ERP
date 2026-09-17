CREATE TYPE "ReportExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');

CREATE TABLE "ReportExport" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "status" "ReportExportStatus" NOT NULL DEFAULT 'QUEUED',
  "requestedCompanyId" TEXT,
  "fileUrl" TEXT,
  "fileName" TEXT,
  "mimeType" TEXT,
  "storageKey" TEXT,
  "size" INTEGER,
  "jobId" TEXT,
  "error" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "requestedById" TEXT NOT NULL,
  "companyId" TEXT,

  CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportExport_requestedById_createdAt_idx" ON "ReportExport"("requestedById", "createdAt");
CREATE INDEX "ReportExport_companyId_createdAt_idx" ON "ReportExport"("companyId", "createdAt");
CREATE INDEX "ReportExport_status_expiresAt_idx" ON "ReportExport"("status", "expiresAt");

ALTER TABLE "ReportExport"
  ADD CONSTRAINT "ReportExport_requestedById_fkey"
  FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReportExport"
  ADD CONSTRAINT "ReportExport_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
