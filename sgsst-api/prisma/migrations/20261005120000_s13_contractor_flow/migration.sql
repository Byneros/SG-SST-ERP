-- S13 contratistas: sede del trabajador (#35) y flujo de ingreso (#37).
-- El flujo es VALIDATION -> INDUCTION -> AUTHORIZED -> WORK -> CLOSED;
-- los contratistas previos arrancan en VALIDATION (estado inicial).
-- CreateEnum
CREATE TYPE "ContractorEntryStatus" AS ENUM ('VALIDATION', 'INDUCTION', 'AUTHORIZED', 'WORK', 'CLOSED');

-- AlterTable
ALTER TABLE "Contractor" ADD COLUMN "entryStatus" "ContractorEntryStatus" NOT NULL DEFAULT 'VALIDATION';

-- AlterTable
ALTER TABLE "ContractorWorker" ADD COLUMN "siteId" TEXT;

-- CreateIndex
CREATE INDEX "ContractorWorker_siteId_idx" ON "ContractorWorker"("siteId");

-- AddForeignKey
ALTER TABLE "ContractorWorker" ADD CONSTRAINT "ContractorWorker_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
