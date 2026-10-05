-- S15.1 (issue #40): hallazgos unificados con origen trazable y causas.
-- Los enums FindingSeverity y FindingStatus ya existen (S9/S11).

CREATE TYPE "FindingSourceType" AS ENUM ('INSPECTION_PLANNED', 'INSPECTION_UNPLANNED', 'AUDIT', 'UNSAFE_REPORT', 'MANUAL');

CREATE TYPE "FindingType" AS ENUM ('NON_CONFORMITY', 'OPPORTUNITY', 'OBSERVATION');

CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" "FindingSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "type" "FindingType" NOT NULL DEFAULT 'NON_CONFORMITY',
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MINOR',
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FindingCause" (
    "id" TEXT NOT NULL,
    "causeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "findingId" TEXT NOT NULL,

    CONSTRAINT "FindingCause_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Finding_companyId_status_idx" ON "Finding"("companyId", "status");
CREATE INDEX "Finding_sourceType_sourceId_idx" ON "Finding"("sourceType", "sourceId");
CREATE INDEX "FindingCause_findingId_idx" ON "FindingCause"("findingId");

ALTER TABLE "Finding" ADD CONSTRAINT "Finding_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FindingCause" ADD CONSTRAINT "FindingCause_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
