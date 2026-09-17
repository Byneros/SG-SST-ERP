CREATE TYPE "LegalNormStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUPERSEDED');
CREATE TYPE "LegalObligationFrequency" AS ENUM ('ONCE', 'ANNUAL', 'SEMIANNUAL', 'QUARTERLY', 'MONTHLY', 'EVENT_BASED', 'CONTINUOUS');
CREATE TYPE "LegalRequirementStatus" AS ENUM ('PENDING', 'COMPLIES', 'PARTIAL', 'NON_COMPLIANT', 'NOT_APPLICABLE');

CREATE TABLE "LegalNorm" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "issuingEntity" TEXT,
  "issuedAt" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3),
  "status" "LegalNormStatus" NOT NULL DEFAULT 'ACTIVE',
  "url" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LegalNorm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalRequirement" (
  "id" TEXT NOT NULL,
  "article" TEXT,
  "numeral" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "obligationType" TEXT,
  "frequency" "LegalObligationFrequency" NOT NULL DEFAULT 'ANNUAL',
  "appliesTo" TEXT,
  "riskLevel" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "normId" TEXT NOT NULL,
  CONSTRAINT "LegalRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyLegalRequirement" (
  "id" TEXT NOT NULL,
  "applies" BOOLEAN NOT NULL DEFAULT true,
  "status" "LegalRequirementStatus" NOT NULL DEFAULT 'PENDING',
  "ownerId" TEXT,
  "dueDate" TIMESTAMP(3),
  "nextReviewAt" TIMESTAMP(3),
  "lastReviewedAt" TIMESTAMP(3),
  "score" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  CONSTRAINT "CompanyLegalRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalRequirementMapping" (
  "id" TEXT NOT NULL,
  "moduleKey" TEXT NOT NULL,
  "entityName" TEXT,
  "entityId" TEXT,
  "evidenceType" TEXT,
  "kpiKey" TEXT,
  "reportKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requirementId" TEXT NOT NULL,
  CONSTRAINT "LegalRequirementMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalEvidenceRequirement" (
  "id" TEXT NOT NULL,
  "evidenceName" TEXT NOT NULL,
  "evidenceType" TEXT NOT NULL,
  "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "frequency" "LegalObligationFrequency" NOT NULL DEFAULT 'ANNUAL',
  "retentionYears" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requirementId" TEXT NOT NULL,
  CONSTRAINT "LegalEvidenceRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalEvidenceLink" (
  "id" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "status" "LegalRequirementStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "comments" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyRequirementId" TEXT NOT NULL,
  CONSTRAINT "LegalEvidenceLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalComplianceReview" (
  "id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "reviewedById" TEXT,
  "reportExportId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT NOT NULL,
  CONSTRAINT "LegalComplianceReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalNorm_code_key" ON "LegalNorm"("code");
CREATE INDEX "LegalRequirement_normId_idx" ON "LegalRequirement"("normId");
CREATE INDEX "LegalRequirement_active_riskLevel_idx" ON "LegalRequirement"("active", "riskLevel");
CREATE UNIQUE INDEX "CompanyLegalRequirement_companyId_requirementId_key" ON "CompanyLegalRequirement"("companyId", "requirementId");
CREATE INDEX "CompanyLegalRequirement_companyId_status_idx" ON "CompanyLegalRequirement"("companyId", "status");
CREATE INDEX "CompanyLegalRequirement_dueDate_idx" ON "CompanyLegalRequirement"("dueDate");
CREATE INDEX "LegalRequirementMapping_moduleKey_idx" ON "LegalRequirementMapping"("moduleKey");
CREATE INDEX "LegalEvidenceLink_entity_entityId_idx" ON "LegalEvidenceLink"("entity", "entityId");
CREATE INDEX "LegalComplianceReview_companyId_period_idx" ON "LegalComplianceReview"("companyId", "period");

ALTER TABLE "LegalRequirement" ADD CONSTRAINT "LegalRequirement_normId_fkey" FOREIGN KEY ("normId") REFERENCES "LegalNorm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyLegalRequirement" ADD CONSTRAINT "CompanyLegalRequirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyLegalRequirement" ADD CONSTRAINT "CompanyLegalRequirement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "LegalRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalRequirementMapping" ADD CONSTRAINT "LegalRequirementMapping_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "LegalRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalEvidenceRequirement" ADD CONSTRAINT "LegalEvidenceRequirement_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "LegalRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalEvidenceLink" ADD CONSTRAINT "LegalEvidenceLink_companyRequirementId_fkey" FOREIGN KEY ("companyRequirementId") REFERENCES "CompanyLegalRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LegalComplianceReview" ADD CONSTRAINT "LegalComplianceReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
