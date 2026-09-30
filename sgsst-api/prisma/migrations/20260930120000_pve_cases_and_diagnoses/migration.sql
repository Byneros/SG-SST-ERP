-- #44: casos PVE por diagnostico CIE-10 y ausentismo (segmentacion de vigilancia).

-- 0. Drift de la migracion S10: el schema exige @@unique([programId, riskId])
--    en la cohorte, pero la migracion 20260929150000 creo el indice sin UNIQUE.
--    Idempotente: en BD donde exista el indice no-uniquelo reemplaza; en BD
--    limpias (CI/E2E) es no-op.
DROP INDEX IF EXISTS "MedicalSurveillanceCohort_programId_riskId_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "MedicalSurveillanceCohort_programId_riskId_key" ON "MedicalSurveillanceCohort"("programId", "riskId");

-- 1. Catalogo CIE-10 configurable por empresa: los casos siempre referencian
--    un diagnostico del catalogo (sin codigos libres) para agrupar indicadores
--    sobre datos normalizados. Unico por empresa (companyId, code).
CREATE TABLE "PveDiagnosis" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "PveDiagnosis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PveDiagnosis_companyId_code_key" ON "PveDiagnosis"("companyId", "code");
CREATE INDEX "PveDiagnosis_companyId_active_idx" ON "PveDiagnosis"("companyId", "active");
ALTER TABLE "PveDiagnosis"
  ADD CONSTRAINT "PveDiagnosis_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Caso PVE por trabajador: estado clinico, proximo control (alertas) y
--    dias de ausentismo reportados (tasa sobre expuestos). El diagnostico es
--    Restrict: no se borra un codigo con casos que lo referencian.
CREATE TABLE "PveCase" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUSPECTED',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextFollowUpAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "absenceDays" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "cohortId" TEXT,
    "diagnosisId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "PveCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PveCase_companyId_status_idx" ON "PveCase"("companyId", "status");
CREATE INDEX "PveCase_employeeId_idx" ON "PveCase"("employeeId");
CREATE INDEX "PveCase_programId_idx" ON "PveCase"("programId");
CREATE INDEX "PveCase_diagnosisId_idx" ON "PveCase"("diagnosisId");
CREATE INDEX "PveCase_nextFollowUpAt_idx" ON "PveCase"("nextFollowUpAt");
ALTER TABLE "PveCase"
  ADD CONSTRAINT "PveCase_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PveCase"
  ADD CONSTRAINT "PveCase_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PveCase"
  ADD CONSTRAINT "PveCase_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MedicalSurveillanceProgram"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PveCase"
  ADD CONSTRAINT "PveCase_cohortId_fkey"
  FOREIGN KEY ("cohortId") REFERENCES "MedicalSurveillanceCohort"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PveCase"
  ADD CONSTRAINT "PveCase_diagnosisId_fkey"
  FOREIGN KEY ("diagnosisId") REFERENCES "PveDiagnosis"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
