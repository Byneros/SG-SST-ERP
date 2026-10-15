-- #57 (S5): matriz de riesgos GTC-45 estructurada. Jerarquía
-- Proceso → Actividad → Peligro → Valoración/Controles, con Risk como
-- resultado final trazable (Risk.hazardId unique, ON DELETE SET NULL).
-- El alcance multi-tenant vive en RiskProcess; los hijos se acotan por
-- la cadena de padres (patrón InspectionItem).

CREATE TYPE "HazardType" AS ENUM ('FISICO', 'QUIMICO', 'BIOLOGICO', 'BIOMECANICO', 'PSICOSOCIAL', 'LOCATIVO', 'TECNOLOGICO', 'FENOMENOS_NATURALES');

CREATE TYPE "HazardControlSource" AS ENUM ('ADMINISTRATIVO', 'OPERACIONAL', 'COMPORTAMIENTO', 'EPP');

CREATE TYPE "RiskGtcLevel" AS ENUM ('I', 'II', 'III', 'IV');

CREATE TABLE "RiskProcess" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "RiskProcess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskActivity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processId" TEXT NOT NULL,

    CONSTRAINT "RiskActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskHazard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hazardType" "HazardType" NOT NULL DEFAULT 'FISICO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "RiskHazard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskValoracion" (
    "id" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "severity" INTEGER NOT NULL,
    "riskLevel" "RiskGtcLevel" NOT NULL,
    "hazardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskValoracion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HazardControl" (
    "id" TEXT NOT NULL,
    "source" "HazardControlSource" NOT NULL,
    "type" TEXT,
    "effectiveness" TEXT,
    "hazardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HazardControl_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Risk" ADD COLUMN "hazardId" TEXT;
CREATE UNIQUE INDEX "Risk_hazardId_key" ON "Risk"("hazardId");
CREATE INDEX "RiskProcess_companyId_idx" ON "RiskProcess"("companyId");
CREATE INDEX "RiskActivity_processId_idx" ON "RiskActivity"("processId");
CREATE INDEX "RiskHazard_activityId_idx" ON "RiskHazard"("activityId");
CREATE INDEX "RiskValoracion_hazardId_idx" ON "RiskValoracion"("hazardId");
CREATE INDEX "HazardControl_hazardId_idx" ON "HazardControl"("hazardId");

ALTER TABLE "RiskProcess" ADD CONSTRAINT "RiskProcess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RiskActivity" ADD CONSTRAINT "RiskActivity_processId_fkey" FOREIGN KEY ("processId") REFERENCES "RiskProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskHazard" ADD CONSTRAINT "RiskHazard_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "RiskActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiskValoracion" ADD CONSTRAINT "RiskValoracion_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "RiskHazard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HazardControl" ADD CONSTRAINT "HazardControl_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "RiskHazard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "RiskHazard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
