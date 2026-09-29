-- S10.4 + #25.2: vigilancia epidemiologica (PVE) y link cargo-riesgo-profesiograma.

-- 1. Cargo opcional en el riesgo de la matriz GTC-45.
ALTER TABLE "Risk" ADD COLUMN "position" TEXT;
CREATE INDEX "Risk_companyId_position_idx" ON "Risk"("companyId", "position");

-- 2. Link del profesiograma al riesgo del cargo (1:1, SetNull).
ALTER TABLE "MedicalProfile" ADD COLUMN "riskId" TEXT;
CREATE INDEX "MedicalProfile_companyId_riskId_idx" ON "MedicalProfile"("companyId", "riskId");
ALTER TABLE "MedicalProfile"
  ADD CONSTRAINT "MedicalProfile_riskId_fkey"
  FOREIGN KEY ("riskId") REFERENCES "Risk"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Trazabilidad del origen de cada requisito medico (SetNull).
ALTER TABLE "MedicalExamRequirement" ADD COLUMN "derivedFromRiskId" TEXT;
CREATE INDEX "MedicalExamRequirement_derivedFromRiskId_idx" ON "MedicalExamRequirement"("derivedFromRiskId");
ALTER TABLE "MedicalExamRequirement"
  ADD CONSTRAINT "MedicalExamRequirement_derivedFromRiskId_fkey"
  FOREIGN KEY ("derivedFromRiskId") REFERENCES "Risk"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Programas de vigilancia epidemiologica (PVE).
CREATE TABLE "MedicalSurveillanceProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "riskType" TEXT NOT NULL,
    "objective" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "MedicalSurveillanceProgram_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MedicalSurveillanceProgram_companyId_status_idx" ON "MedicalSurveillanceProgram"("companyId", "status");
ALTER TABLE "MedicalSurveillanceProgram"
  ADD CONSTRAINT "MedicalSurveillanceProgram_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicalSurveillanceProgram"
  ADD CONSTRAINT "MedicalSurveillanceProgram_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Cohortes de expuestos: derivadas de la matriz de riesgos.
CREATE TABLE "MedicalSurveillanceCohort" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "riskId" TEXT,
    "derivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "MedicalSurveillanceCohort_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MedicalSurveillanceCohort_companyId_status_idx" ON "MedicalSurveillanceCohort"("companyId", "status");
CREATE INDEX "MedicalSurveillanceCohort_riskId_idx" ON "MedicalSurveillanceCohort"("riskId");
ALTER TABLE "MedicalSurveillanceCohort"
  ADD CONSTRAINT "MedicalSurveillanceCohort_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "MedicalSurveillanceProgram"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicalSurveillanceCohort"
  ADD CONSTRAINT "MedicalSurveillanceCohort_riskId_fkey"
  FOREIGN KEY ("riskId") REFERENCES "Risk"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicalSurveillanceCohort"
  ADD CONSTRAINT "MedicalSurveillanceCohort_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Tabla de union implicita Prisma: trabajadores expuestos de la cohorte.
CREATE TABLE "_EmployeeToMedicalSurveillanceCohort" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EmployeeToMedicalSurveillanceCohort_AB_pkey" PRIMARY KEY ("A","B")
);
CREATE INDEX "_EmployeeToMedicalSurveillanceCohort_B_index" ON "_EmployeeToMedicalSurveillanceCohort"("B");
ALTER TABLE "_EmployeeToMedicalSurveillanceCohort"
  ADD CONSTRAINT "_EmployeeToMedicalSurveillanceCohort_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_EmployeeToMedicalSurveillanceCohort"
  ADD CONSTRAINT "_EmployeeToMedicalSurveillanceCohort_B_fkey"
  FOREIGN KEY ("B") REFERENCES "MedicalSurveillanceCohort"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
