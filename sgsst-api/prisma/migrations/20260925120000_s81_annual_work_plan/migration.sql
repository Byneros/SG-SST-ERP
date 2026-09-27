-- S8.1 (issue #17): Plan Anual de Trabajo SG-SST.
-- Un plan por empresa y anio (unique compuesto). El borrado del dominio es
-- hard delete con traza en AuditLog (ADR de estrategia de borrado), por lo
-- que no se introducen columnas isActive/deletedAt.

-- CreateTable
CREATE TABLE "AnnualWorkPlan" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "AnnualWorkPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnnualWorkPlan_companyId_status_idx" ON "AnnualWorkPlan"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualWorkPlan_companyId_year_key" ON "AnnualWorkPlan"("companyId", "year");

-- AddForeignKey
ALTER TABLE "AnnualWorkPlan" ADD CONSTRAINT "AnnualWorkPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnualWorkPlan" ADD CONSTRAINT "AnnualWorkPlan_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
