CREATE TABLE "Site" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "address" TEXT,
  "city" TEXT,
  "department" TEXT,
  "isMain" BOOLEAN NOT NULL DEFAULT false,
  "companyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Site_companyId_code_key" ON "Site"("companyId", "code");
CREATE INDEX "Site_companyId_isActive_idx" ON "Site"("companyId", "isActive");

ALTER TABLE "Site"
  ADD CONSTRAINT "Site_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
