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

export const EMERGENCY_BRIGADE_ROLES = [
  'JEFE_BRIGADA',
  'PREVENCION_INCENDIOS',
  'PRIMEROS_AUXILIOS',
  'EVACUACION_RESCATE',
  'BRIGADISTA',
] as const;

export const EMERGENCY_THREAT_RISKS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export const EMERGENCY_RESOURCE_STATUSES = [
  'OPERATIVE',
  'MAINTENANCE',
  'EXPIRED',
] as const;

export const EMERGENCY_DRILL_STATUSES = [
  'PLANNED',
  'EXECUTED',
  'CLOSED',
  'CANCELLED',
] as const;

// --- Brigadas (#31) -----------------------------------------------------------

export class CreateEmergencyBrigadeDto {
  @IsString()
  @MinLength(2)
  name!: string;

  /** Brigada por sede (criterio #31). */
  @IsUUID()
  siteId!: string;

  @IsUUID()
  companyId!: string;
}

export class UpdateEmergencyBrigadeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;
}

export class EmergencyBrigadeListQueryDto {
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
  @IsUUID()
  siteId?: string;
}

export class CreateEmergencyBrigadeMemberDto {
  @IsIn(EMERGENCY_BRIGADE_ROLES)
  role!: (typeof EMERGENCY_BRIGADE_ROLES)[number];

  @IsOptional()
  @IsDateString()
  formationCompletedAt?: string | null;

  /** Vencimiento de la formacion (criterio #31: vencimientos). */
  @IsOptional()
  @IsDateString()
  validUntil?: string | null;

  @IsUUID()
  employeeId!: string;

  @IsUUID()
  companyId!: string;
}

export class UpdateEmergencyBrigadeMemberDto {
  @IsOptional()
  @IsIn(EMERGENCY_BRIGADE_ROLES)
  role?: (typeof EMERGENCY_BRIGADE_ROLES)[number];

  @IsOptional()
  @IsDateString()
  formationCompletedAt?: string | null;

  @IsOptional()
  @IsDateString()
  validUntil?: string | null;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

// --- Plan de emergencias por sede (#32) ----------------------------------------

export class CreateEmergencyPlanDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsUUID()
  siteId!: string;

  @IsOptional()
  @IsUUID()
  responsibleEmployeeId?: string | null;

  @IsOptional()
  @IsString()
  meetingPoint?: string;

  /** Rutas de evacuacion documentadas (criterio #32: rutas). */
  @IsOptional()
  @IsString()
  routesDescription?: string;

  /** Procedimientos de respuesta (criterio #32: procedimientos). */
  @IsOptional()
  @IsString()
  procedures?: string;

  /** Vulnerabilidades identificadas (criterio #32: vulnerabilidad). */
  @IsOptional()
  @IsString()
  vulnerabilityNotes?: string;

  @IsUUID()
  companyId!: string;
}

export class UpdateEmergencyPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  responsibleEmployeeId?: string | null;

  @IsOptional()
  @IsString()
  meetingPoint?: string;

  @IsOptional()
  @IsString()
  routesDescription?: string;

  @IsOptional()
  @IsString()
  procedures?: string;

  @IsOptional()
  @IsString()
  vulnerabilityNotes?: string;
}

export class EmergencyPlanListQueryDto {
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
  @IsUUID()
  siteId?: string;
}

export class CreateEmergencyThreatDto {
  @IsString()
  @MinLength(2)
  type!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(EMERGENCY_THREAT_RISKS)
  riskLevel?: (typeof EMERGENCY_THREAT_RISKS)[number];

  @IsUUID()
  companyId!: string;
}

export class UpdateEmergencyThreatDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  type?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(EMERGENCY_THREAT_RISKS)
  riskLevel?: (typeof EMERGENCY_THREAT_RISKS)[number];
}

export class CreateEmergencyResourceDto {
  @IsString()
  @MinLength(2)
  resourceType!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsIn(EMERGENCY_RESOURCE_STATUSES)
  status?: (typeof EMERGENCY_RESOURCE_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  lastInspectedAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdateEmergencyResourceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  resourceType?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsIn(EMERGENCY_RESOURCE_STATUSES)
  status?: (typeof EMERGENCY_RESOURCE_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  lastInspectedAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

// --- Simulacros (#33) ----------------------------------------------------------

export class CreateEmergencyDrillDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  scenario?: string;

  /** Simulacro vinculado a plan (y por ende a sede) — criterio #33. */
  @IsUUID()
  planId!: string;

  @IsDateString()
  plannedAt!: string;

  @IsUUID()
  companyId!: string;
}

export class UpdateEmergencyDrillDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  scenario?: string;

  @IsOptional()
  @IsDateString()
  plannedAt?: string;

  @IsOptional()
  @IsDateString()
  executedAt?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMinutes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  participants?: number | null;

  @IsOptional()
  @IsString()
  resultNotes?: string;

  @IsOptional()
  @IsIn(EMERGENCY_DRILL_STATUSES)
  status?: (typeof EMERGENCY_DRILL_STATUSES)[number];
}

export class EmergencyDrillListQueryDto {
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
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsIn(EMERGENCY_DRILL_STATUSES)
  status?: (typeof EMERGENCY_DRILL_STATUSES)[number];
}

export class CreateEmergencyDrillFindingDto {
  @IsString()
  @MinLength(3)
  description!: string;

  /** Reutiliza la escala de severidad de hallazgos (FindingSeverity). */
  @IsOptional()
  @IsIn(['MINOR', 'MAJOR', 'CRITICAL'])
  severity?: 'MINOR' | 'MAJOR' | 'CRITICAL';

  @IsOptional()
  @IsString()
  actionDescription?: string;

  @IsOptional()
  @IsString()
  actionResponsible?: string;

  @IsOptional()
  @IsDateString()
  actionDueDate?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdateEmergencyDrillFindingDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  description?: string;

  @IsOptional()
  @IsIn(['MINOR', 'MAJOR', 'CRITICAL'])
  severity?: 'MINOR' | 'MAJOR' | 'CRITICAL';

  @IsOptional()
  @IsString()
  actionDescription?: string;

  @IsOptional()
  @IsString()
  actionResponsible?: string;

  @IsOptional()
  @IsDateString()
  actionDueDate?: string | null;

  /** Cierre del hallazgo/accion; null lo reabre. */
  @IsOptional()
  @IsDateString()
  closedAt?: string | null;
}
