-- FASE 7.1: programas de auditoria y checklist por auditoria.
ALTER TABLE "Audit" ADD COLUMN "programId" TEXT;
ALTER TABLE "Audit" ADD COLUMN "checklistTemplate" JSONB;

CREATE INDEX "Audit_programId_idx" ON "Audit"("programId");

ALTER TABLE "Audit" ADD CONSTRAINT "Audit_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "AuditProgram"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AuditProgram" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "objective" TEXT,
  "scope" TEXT,
  "companyId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuditProgram_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditProgram_companyId_idx" ON "AuditProgram"("companyId");

ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Checklist por auditoria: items con respuesta, evidencia y responsable.
CREATE TABLE "AuditChecklistItem" (
  "id" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "section" TEXT,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "notes" TEXT,
  "responsible" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuditChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditChecklistItem_auditId_idx" ON "AuditChecklistItem"("auditId");

ALTER TABLE "AuditChecklistItem" ADD CONSTRAINT "AuditChecklistItem_auditId_fkey"
  FOREIGN KEY ("auditId") REFERENCES "Audit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- FASE 7.2: evaluacion de estandares minimos (Resolucion 0312 de 2019).
CREATE TABLE "SgsstEvaluation" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "standard" TEXT NOT NULL DEFAULT 'RES_0312_2019',
  "riskClass" TEXT NOT NULL,
  "period" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "score" DOUBLE PRECISION,
  "maxScore" DOUBLE PRECISION,
  "compliancePercent" DOUBLE PRECISION,
  "notes" TEXT,
  "companyId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SgsstEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SgsstEvaluation_companyId_idx" ON "SgsstEvaluation"("companyId");

ALTER TABLE "SgsstEvaluation" ADD CONSTRAINT "SgsstEvaluation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EvaluationItem" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "numeral" TEXT,
  "section" TEXT,
  "question" TEXT NOT NULL,
  "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "score" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EvaluationItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvaluationItem_evaluationId_idx" ON "EvaluationItem"("evaluationId");

ALTER TABLE "EvaluationItem" ADD CONSTRAINT "EvaluationItem_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "SgsstEvaluation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- FASE 7.3: indicadores SG-SST con formula, metas, mediciones y periodos.
ALTER TABLE "Indicator" ADD COLUMN "code" TEXT;
ALTER TABLE "Indicator" ADD COLUMN "description" TEXT;
ALTER TABLE "Indicator" ADD COLUMN "unit" TEXT;
ALTER TABLE "Indicator" ADD COLUMN "formulaDefinition" TEXT;
ALTER TABLE "Indicator" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'LOWER_IS_BETTER';
ALTER TABLE "Indicator" ADD COLUMN "siteId" TEXT;
ALTER TABLE "Indicator" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Indicator" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Indicator" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX "Indicator_companyId_code_key" ON "Indicator"("companyId", "code");
CREATE INDEX "Indicator_siteId_idx" ON "Indicator"("siteId");

ALTER TABLE "Indicator" ADD CONSTRAINT "Indicator_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "Site"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "IndicatorTarget" (
  "id" TEXT NOT NULL,
  "indicatorId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "target" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IndicatorTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IndicatorTarget_indicatorId_period_key" ON "IndicatorTarget"("indicatorId", "period");
CREATE INDEX "IndicatorTarget_indicatorId_idx" ON "IndicatorTarget"("indicatorId");

ALTER TABLE "IndicatorTarget" ADD CONSTRAINT "IndicatorTarget_indicatorId_fkey"
  FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IndicatorMeasurement" (
  "id" TEXT NOT NULL,
  "indicatorId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IndicatorMeasurement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IndicatorMeasurement_indicatorId_idx" ON "IndicatorMeasurement"("indicatorId");
CREATE UNIQUE INDEX "IndicatorMeasurement_indicatorId_period_key" ON "IndicatorMeasurement"("indicatorId", "period");

ALTER TABLE "IndicatorMeasurement" ADD CONSTRAINT "IndicatorMeasurement_indicatorId_fkey"
  FOREIGN KEY ("indicatorId") REFERENCES "Indicator"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
