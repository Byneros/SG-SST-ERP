-- S9.3 (issue #23): Actos y condiciones inseguras con reporte directo.
-- Reutilizan InspectionFinding via unsafeReportId (reporte sin inspeccion).
-- S9.4 (issue #24): Catalogo EPP con stock y entregas por trabajador.
-- El descuento de stock se hace en servicio dentro de una transaccion.

-- CreateTable
CREATE TABLE "UnsafeReport" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'UNSAFE_CONDITION',
    "description" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MINOR',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "area" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "reporterName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "companyId" TEXT NOT NULL,
    "siteId" TEXT,
    "reporterId" TEXT,

    CONSTRAINT "UnsafeReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpeItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "standard" TEXT,
    "size" TEXT,
    "usefulLifeDays" INTEGER,
    "stockMin" INTEGER NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "PpeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpeDelivery" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueReplacementAt" TIMESTAMP(3),
    "signature" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "itemId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "PpeDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UnsafeReport_companyId_status_idx" ON "UnsafeReport"("companyId", "status");

-- CreateIndex
CREATE INDEX "UnsafeReport_kind_idx" ON "UnsafeReport"("kind");

-- CreateIndex
CREATE INDEX "PpeItem_companyId_isActive_idx" ON "PpeItem"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "PpeDelivery_employeeId_idx" ON "PpeDelivery"("employeeId");

-- CreateIndex
CREATE INDEX "PpeDelivery_itemId_idx" ON "PpeDelivery"("itemId");

-- AddForeignKey
ALTER TABLE "UnsafeReport" ADD CONSTRAINT "UnsafeReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnsafeReport" ADD CONSTRAINT "UnsafeReport_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnsafeReport" ADD CONSTRAINT "UnsafeReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpeItem" ADD CONSTRAINT "PpeItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpeDelivery" ADD CONSTRAINT "PpeDelivery_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "PpeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpeDelivery" ADD CONSTRAINT "PpeDelivery_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PpeDelivery" ADD CONSTRAINT "PpeDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- InspectionFinding: enlace opcional a UnsafeReport (reporte directo S9.3)
ALTER TABLE "InspectionFinding" ADD COLUMN "unsafeReportId" TEXT;

-- CreateIndex
CREATE INDEX "InspectionFinding_unsafeReportId_idx" ON "InspectionFinding"("unsafeReportId");

-- AddForeignKey
ALTER TABLE "InspectionFinding" ADD CONSTRAINT "InspectionFinding_unsafeReportId_fkey" FOREIGN KEY ("unsafeReportId") REFERENCES "UnsafeReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
