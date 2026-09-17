CREATE TABLE "ReportExportMetricSnapshot" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "total" INTEGER NOT NULL DEFAULT 0,
  "queued" INTEGER NOT NULL DEFAULT 0,
  "processing" INTEGER NOT NULL DEFAULT 0,
  "ready" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "expired" INTEGER NOT NULL DEFAULT 0,
  "storageBytes" INTEGER NOT NULL DEFAULT 0,
  "averageGenerationSeconds" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT,

  CONSTRAINT "ReportExportMetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportExportMetricSnapshot_date_scopeKey_key"
  ON "ReportExportMetricSnapshot"("date", "scopeKey");

CREATE INDEX "ReportExportMetricSnapshot_companyId_date_idx"
  ON "ReportExportMetricSnapshot"("companyId", "date");

ALTER TABLE "ReportExportMetricSnapshot"
  ADD CONSTRAINT "ReportExportMetricSnapshot_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
