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

export const ACTION_KINDS = [
  'CORRECTIVE',
  'PREVENTIVE',
  'IMPROVEMENT',
] as const;

export const ACTION_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'DONE',
  'VERIFIED',
  'CANCELLED',
] as const;

/** Etapas a las que se puede avanzar (solo hacia adelante). */
export const ACTION_TARGETS = ['IN_PROGRESS', 'DONE'] as const;

export const ACTION_EFFECTIVENESS = ['EFFECTIVE', 'INEFFECTIVE'] as const;

/** Origen trazable: hallazgo unificado (S15.1) o accion sin origen. */
export const ACTION_SOURCE_TYPES = ['FINDING', 'MANUAL'] as const;

export class CreateActionPlanDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsIn(ACTION_KINDS)
  kind!: (typeof ACTION_KINDS)[number];

  /** La CORRECTIVE nace de un hallazgo: exige sourceType FINDING + sourceId. */
  @IsOptional()
  @IsIn(ACTION_SOURCE_TYPES)
  sourceType?: (typeof ACTION_SOURCE_TYPES)[number];

  @IsOptional()
  @IsUUID()
  sourceId?: string | null;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  expectedBenefit?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @IsDateString()
  dueDate!: string;

  @IsUUID()
  companyId!: string;
}

export class UpdateActionPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  expectedBenefit?: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /** Solo se permite CANCELLED y solo desde OPEN/IN_PROGRESS (service valida). */
  @IsOptional()
  @IsIn(['CANCELLED'])
  status?: 'CANCELLED';

  /** Evidencia de ejecucion (requisito para DONE); debe ser Document del tenant. */
  @IsOptional()
  @IsUUID()
  evidenceId?: string | null;
}

export class AdvanceActionPlanDto {
  @IsIn(ACTION_TARGETS)
  target!: (typeof ACTION_TARGETS)[number];
}

export class VerifyActionPlanDto {
  @IsIn(ACTION_EFFECTIVENESS)
  effectiveness!: (typeof ACTION_EFFECTIVENESS)[number];

  @IsOptional()
  @IsString()
  result?: string;
}

export class ActionsListQueryDto {
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
  @IsIn(ACTION_KINDS)
  kind?: (typeof ACTION_KINDS)[number];

  @IsOptional()
  @IsIn(ACTION_STATUSES)
  status?: (typeof ACTION_STATUSES)[number];
}
