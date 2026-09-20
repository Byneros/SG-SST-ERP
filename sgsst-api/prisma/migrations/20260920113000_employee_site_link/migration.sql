ALTER TABLE "Employee" ADD COLUMN "siteId" TEXT;

CREATE INDEX "Employee_siteId_idx" ON "Employee"("siteId");

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
