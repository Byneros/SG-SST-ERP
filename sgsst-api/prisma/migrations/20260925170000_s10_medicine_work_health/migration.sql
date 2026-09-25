-- S10 (issues #25-#27): Medicina laboral.
-- Profesiograma por cargo (requisitos + periodicidad), examenes ocupacionales
-- (solo concepto operativo, sin historia clinica) y restricciones con
-- vigencia/levantamiento. Datos sensibles: RBAC estricto en el API.

-- CreateTable
CREATE TABLE "MedicalProfile" (
    "id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "MedicalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalExamRequirement" (
    "id" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "periodicityMonths" INTEGER NOT NULL DEFAULT 12,
    "profileId" TEXT NOT NULL,

    CONSTRAINT "MedicalExamRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalExam" (
    "id" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "concept" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "performedAt" TIMESTAMP(3),
    "provider" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "MedicalExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalRestriction" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "liftedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "examId" TEXT,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "MedicalRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MedicalProfile_companyId_position_key" ON "MedicalProfile"("companyId", "position");

-- CreateIndex
CREATE INDEX "MedicalExamRequirement_profileId_idx" ON "MedicalExamRequirement"("profileId");

-- CreateIndex
CREATE INDEX "MedicalExam_employeeId_idx" ON "MedicalExam"("employeeId");

-- CreateIndex
CREATE INDEX "MedicalExam_companyId_nextDueAt_idx" ON "MedicalExam"("companyId", "nextDueAt");

-- CreateIndex
CREATE INDEX "MedicalRestriction_employeeId_status_idx" ON "MedicalRestriction"("employeeId", "status");

-- AddForeignKey
ALTER TABLE "MedicalProfile" ADD CONSTRAINT "MedicalProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExamRequirement" ADD CONSTRAINT "MedicalExamRequirement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MedicalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExam" ADD CONSTRAINT "MedicalExam_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalExam" ADD CONSTRAINT "MedicalExam_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRestriction" ADD CONSTRAINT "MedicalRestriction_examId_fkey" FOREIGN KEY ("examId") REFERENCES "MedicalExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRestriction" ADD CONSTRAINT "MedicalRestriction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRestriction" ADD CONSTRAINT "MedicalRestriction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
