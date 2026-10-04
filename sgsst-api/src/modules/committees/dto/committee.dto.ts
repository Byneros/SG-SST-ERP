import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const COMMITTEE_TYPES = ['COPASST', 'CONVIVENCIA'] as const;

export const COMMITTEE_STATUSES = ['ACTIVE', 'CLOSED'] as const;

export const COMMITTEE_MEMBER_ROLES = [
  'PRESIDENT',
  'SECRETARY',
  'PRINCIPAL',
  'SUPERNUMERARY',
] as const;

export const COMMITTEE_SEAT_TYPES = ['PRINCIPAL', 'ALTERNATE'] as const;

export const COMMITTEE_MEETING_STATUSES = [
  'SCHEDULED',
  'HELD',
  'CANCELLED',
] as const;

export class CreateCommitteeDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsIn(COMMITTEE_TYPES)
  type!: (typeof COMMITTEE_TYPES)[number];

  /** Inicio del periodo (eleccion). */
  @IsDateString()
  periodStart!: string;

  /** Fin del periodo (eleccion). */
  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsIn(COMMITTEE_STATUSES)
  status?: (typeof COMMITTEE_STATUSES)[number];

  @IsUUID()
  companyId!: string;
}

export class UpdateCommitteeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(COMMITTEE_TYPES)
  type?: (typeof COMMITTEE_TYPES)[number];

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsIn(COMMITTEE_STATUSES)
  status?: (typeof COMMITTEE_STATUSES)[number];
}

export class CommitteeListQueryDto {
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
  @IsIn(COMMITTEE_TYPES)
  type?: (typeof COMMITTEE_TYPES)[number];

  @IsOptional()
  @IsIn(COMMITTEE_STATUSES)
  status?: (typeof COMMITTEE_STATUSES)[number];
}

export class CreateCommitteeMemberDto {
  @IsIn(COMMITTEE_MEMBER_ROLES)
  role!: (typeof COMMITTEE_MEMBER_ROLES)[number];

  @IsOptional()
  @IsIn(COMMITTEE_SEAT_TYPES)
  seatType?: (typeof COMMITTEE_SEAT_TYPES)[number];

  /** Inicio de vigencia del integrante. */
  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  /** Integrante (empleado de la misma empresa). */
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  companyId!: string;
}

export class UpdateCommitteeMemberDto {
  @IsOptional()
  @IsIn(COMMITTEE_MEMBER_ROLES)
  role?: (typeof COMMITTEE_MEMBER_ROLES)[number];

  @IsOptional()
  @IsIn(COMMITTEE_SEAT_TYPES)
  seatType?: (typeof COMMITTEE_SEAT_TYPES)[number];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class CreateCommitteeMeetingDto {
  /** Numero de reunion dentro del comite (unico por comite). */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  number!: number;

  @IsDateString()
  meetingAt!: string;

  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(COMMITTEE_MEETING_STATUSES)
  status?: (typeof COMMITTEE_MEETING_STATUSES)[number];

  /** Acta como documento del expediente (criterio S11.1: acta (document)). */
  @IsOptional()
  @IsUUID()
  minutesDocumentId?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdateCommitteeMeetingDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  number?: number;

  @IsOptional()
  @IsDateString()
  meetingAt?: string;

  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(COMMITTEE_MEETING_STATUSES)
  status?: (typeof COMMITTEE_MEETING_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  minutesDocumentId?: string | null;
}

export class CreateCommitteeCommitmentDto {
  @IsString()
  @MinLength(3)
  description!: string;

  /** Responsable del seguimiento (empleado de la misma empresa). */
  @IsUUID()
  responsibleEmployeeId!: string;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdateCommitteeCommitmentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;

  @IsOptional()
  @IsUUID()
  responsibleEmployeeId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  /** Fecha de cierre del compromiso; null la limpia. */
  @IsOptional()
  @IsDateString()
  completedAt?: string | null;
}
