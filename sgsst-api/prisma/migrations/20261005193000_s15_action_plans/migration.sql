-- S15.2 (issue #41): plan de accion unificado (correctivas/preventivas/mejora)
-- con workflow de eficacia y origen trazable a hallazgos.

CREATE TYPE "ActionKind" AS ENUM ('CORRECTIVE', 'PREVENTIVE', 'IMPROVEMENT');

CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED');

CREATE TYPE "ActionEffectiveness" AS ENUM ('PENDING', 'EFFECTIVE', 'INEFFECTIVE');

CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "ActionKind" NOT NULL DEFAULT 'CORRECTIVE',
    "rootCause" TEXT,
    "expectedBenefit" TEXT,
    "result" TEXT,
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "effectiveness" "ActionEffectiveness" NOT NULL DEFAULT 'PENDING',
    "evidenceId" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ActionPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionPlan_companyId_status_idx" ON "ActionPlan"("companyId", "status");
CREATE INDEX "ActionPlan_sourceType_sourceId_idx" ON "ActionPlan"("sourceType", "sourceId");

ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
