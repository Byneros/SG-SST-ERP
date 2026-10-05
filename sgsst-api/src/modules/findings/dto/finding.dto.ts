import {
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

export const FINDING_SOURCE_TYPES = [
  'INSPECTION_PLANNED',
  'INSPECTION_UNPLANNED',
  'AUDIT',
  'UNSAFE_REPORT',
  'MANUAL',
] as const;

export const FINDING_TYPES = [
  'NON_CONFORMITY',
  'OPPORTUNITY',
  'OBSERVATION',
] as const;

export const FINDING_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;

export const FINDING_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const;

export class CreateFindingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(3)
  description!: string;

  @IsIn(FINDING_SOURCE_TYPES)
  sourceType!: (typeof FINDING_SOURCE_TYPES)[number];

  /** Requerido salvo para MANUAL; debe existir y ser del tenant. */
  @IsOptional()
  @IsUUID()
  sourceId?: string | null;

  @IsOptional()
  @IsIn(FINDING_TYPES)
  type?: (typeof FINDING_TYPES)[number];

  @IsOptional()
  @IsIn(FINDING_SEVERITIES)
  severity?: (typeof FINDING_SEVERITIES)[number];

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdateFindingDto {
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
  @IsIn(FINDING_TYPES)
  type?: (typeof FINDING_TYPES)[number];

  @IsOptional()
  @IsIn(FINDING_SEVERITIES)
  severity?: (typeof FINDING_SEVERITIES)[number];

  @IsOptional()
  @IsIn(FINDING_STATUSES)
  status?: (typeof FINDING_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;
}

export class CreateFindingCauseDto {
  /** Tipo de causa (metodo sugerido: Ishikawa/5 porques, texto libre controlado). */
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  causeType!: string;

  @IsString()
  @MinLength(3)
  description!: string;
}

export class FindingsListQueryDto {
  // Los query params llegan como string: se convierten a numero antes de
  // validar (mismo patron del listado de change-requests).
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
  @IsIn(FINDING_SOURCE_TYPES)
  sourceType?: (typeof FINDING_SOURCE_TYPES)[number];

  @IsOptional()
  @IsIn(FINDING_SEVERITIES)
  severity?: (typeof FINDING_SEVERITIES)[number];

  @IsOptional()
  @IsIn(FINDING_STATUSES)
  status?: (typeof FINDING_STATUSES)[number];
}
