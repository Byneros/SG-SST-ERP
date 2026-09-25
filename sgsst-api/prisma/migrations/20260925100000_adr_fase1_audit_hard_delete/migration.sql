-- ADR fase 1 (issue #3): Audit/AuditProgram pasan de soft a hard delete + traza
-- en AuditLog (como ya operan SgsstEvaluation/Indicator desde 3c730b6).
-- La cascada ya cubre findings, acciones correctivas y checklist.

-- AlterTable
ALTER TABLE "Audit" DROP COLUMN "isActive",
DROP COLUMN "deletedAt";

-- AlterTable
ALTER TABLE "AuditProgram" DROP COLUMN "isActive",
DROP COLUMN "deletedAt";

-- AuditProgram: eliminar relaciones vivas antes del drop (defensa para
-- entornos con datos; en dev/prod el programa debe quedar vacio).
DELETE FROM "Audit" WHERE "programId" IS NOT NULL;
