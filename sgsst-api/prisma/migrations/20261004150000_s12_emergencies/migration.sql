-- CreateEnum
CREATE TYPE "EmergencyBrigadeRole" AS ENUM ('JEFE_BRIGADA', 'PREVENCION_INCENDIOS', 'PRIMEROS_AUXILIOS', 'EVACUACION_RESCATE', 'BRIGADISTA');

-- CreateEnum
CREATE TYPE "EmergencyThreatRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "EmergencyResourceStatus" AS ENUM ('OPERATIVE', 'MAINTENANCE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EmergencyDrillStatus" AS ENUM ('PLANNED', 'EXECUTED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmergencyBrigade" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyBrigade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyBrigadeMember" (
    "id" TEXT NOT NULL,
    "role" "EmergencyBrigadeRole" NOT NULL DEFAULT 'BRIGADISTA',
    "formationCompletedAt" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "brigadeId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyBrigadeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "responsibleEmployeeId" TEXT,
    "meetingPoint" TEXT,
    "routesDescription" TEXT,
    "procedures" TEXT,
    "vulnerabilityNotes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyThreat" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "riskLevel" "EmergencyThreatRisk" NOT NULL DEFAULT 'MEDIUM',
    "planId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyThreat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyResource" (
    "id" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "location" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "EmergencyResourceStatus" NOT NULL DEFAULT 'OPERATIVE',
    "lastInspectedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "planId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyDrill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scenario" TEXT,
    "planId" TEXT NOT NULL,
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "participants" INTEGER,
    "resultNotes" TEXT,
    "status" "EmergencyDrillStatus" NOT NULL DEFAULT 'PLANNED',
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyDrill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyDrillFinding" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MINOR',
    "actionDescription" TEXT,
    "actionResponsible" TEXT,
    "actionDueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "drillId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyDrillFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmergencyBrigade_companyId_siteId_idx" ON "EmergencyBrigade"("companyId", "siteId");

-- CreateIndex
CREATE INDEX "EmergencyBrigadeMember_companyId_idx" ON "EmergencyBrigadeMember"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyBrigadeMember_brigadeId_employeeId_key" ON "EmergencyBrigadeMember"("brigadeId", "employeeId");

-- CreateIndex
CREATE INDEX "EmergencyPlan_companyId_idx" ON "EmergencyPlan"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyPlan_siteId_key" ON "EmergencyPlan"("siteId");

-- CreateIndex
CREATE INDEX "EmergencyThreat_planId_idx" ON "EmergencyThreat"("planId");

-- CreateIndex
CREATE INDEX "EmergencyResource_planId_idx" ON "EmergencyResource"("planId");

-- CreateIndex
CREATE INDEX "EmergencyResource_companyId_status_idx" ON "EmergencyResource"("companyId", "status");

-- CreateIndex
CREATE INDEX "EmergencyDrill_planId_idx" ON "EmergencyDrill"("planId");

-- CreateIndex
CREATE INDEX "EmergencyDrill_companyId_status_idx" ON "EmergencyDrill"("companyId", "status");

-- CreateIndex
CREATE INDEX "EmergencyDrillFinding_drillId_idx" ON "EmergencyDrillFinding"("drillId");

-- CreateIndex
CREATE INDEX "EmergencyDrillFinding_companyId_closedAt_idx" ON "EmergencyDrillFinding"("companyId", "closedAt");

-- AddForeignKey
ALTER TABLE "EmergencyBrigade" ADD CONSTRAINT "EmergencyBrigade_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyBrigade" ADD CONSTRAINT "EmergencyBrigade_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyBrigadeMember" ADD CONSTRAINT "EmergencyBrigadeMember_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "EmergencyBrigade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyBrigadeMember" ADD CONSTRAINT "EmergencyBrigadeMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyBrigadeMember" ADD CONSTRAINT "EmergencyBrigadeMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_responsibleEmployeeId_fkey" FOREIGN KEY ("responsibleEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyPlan" ADD CONSTRAINT "EmergencyPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyThreat" ADD CONSTRAINT "EmergencyThreat_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EmergencyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyThreat" ADD CONSTRAINT "EmergencyThreat_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyResource" ADD CONSTRAINT "EmergencyResource_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EmergencyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyResource" ADD CONSTRAINT "EmergencyResource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EmergencyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDrill" ADD CONSTRAINT "EmergencyDrill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDrillFinding" ADD CONSTRAINT "EmergencyDrillFinding_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "EmergencyDrill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDrillFinding" ADD CONSTRAINT "EmergencyDrillFinding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

