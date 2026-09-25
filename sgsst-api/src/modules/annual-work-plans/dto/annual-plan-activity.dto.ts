import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

/** Ciclos PHVA del plan anual de trabajo. */
export const ACTIVITY_CYCLES = [
  'PLANEAR',
  'HACER',
  'VERIFICAR',
  'ACTUAR',
  'ACT',
] as const;

export const ACTIVITY_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
] as const;

export class CreateAnnualPlanActivityDto {
  @IsIn(ACTIVITY_CYCLES)
  cycle?: (typeof ACTIVITY_CYCLES)[number];

  @IsString()
  name!: string;

  /** Frecuencia de la actividad (p. ej. Mensual, Anual). */
  @IsOptional()
  @IsString()
  frequency?: string;

  /** Fecha compromiso de la actividad. */
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  /** % de avance (0-100). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsIn(ACTIVITY_STATUSES)
  status?: (typeof ACTIVITY_STATUSES)[number];

  @IsOptional()
  @IsNumber()
  budget?: number | null;

  /** Responsable de la actividad (usuario de la empresa). */
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  /** Evidencia documental: debe ser un Document de la misma empresa. */
  @IsOptional()
  @IsUUID()
  evidenceId?: string | null;

  @IsUUID()
  planId!: string;

  @IsUUID()
  companyId!: string;
}

export class UpdateAnnualPlanActivityDto {
  @IsOptional()
  @IsIn(ACTIVITY_CYCLES)
  cycle?: (typeof ACTIVITY_CYCLES)[number];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  /** Fecha compromiso; null la limpia. */
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @Type(() => String)
  @IsIn(ACTIVITY_STATUSES)
  status?: (typeof ACTIVITY_STATUSES)[number];

  @IsOptional()
  @IsNumber()
  budget?: number | null;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  /** Evidencia documental; null la desasigna. */
  @IsOptional()
  @IsUUID()
  evidenceId?: string | null;
}
