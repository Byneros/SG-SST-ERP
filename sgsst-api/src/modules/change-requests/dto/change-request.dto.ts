import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const CHANGE_REQUEST_STATUSES = [
  'REQUESTED',
  'EVALUATION',
  'CONTROLS',
  'APPROVAL',
  'IMPLEMENTATION',
  'VERIFICATION',
  'CLOSED',
] as const;

/** Etapas a las que se puede avanzar (solo hacia adelante). */
export const CHANGE_REQUEST_TARGETS = [
  'EVALUATION',
  'CONTROLS',
  'APPROVAL',
  'IMPLEMENTATION',
  'VERIFICATION',
  'CLOSED',
] as const;

export class CreateChangeRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsString()
  @MinLength(2)
  process!: string;

  @IsString()
  @MinLength(3)
  responsible!: string;

  /** Solicitud con evaluacion obligatoria de riesgos (#38): Risk del tenant. */
  @IsUUID()
  riskId!: string;

  /** Peligros identificados por la evaluacion. */
  @IsOptional()
  @IsString()
  hazards?: string;

  /** Impactos potenciales del cambio. */
  @IsOptional()
  @IsString()
  impacts?: string;

  /** Controles propuestos para los riesgos del cambio. */
  @IsOptional()
  @IsString()
  controls?: string;

  @IsOptional()
  @IsDateString()
  requestedAt?: string;

  @IsUUID()
  companyId!: string;
}

export class UpdateChangeRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  process?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  responsible?: string;

  @IsOptional()
  @IsUUID()
  riskId?: string | null;

  @IsOptional()
  @IsString()
  hazards?: string;

  @IsOptional()
  @IsString()
  impacts?: string;

  @IsOptional()
  @IsString()
  controls?: string;

  /** Evidencia documental de implementacion; debe ser Document del tenant. */
  @IsOptional()
  @IsUUID()
  implementationEvidenceId?: string | null;

  @IsOptional()
  @IsString()
  implementationNotes?: string;

  @IsOptional()
  @IsString()
  verificationNotes?: string;
}

export class AdvanceChangeRequestDto {
  /** Etapa destino del workflow: solo transiciones hacia adelante. */
  @IsIn(CHANGE_REQUEST_TARGETS)
  target!: (typeof CHANGE_REQUEST_TARGETS)[number];
}

export class ChangeRequestListQueryDto {
  // Los query params llegan como string: se convierten a numero antes de
  // validar (sin esto, GET paginado desde la UI responde 400).
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
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(CHANGE_REQUEST_STATUSES)
  status?: (typeof CHANGE_REQUEST_STATUSES)[number];
}
