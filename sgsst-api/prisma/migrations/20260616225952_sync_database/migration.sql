-- AlterTable
ALTER TABLE "Audit" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditFinding" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CorrectiveAction" ALTER COLUMN "updatedAt" DROP DEFAULT;
