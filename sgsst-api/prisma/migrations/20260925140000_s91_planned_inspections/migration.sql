-- S9.1 (issue #21): Inspecciones planeadas con checklist y hallazgos.
-- Los hallazgos enlazan CorrectiveAction (actionId unique, SetNull) para
-- generar acciones correctivas. Borrado hard con traza (ADR); el plan arrastra
-- cascada a items y hallazgos.

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "PlannedInspection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LOCATIVE',
    "frequency" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "result" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "siteId" TEXT,
    "inspectorId" TEXT,

    CONSTRAINT "PlannedInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "section" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "inspectionId" TEXT NOT NULL,

    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionFinding" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MINOR',
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "actionId" TEXT,

    CONSTRAINT "InspectionFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannedInspection_companyId_status_idx" ON "PlannedInspection"("companyId", "status");

-- CreateIndex
CREATE INDEX "PlannedInspection_siteId_idx" ON "PlannedInspection"("siteId");

-- CreateIndex
CREATE INDEX "InspectionItem_inspectionId_idx" ON "InspectionItem"("inspectionId");

-- CreateIndex
CREATE INDEX "InspectionFinding_inspectionId_idx" ON "InspectionFinding"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionFinding_actionId_key" ON "InspectionFinding"("actionId");

-- AddForeignKey
ALTER TABLE "PlannedInspection" ADD CONSTRAINT "PlannedInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedInspection" ADD CONSTRAINT "PlannedInspection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedInspection" ADD CONSTRAINT "PlannedInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PlannedInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PlannedInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "CorrectiveAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
