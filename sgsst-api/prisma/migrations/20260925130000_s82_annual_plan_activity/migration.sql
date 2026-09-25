-- S8.2 (issue #18): Actividades del Plan Anual de Trabajo.
-- Evidencia integrada con documents (FK SetNull: borrar el documento no
-- elimina la actividad). El borrado de la actividad es hard delete con traza
-- en AuditLog (ADR); el plan arrastra cascada a sus actividades.

-- CreateTable
CREATE TABLE "AnnualPlanActivity" (
    "id" TEXT NOT NULL,
    "cycle" TEXT NOT NULL DEFAULT 'ACT',
    "name" TEXT NOT NULL,
    "frequency" TEXT,
    "dueDate" TIMESTAMP(3),
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "budget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "planId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT,
    "evidenceId" TEXT,

    CONSTRAINT "AnnualPlanActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnualPlanActivity_planId_idx" ON "AnnualPlanActivity"("planId");

-- CreateIndex
CREATE INDEX "AnnualPlanActivity_companyId_status_idx" ON "AnnualPlanActivity"("companyId", "status");

-- AddForeignKey
ALTER TABLE "AnnualPlanActivity" ADD CONSTRAINT "AnnualPlanActivity_planId_fkey" FOREIGN KEY ("planId") REFERENCES "AnnualWorkPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualPlanActivity" ADD CONSTRAINT "AnnualPlanActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualPlanActivity" ADD CONSTRAINT "AnnualPlanActivity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualPlanActivity" ADD CONSTRAINT "AnnualPlanActivity_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
