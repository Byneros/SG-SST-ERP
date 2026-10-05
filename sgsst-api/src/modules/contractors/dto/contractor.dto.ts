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
import { Type } from 'class-transformer';

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

  /** Sede donde ejecuta su actividad (#35): debe ser sede de la empresa. */
  @IsOptional()
  @IsUUID()
  siteId?: string | null;

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

  /** Sede donde ejecuta su actividad; null la desasigna. */
  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsDateString()
  inductedAt?: string | null;

  @IsOptional()
  @IsIn(CONTRACTOR_WORKER_STATUSES)
  status?: (typeof CONTRACTOR_WORKER_STATUSES)[number];
}

/** Etapas del flujo de ingreso (#37) a las que se puede avanzar. */
export const CONTRACTOR_ENTRY_TARGETS = [
  'INDUCTION',
  'AUTHORIZED',
  'WORK',
  'CLOSED',
] as const;

export class AdvanceContractorEntryDto {
  /** Etapa destino del flujo: solo transiciones hacia adelante. */
  @IsIn(CONTRACTOR_ENTRY_TARGETS)
  target!: (typeof CONTRACTOR_ENTRY_TARGETS)[number];
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
  @IsIn(CONTRACTOR_STATUSES)
  status?: (typeof CONTRACTOR_STATUSES)[number];
}
