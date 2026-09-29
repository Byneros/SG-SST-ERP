-- Restaura CorrectiveAction.inspectionFindingId: la migracion
-- 20260928202535_s11_contractors la elimino (columna, indice y FK) por un
-- error de analisis, pero schema.prisma sigue declarandola (linea ~675) y los
-- servicios de S9 escriben esa columna en sus creates (connect
-- inspectionFinding). Sin ella, crear una accion correctiva desde un hallazgo
-- de inspeccion falla en runtime con P2022 (columna inexistente).
--
-- Restauracion idempotente (defensa si algun entorno ya la tiene):
--   - IF EXISTS / IF NOT EXISTS en cada paso.

-- 1) Columna (nullable: padre opcional)
ALTER TABLE "CorrectiveAction" ADD COLUMN IF NOT EXISTS "inspectionFindingId" TEXT;

-- 2) Indice unico (same as 20260925190000_s9_corrective_action_link)
CREATE UNIQUE INDEX IF NOT EXISTS "CorrectiveAction_inspectionFindingId_key" ON "CorrectiveAction"("inspectionFindingId");

-- 3) SIN FK: schema.prisma declara inspectionFindingId como escalar @unique
--    sin campos de relacion (la FK real vive del lado opuesto, en
--    InspectionFinding.actionId). No se crea ninguna foreign key aqui para
--    mantener paridad exacta esquema <-> base de datos.
