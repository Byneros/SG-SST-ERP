import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const CONTRACTOR_STATUSES = ['ACTIVE', 'SUSPENDED', 'BLOCKED'] as const;

export const CONTRACTOR_WORKER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export const CONTRACTOR_DOCUMENT_STATUSES = [
  'PENDING',
  'VALID',
  'EXPIRED',
  'REJECTED',
] as const;

export class CreateContractorDto {
  @IsString()
  name!: string;

  @IsString()
  nit!: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  arl?: string;

  @IsOptional()
  @IsString()
  activity?: string;

  @IsOptional()
  @IsIn(CONTRACTOR_STATUSES)
  status?: (typeof CONTRACTOR_STATUSES)[number];

  @IsUUID()
  companyId!: string;
}

export class UpdateContractorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  nit?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  arl?: string;

  @IsOptional()
  @IsString()
  activity?: string;

  @IsOptional()
  @IsIn(CONTRACTOR_STATUSES)
  status?: (typeof CONTRACTOR_STATUSES)[number];
}

export class CreateContractorWorkerDto {
  @IsString()
  document!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  job?: string;

  /** Induccion completada (fecha); habilita el ingreso del personal. */
  @IsOptional()
  @IsDateString()
  inductedAt?: string | null;

  @IsOptional()
  @IsIn(CONTRACTOR_WORKER_STATUSES)
  status?: (typeof CONTRACTOR_WORKER_STATUSES)[number];

  @IsUUID()
  companyId!: string;
}

export class UpdateContractorWorkerDto {
  @IsOptional()
  @IsString()
  document?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  job?: string;

  @IsOptional()
  @IsDateString()
  inductedAt?: string | null;

  @IsOptional()
  @IsIn(CONTRACTOR_WORKER_STATUSES)
  status?: (typeof CONTRACTOR_WORKER_STATUSES)[number];
}

export class CreateContractorDocumentDto {
  @IsString()
  documentType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsIn(CONTRACTOR_DOCUMENT_STATUSES)
  status?: (typeof CONTRACTOR_DOCUMENT_STATUSES)[number];

  /** Evidencia documental: debe ser un Document de la misma empresa. */
  @IsOptional()
  @IsUUID()
  evidenceId?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdateContractorDocumentDto {
  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsIn(CONTRACTOR_DOCUMENT_STATUSES)
  status?: (typeof CONTRACTOR_DOCUMENT_STATUSES)[number];

  /** Evidencia documental; null la desasigna. */
  @IsOptional()
  @IsUUID()
  evidenceId?: string | null;
}

export class ContractorListQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(CONTRACTOR_STATUSES)
  status?: (typeof CONTRACTOR_STATUSES)[number];
}
