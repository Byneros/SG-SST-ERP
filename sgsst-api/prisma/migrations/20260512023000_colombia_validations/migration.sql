CREATE TYPE "CompanyRiskClass" AS ENUM ('CLASS_I', 'CLASS_II', 'CLASS_III', 'CLASS_IV', 'CLASS_V');
CREATE TYPE "DocumentType" AS ENUM ('CC', 'CE', 'TI', 'PASSPORT', 'NIT');
CREATE TYPE "ContractType" AS ENUM ('INDEFINITE', 'FIXED_TERM', 'SERVICE', 'APPRENTICESHIP', 'TEMPORARY');
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RETIRED');

ALTER TABLE "Company" ADD COLUMN "arl" TEXT;
ALTER TABLE "Company" ADD COLUMN "riskClass" "CompanyRiskClass" NOT NULL DEFAULT 'CLASS_I';
ALTER TABLE "Company" ADD COLUMN "economicActivity" TEXT;
ALTER TABLE "Company" ADD COLUMN "city" TEXT;
ALTER TABLE "Company" ADD COLUMN "department" TEXT;

ALTER TABLE "Employee" ADD COLUMN "documentType" "DocumentType" NOT NULL DEFAULT 'CC';
ALTER TABLE "Employee" ADD COLUMN "workCenter" TEXT;
ALTER TABLE "Employee" ADD COLUMN "contractType" "ContractType" NOT NULL DEFAULT 'INDEFINITE';
ALTER TABLE "Employee" ADD COLUMN "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Employee" ADD COLUMN "hireDate" TIMESTAMP(3);
