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
  }[];

  @IsUUID()
  companyId!: string;
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
