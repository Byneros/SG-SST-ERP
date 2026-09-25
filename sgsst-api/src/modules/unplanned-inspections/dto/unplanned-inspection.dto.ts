import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const UNPLANNED_STATUSES = [
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;

export const FINDING_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;

export const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export class CreateUnplannedInspectionDto {
  @IsString()
  title!: string;

  /** Motivo de la inspeccion reactiva (obligatorio segun S9.2). */
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsIn(UNPLANNED_STATUSES)
  status?: (typeof UNPLANNED_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  executedAt?: string | null;

  @IsOptional()
  @IsString()
  result?: string | null;

  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsUUID()
  inspectorId?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdateUnplannedInspectionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsIn(UNPLANNED_STATUSES)
  status?: (typeof UNPLANNED_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  executedAt?: string | null;

  @IsOptional()
  @IsString()
  result?: string | null;

  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsUUID()
  inspectorId?: string | null;
}

export class CreateUnplannedFindingDto {
  @IsString()
  description!: string;

  @IsIn(FINDING_SEVERITIES)
  severity!: (typeof FINDING_SEVERITIES)[number];

  /**
   * Si se envia, crea ademas un Risk en la matriz GTC-45 con este nivel
   * y lo vincula al hallazgo (trazabilidad hallazgo -> riesgo).
   */
  @IsOptional()
  @IsIn(RISK_LEVELS)
  riskLevel?: (typeof RISK_LEVELS)[number];
}

export class UpdateUnplannedFindingDto {
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
