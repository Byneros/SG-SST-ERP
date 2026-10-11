-- S4.1: historial inmutable de aprobaciones por version documental.
CREATE TYPE "DocumentApprovalStatus" AS ENUM ('APPROVED');

CREATE TABLE "DocumentApproval" (
    "id" TEXT NOT NULL,
    "status" "DocumentApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "comments" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,
    "documentId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,

    CONSTRAINT "DocumentApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentApproval_documentId_version_key"
    ON "DocumentApproval"("documentId", "version");
CREATE INDEX "DocumentApproval_approverId_idx"
    ON "DocumentApproval"("approverId");

ALTER TABLE "DocumentApproval"
    ADD CONSTRAINT "DocumentApproval_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentApproval"
    ADD CONSTRAINT "DocumentApproval_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
