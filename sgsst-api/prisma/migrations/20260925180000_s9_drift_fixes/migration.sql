-- Correcciones de drift S9/S10: completa lo que las migraciones de S9.2/S9.3
-- dejaron a medias y lo que S9.2 omitio, para que la BD coincida 1:1 con
-- schema.prisma.
--
-- 1) UnplannedInspection.plannedInspectionId: columna declarada en el schema
--    pero nunca creada (S9.2 la omitio). Sin ella, cualquier SELECT de Prisma
--    sobre la tabla falla en runtime (P2021/42703).
-- 2) InspectionFinding.inspectionId: S9.2 hizo DROP COLUMN + ADD COLUMN, lo
--    que borro silenciosamente el FK y el indice creados en S9.1; se
--    recrean aqui (ON DELETE CASCADE, mismo criterio del padre).
-- 3) unsafeReportId: la FK real es ON DELETE CASCADE (migracion S9.3); el
--    schema se alinea a eso (el reporte arrastra sus hallazgos, igual que
--    las inspecciones planeadas y no planeadas).

-- 1) Enlace opcional de una no planeada a una planeada
ALTER TABLE "UnplannedInspection" ADD COLUMN "plannedInspectionId" TEXT;

-- AddForeignKey
ALTER TABLE "UnplannedInspection" ADD CONSTRAINT "UnplannedInspection_plannedInspectionId_fkey" FOREIGN KEY ("plannedInspectionId") REFERENCES "PlannedInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2) FK e indice de inspectionId (perdidos en el DROP/ADD de S9.2)
-- CreateIndex
CREATE INDEX "InspectionFinding_inspectionId_idx" ON "InspectionFinding"("inspectionId");

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PlannedInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Revertir el estado incoherente en BD dev: la FK de unsafeReportId ya es
--    CASCADE en produccion y en el schema; en dev quedo SET NULL de una
--    ejecucion previa. Unificacion a CASCADE.
ALTER TABLE "InspectionFinding" DROP CONSTRAINT IF EXISTS "InspectionFinding_unsafeReportId_fkey";
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_unsafeReportId_fkey" FOREIGN KEY ("unsafeReportId") REFERENCES "UnsafeReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
