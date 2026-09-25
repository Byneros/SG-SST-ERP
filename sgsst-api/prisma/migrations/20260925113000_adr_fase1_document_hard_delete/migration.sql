-- ADR fase 1 (issue #3): Document pasa de soft a hard delete + traza en
-- AuditLog. Ademas del row se elimina el archivo en storage (local o S3)
-- en la misma operacion; es el unico dominio con artefacto fisico asociado.

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "isActive",
DROP COLUMN "deletedAt";
