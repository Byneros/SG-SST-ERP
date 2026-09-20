ALTER TABLE "Risk" ADD COLUMN "siteId" TEXT;
ALTER TABLE "Incident" ADD COLUMN "siteId" TEXT;

CREATE INDEX "Risk_siteId_idx" ON "Risk"("siteId");
CREATE INDEX "Incident_siteId_idx" ON "Incident"("siteId");

ALTER TABLE "Risk"
  ADD CONSTRAINT "Risk_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Incident"
  ADD CONSTRAINT "Incident_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
