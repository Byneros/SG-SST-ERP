-- Vinculo opcional de capacitaciones y documentos con sedes.
ALTER TABLE "Training" ADD COLUMN "siteId" TEXT;
ALTER TABLE "Document" ADD COLUMN "siteId" TEXT;

CREATE INDEX "Training_siteId_idx" ON "Training"("siteId");
CREATE INDEX "Document_siteId_idx" ON "Document"("siteId");

ALTER TABLE "Training" ADD CONSTRAINT "Training_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Document" ADD CONSTRAINT "Document_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
