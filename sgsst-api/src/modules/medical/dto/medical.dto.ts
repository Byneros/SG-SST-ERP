import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

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
