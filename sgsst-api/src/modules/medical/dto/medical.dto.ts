import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export const EXAM_TYPES = [
  'INGRESO',
  'PERIODICO',
  'RETIRO',
  'POSTINCAPACIDAD',
  'CAMBIO_CARGO',
] as const;

/** Concepto ocupacional operativo: nunca diagnostico ni historia clinica. */
export const EXAM_CONCEPTS = [
  'PENDIENTE',
  'APTO',
  'APTO_RESTRICCION',
  'NO_APTO',
] as const;

export class CreateMedicalProfileDto {
  /** Cargo al que aplica el profesiograma. */
  @IsString()
  position!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Requisitos medicos del cargo (tipo + periodicidad en meses). */
  @IsOptional()
  requirements?: {
    examType: string;
    periodicityMonths?: number;
    /** Riesgo de origen del requisito (derivacion #25.2, opcional). */
    derivedFromRiskId?: string | null;
  }[];

  /** Riesgo del cargo en la matriz GTC-45 (#25.2). Habilita la derivacion
   * automatica de requisitos por nivel de riesgo. */
  @IsOptional()
  @IsUUID()
  riskId?: string | null;

  @IsUUID()
  companyId!: string;
}

export class DeriveMedicalRequirementsDto {
  @IsUUID()
  companyId!: string;
}

export class CreateMedicalSurveillanceProgramDto {
  @IsString()
  name!: string;

  /** Tipo de riesgo vigilado (p. ej. MECANICO, BIOMECANICO, PSICOSOCIAL, FISICO, QUIMICO). */
  @IsString()
  riskType!: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdateMedicalSurveillanceProgramDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'CLOSED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED';

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;
}

export class DeriveSurveillanceCohortDto {
  /** Riesgo (con cargo o sede) del que se deriva la cohorte de expuestos. */
  @IsUUID()
  riskId!: string;

  @IsUUID()
  companyId!: string;
}

export class ReviewSurveillanceCohortDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'CLOSED'])
  status?: 'ACTIVE' | 'CLOSED';
}

export class CreateMedicalExamDto {
  @IsIn(EXAM_TYPES)
  examType!: (typeof EXAM_TYPES)[number];

  @IsIn(EXAM_CONCEPTS)
  concept?: (typeof EXAM_CONCEPTS)[number];

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsDateString()
  performedAt?: string | null;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string | null;

  /** Notas operativas (recomendaciones genericas); nunca diagnostico. */
  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsUUID()
  employeeId!: string;

  @IsUUID()
  companyId!: string;
}

export class UpdateMedicalExamDto {
  @IsOptional()
  @IsIn(EXAM_CONCEPTS)
  concept?: (typeof EXAM_CONCEPTS)[number];

  @IsOptional()
  @IsDateString()
  performedAt?: string | null;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsDateString()
  nextDueAt?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CreateMedicalRestrictionDto {
  @IsString()
  description!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  /** Examen del cual deriva la restriccion (opcional). */
  @IsOptional()
  @IsUUID()
  examId?: string | null;

  @IsUUID()
  employeeId!: string;

  @IsUUID()
  companyId!: string;
}

export class LiftMedicalRestrictionDto {
  @IsString()
  liftedBy!: string;
}

// --- #44: catalogo CIE-10 y casos PVE -------------------------------------

/** Estado clinico del caso PVE: sospecha -> confirmado -> cerrado. */
export const PVE_CASE_STATUSES = ['SUSPECTED', 'CONFIRMED', 'CLOSED'] as const;

/** Transiciones validas (solo hacia adelante); el cierre sella closedAt. */
export const PVE_CASE_STATUS_TRANSITIONS: Record<
  (typeof PVE_CASE_STATUSES)[number],
  (typeof PVE_CASE_STATUSES)[number][]
> = {
  SUSPECTED: ['CONFIRMED', 'CLOSED'],
  CONFIRMED: ['CLOSED'],
  CLOSED: [],
};

export class CreatePveDiagnosisDto {
  /** Codigo CIE-10 (p. ej. M54.5). Unico por empresa. */
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  /** Categoria del catalogo (p. ej. trastornos musculoesqueleticos). */
  @IsOptional()
  @IsString()
  category?: string;

  @IsUUID()
  companyId!: string;
}

export class UpdatePveDiagnosisDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string | null;

  /** Inactivo: el codigo deja de ofrecerse para casos nuevos (los existentes no cambian). */
  @IsOptional()
  active?: boolean;
}

export class CreatePveCaseDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  programId!: string;

  /** Cohorte de origen (opcional); debe pertenecer al programa indicado. */
  @IsOptional()
  @IsUUID()
  cohortId?: string | null;

  @IsUUID()
  diagnosisId!: string;

  @IsOptional()
  @IsIn(PVE_CASE_STATUSES)
  status?: (typeof PVE_CASE_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  reportedAt?: string;

  /** Proximo control: alimenta las alertas de seguimiento del caso. */
  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string | null;

  /** Dias de ausentismo reportados para la tasa sobre expuestos. */
  @IsOptional()
  @IsInt()
  @Min(0)
  absenceDays?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdatePveCaseDto {
  @IsOptional()
  @IsUUID()
  cohortId?: string | null;

  @IsOptional()
  @IsUUID()
  diagnosisId?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  absenceDays?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdatePveCaseStatusDto {
  @IsIn(PVE_CASE_STATUSES)
  status!: (typeof PVE_CASE_STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string | null;
}

/** Paginado del listado de casos (query params: mismos limites que contractors). */
export class ListPveCasesQueryDto {
  // Los query params llegan como string: se convierten a numero antes de
  // validar (con forbidNonWhitelisted, un tipo mal convertido responde 400).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsIn(PVE_CASE_STATUSES)
  status?: (typeof PVE_CASE_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  programId?: string;

  @IsOptional()
  @IsUUID()
  diagnosisId?: string;
}
