-- Corrige el modelo de acciones correctivas compartido por auditorias (S7) y
-- hallazgos de inspeccion (S9): CorrectiveAction.findingId apuntaba siempre a
-- AuditFinding, por lo que crear una accion desde un hallazgo de inspeccion
-- violaba la FK CorrectiveAction_findingId_fkey (HTTP 500 en el flujo UI).
--
-- Nuevo modelo: padre opcional.
--  - findingId (nullable): accion nacida de una auditoria (flujo original).
--  - inspectionFindingId (nullable, unique): accion nacida de un hallazgo de
--    inspeccion/reporte inseguro (S9), enlazada desde el hallazgo por su
--    actionId unique. SetNull: borrar la accion no borra el hallazgo.

-- findingId pasa a ser opcional
ALTER TABLE "CorrectiveAction" ALTER COLUMN "findingId" DROP NOT NULL;

-- Recrear la FK hacia AuditFinding con el mismo nombre
ALTER TABLE "CorrectiveAction" DROP CONSTRAINT "CorrectiveAction_findingId_fkey";

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nuevo enlace a hallazgos de inspeccion
-- CreateTable
ALTER TABLE "CorrectiveAction" ADD COLUMN "inspectionFindingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CorrectiveAction_inspectionFindingId_key" ON "CorrectiveAction"("inspectionFindingId");

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_inspectionFindingId_fkey" FOREIGN KEY ("inspectionFindingId") REFERENCES "InspectionFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
