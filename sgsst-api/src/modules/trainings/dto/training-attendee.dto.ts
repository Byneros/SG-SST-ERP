import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** #58: evaluación del asistente; PASSED habilita el vencimiento derivado. */
export const TRAINING_ATTENDEE_STATUSES = [
  'ATTENDED',
  'PASSED',
  'FAILED',
] as const;

export class CreateTrainingAttendeeDto {
  /** Trabajador del tenant; si se omite, el asistente es externo (name). */
  @IsOptional()
  @IsUUID()
  employeeId?: string | null;

  /** Nombre congelado en la asistencia; obligatorio sin employeeId (checa el service). */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name?: string;

  /** Evaluación de eficacia 0–100. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number | null;

  @IsOptional()
  @IsEnum(TRAINING_ATTENDEE_STATUSES)
  status?: (typeof TRAINING_ATTENDEE_STATUSES)[number];

  /** Vencimiento del certificado; si falta y la capacitación tiene vigencia, se deriva. */
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  /** Evidencia documental por trabajador; debe ser un documento de la empresa. */
  @IsOptional()
  @IsUUID()
  evidenceId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateTrainingAttendeeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number | null;

  @IsOptional()
  @IsEnum(TRAINING_ATTENDEE_STATUSES)
  status?: (typeof TRAINING_ATTENDEE_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsUUID()
  evidenceId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
