import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export const UNSAFE_KINDS = ['UNSAFE_ACT', 'UNSAFE_CONDITION'] as const;

export const UNSAFE_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const;

export const FINDING_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;

export class CreateUnsafeReportDto {
  /** UNAFE_ACT = comportamiento; UNSAFE_CONDITION = condicion fisica. */
  @IsIn(UNSAFE_KINDS)
  kind!: (typeof UNSAFE_KINDS)[number];

  @IsString()
  description!: string;

  @IsIn(FINDING_SEVERITIES)
  severity!: (typeof FINDING_SEVERITIES)[number];

  @IsOptional()
  @IsString()
  area?: string;

  /** Reporte anonimo: se ignora reporterName y no se expone al trabajador. */
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsString()
  reporterName?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdateUnsafeReportDto {
  @IsOptional()
  @IsIn(UNSAFE_KINDS)
  kind?: (typeof UNSAFE_KINDS)[number];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(FINDING_SEVERITIES)
  severity?: (typeof FINDING_SEVERITIES)[number];

  @IsOptional()
  @IsIn(UNSAFE_STATUSES)
  status?: (typeof UNSAFE_STATUSES)[number];

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string | null;
}

export class CreateUnsafeFindingDto {
  @IsString()
  description!: string;

  @IsIn(FINDING_SEVERITIES)
  severity!: (typeof FINDING_SEVERITIES)[number];
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
