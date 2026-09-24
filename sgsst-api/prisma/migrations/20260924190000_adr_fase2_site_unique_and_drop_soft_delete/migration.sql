-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_ssoProviderId_fkey";

-- DropIndex
DROP INDEX "Audit_programId_idx";

-- DropIndex
DROP INDEX "AuditProgram_companyId_idx";

-- DropIndex
DROP INDEX "Company_ssoProviderId_key";

-- DropIndex
DROP INDEX "Document_siteId_idx";

-- DropIndex
DROP INDEX "Employee_siteId_idx";

-- DropIndex
DROP INDEX "Incident_siteId_idx";

-- DropIndex
DROP INDEX "Indicator_siteId_idx";

-- DropIndex
DROP INDEX "Risk_siteId_idx";

-- DropIndex
DROP INDEX "SgsstEvaluation_companyId_idx";

-- DropIndex
DROP INDEX "Site_companyId_code_key";

-- DropIndex
DROP INDEX "SsoState_expiresAt_idx";

-- DropIndex
DROP INDEX "Training_siteId_idx";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "ssoProviderId";

-- AlterTable
ALTER TABLE "Indicator" DROP COLUMN "deletedAt",
DROP COLUMN "isActive",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SgsstEvaluation" DROP COLUMN "deletedAt",
DROP COLUMN "isActive";

-- AlterTable
ALTER TABLE "Site" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Site_companyId_code_idx" ON "Site"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SsoProvider_companyId_key" ON "SsoProvider"("companyId");

