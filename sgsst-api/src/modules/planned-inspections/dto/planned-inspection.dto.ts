import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const INSPECTION_TYPES = [
  'LOCATIVE',
  'EPP',
  'EQUIPMENT',
  'TOOLS',
  'ORDER_CLEANING',
  'EMERGENCY',
] as const;

export const INSPECTION_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export const FINDING_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;

export class CreatePlannedInspectionDto {
  @IsString()
  title!: string;

  @IsIn(INSPECTION_TYPES)
  type?: (typeof INSPECTION_TYPES)[number];

  /** Frecuencia (p. ej. Mensual, Trimestral). */
  @IsOptional()
  @IsString()
  frequency?: string;

  @IsDateString()
  scheduledAt!: string;

  /** Estado inicial; el default de BD es PLANNED (paridad con no planeadas). */
  @IsOptional()
  @IsIn(INSPECTION_STATUSES)
  status?: (typeof INSPECTION_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  /** Inspector (usuario de la empresa). */
  @IsOptional()
  @IsUUID()
  inspectorId?: string | null;

  /** Items iniciales del checklist. */
  @IsOptional()
  @IsArray()
  items?: {
    order?: number;
    section?: string;
    question: string;
  }[];

  @IsUUID()
  companyId!: string;
}

export class UpdatePlannedInspectionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(INSPECTION_TYPES)
  type?: (typeof INSPECTION_TYPES)[number];

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  executedAt?: string | null;

  @IsOptional()
  @IsString()
  result?: string | null;

  @IsOptional()
  @IsIn(INSPECTION_STATUSES)
  status?: (typeof INSPECTION_STATUSES)[number];

  /** Sede del update; null la desasigna. Debe ser de la misma empresa. */
  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsUUID()
  inspectorId?: string | null;
}

export class UpdateInspectionItemDto {
  @IsOptional()
  @IsString()
  answer?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CreateInspectionFindingDto {
  @IsString()
  description!: string;

  @IsIn(FINDING_SEVERITIES)
  severity!: (typeof FINDING_SEVERITIES)[number];
}

export class UpdateInspectionFindingDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(FINDING_SEVERITIES)
  severity?: (typeof FINDING_SEVERITIES)[number];

  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'CLOSED'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
}

export class CreateCorrectiveActionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  responsible!: string;

  @IsDateString()
  dueDate!: string;
}
