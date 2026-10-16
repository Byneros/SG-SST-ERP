-- #58: capacitaciones con asistentes, evaluación, evidencia por trabajador y
-- vencimiento del certificado. TrainingAttendee se acota multi-empresa por la
-- cadena training → company (patrón RiskActivity/RiskHazard). El empleado se
-- referencia por FK opcional (asistentes externos solo con nombre) y su borrado
-- conserva el historial de asistencia (ON DELETE SET NULL); lo mismo para la
-- evidencia documental.
CREATE TYPE "TrainingAttendeeStatus" AS ENUM ('ATTENDED', 'PASSED', 'FAILED');

ALTER TABLE "Training" ADD COLUMN "instructor" TEXT;
ALTER TABLE "Training" ADD COLUMN "validityMonths" INTEGER;

CREATE TABLE "TrainingAttendee" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "employeeId" TEXT,
    "name" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "status" "TrainingAttendeeStatus" NOT NULL DEFAULT 'ATTENDED',
    "expiresAt" TIMESTAMP(3),
    "evidenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingAttendee_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrainingAttendee_trainingId_idx" ON "TrainingAttendee"("trainingId");
CREATE INDEX "TrainingAttendee_employeeId_idx" ON "TrainingAttendee"("employeeId");
CREATE INDEX "TrainingAttendee_expiresAt_idx" ON "TrainingAttendee"("expiresAt");

ALTER TABLE "TrainingAttendee" ADD CONSTRAINT "TrainingAttendee_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingAttendee" ADD CONSTRAINT "TrainingAttendee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingAttendee" ADD CONSTRAINT "TrainingAttendee_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
