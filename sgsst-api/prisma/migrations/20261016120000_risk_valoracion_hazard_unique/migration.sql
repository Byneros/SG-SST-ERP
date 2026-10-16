-- Fix #57: el schema declara RiskValoracion.hazardId @unique (valoración 1:1
-- por peligro, upsert con ON CONFLICT), pero la migración 20261015160000 creó
-- solo un índice simple; sin el único, PUT .../valoracion falla con
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification". Se reemplaza el índice por el único que Prisma espera
-- (_hazardId_key).
DROP INDEX "RiskValoracion_hazardId_idx";
CREATE UNIQUE INDEX "RiskValoracion_hazardId_key" ON "RiskValoracion"("hazardId");
