-- S9.2 (issue #22): Inspecciones no planeadas.
-- Reutiliza InspectionFinding (padre opcional: planeada / no planeada) y el
-- enlace a CorrectiveAction. Un hallazgo puede ademas generar un riesgo en
-- la matriz GTC-45 (Risk via riskId, SetNull).

-- CreateTable
CREATE TABLE "UnplannedInspection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "area" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PLANNED',
    "executedAt" TIMESTAMP(3),
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteId" TEXT,
    "inspectorId" TEXT,

    CONSTRAINT "UnplannedInspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnplannedInspection_companyId_status_idx" ON "UnplannedInspection"("companyId", "status");

-- CreateIndex
CREATE INDEX "UnplannedInspection_siteId_idx" ON "UnplannedInspection"("siteId");

-- AddForeignKey
ALTER TABLE "UnplannedInspection" ADD CONSTRAINT "UnplannedInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnplannedInspection" ADD CONSTRAINT "UnplannedInspection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnplannedInspection" ADD CONSTRAINT "UnplannedInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- InspectionFinding: padre opcional + enlace opcional a Risk (GTC-45)
ALTER TABLE "InspectionFinding" DROP COLUMN "inspectionId";

-- AlterTable
ALTER TABLE "InspectionFinding" ADD COLUMN "inspectionId" TEXT,
ADD COLUMN "unplannedInspectionId" TEXT,
ADD COLUMN "riskId" TEXT;

-- CreateIndex
CREATE INDEX "InspectionFinding_unplannedInspectionId_idx" ON "InspectionFinding"("unplannedInspectionId");

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_unplannedInspectionId_fkey" FOREIGN KEY ("unplannedInspectionId") REFERENCES "UnplannedInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
