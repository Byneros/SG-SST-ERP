-- S14 gestion del cambio (#38, #39): solicitud con evaluacion de riesgos
-- obligatoria (link a Risk) y workflow con auditoria por etapa. Los cambios
-- previos arrancan en REQUESTED (estado inicial del flujo).
-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('REQUESTED', 'EVALUATION', 'CONTROLS', 'APPROVAL', 'IMPLEMENTATION', 'VERIFICATION', 'CLOSED');

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "process" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hazards" TEXT,
    "impacts" TEXT,
    "controls" TEXT,
    "riskId" TEXT,
    "implementationNotes" TEXT,
    "implementationEvidenceId" TEXT,
    "verificationNotes" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeRequest_companyId_status_idx" ON "ChangeRequest"("companyId", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_riskId_idx" ON "ChangeRequest"("riskId");

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_implementationEvidenceId_fkey" FOREIGN KEY ("implementationEvidenceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
