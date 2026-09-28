-- S11 contratistas + restauracion: la migracion previa (aplicada) elimino
-- CorrectiveAction.inspectionFindingId por error de analisis; los servicios de
-- S9 escriben esa columna en sus creates (connect inspectionFinding), por lo que
-- se restaura aqui junto con su indice y FK (la columna estaba vacia).
/*
  Warnings:

  - You are about to drop the column `inspectionFindingId` on the `CorrectiveAction` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ContractorStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ContractorWorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ContractorDocumentStatus" AS ENUM ('PENDING', 'VALID', 'EXPIRED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "CorrectiveAction" DROP CONSTRAINT "CorrectiveAction_inspectionFindingId_fkey";

-- DropIndex
DROP INDEX "CorrectiveAction_inspectionFindingId_key";

-- AlterTable
ALTER TABLE "CorrectiveAction" DROP COLUMN "inspectionFindingId";

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nit" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "arl" TEXT,
    "activity" TEXT,
    "status" "ContractorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorWorker" (
    "id" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "job" TEXT,
    "inductedAt" TIMESTAMP(3),
    "status" "ContractorWorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractorId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ContractorWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorDocument" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "description" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" "ContractorDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contractorId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ContractorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contractor_companyId_status_idx" ON "Contractor"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_companyId_nit_key" ON "Contractor"("companyId", "nit");

-- CreateIndex
CREATE INDEX "ContractorWorker_companyId_idx" ON "ContractorWorker"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorWorker_contractorId_document_key" ON "ContractorWorker"("contractorId", "document");

-- CreateIndex
CREATE INDEX "ContractorDocument_contractorId_idx" ON "ContractorDocument"("contractorId");

-- CreateIndex
CREATE INDEX "ContractorDocument_companyId_status_idx" ON "ContractorDocument"("companyId", "status");

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorWorker" ADD CONSTRAINT "ContractorWorker_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorWorker" ADD CONSTRAINT "ContractorWorker_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorDocument" ADD CONSTRAINT "ContractorDocument_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorDocument" ADD CONSTRAINT "ContractorDocument_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorDocument" ADD CONSTRAINT "ContractorDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
