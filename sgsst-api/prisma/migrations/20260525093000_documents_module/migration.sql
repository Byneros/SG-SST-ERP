CREATE TYPE "DocumentCategory" AS ENUM (
  'POLICY',
  'PROCEDURE',
  'CERTIFICATE',
  'TRAINING_EVIDENCE',
  'INCIDENT_EVIDENCE',
  'AUDIT_EVIDENCE',
  'MEDICAL',
  'OTHER'
);

CREATE TYPE "DocumentStatus" AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'EXPIRED',
  'ARCHIVED'
);

ALTER TABLE "Document"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "fileName" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "DocumentVersion" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "documentId" TEXT NOT NULL,

  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

INSERT INTO "DocumentVersion" (
  "id",
  "version",
  "fileUrl",
  "fileName",
  "mimeType",
  "documentId"
)
SELECT "id" || '-v1', 1, "fileUrl", "fileName", "mimeType", "id"
FROM "Document";

ALTER TABLE "DocumentVersion"
  ADD CONSTRAINT "DocumentVersion_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
