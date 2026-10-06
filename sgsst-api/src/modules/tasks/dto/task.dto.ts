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

export const TASK_SOURCE_TYPES = [
  'FINDING',
  'ACTION_PLAN',
  'CHANGE_REQUEST',
  'MANUAL',
] as const;

export const TASK_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
] as const;

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export class CreateTaskDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** MANUAL no exige sourceId; los demas origenes deben existir en el tenant. */
  @IsIn(TASK_SOURCE_TYPES)
  sourceType!: (typeof TASK_SOURCE_TYPES)[number];

  @IsOptional()
  @IsUUID()
  sourceId?: string | null;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: (typeof TASK_PRIORITIES)[number];

  @IsUUID()
  companyId!: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: (typeof TASK_PRIORITIES)[number];

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: (typeof TASK_STATUSES)[number];
}

export class CreateTaskCommentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;
}

export class TasksListQueryDto {
  // Los query params llegan como string: se convierten a numero antes de
  // validar (mismo patron del listado de findings).
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
  @IsIn(TASK_SOURCE_TYPES)
  sourceType?: (typeof TASK_SOURCE_TYPES)[number];

  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: (typeof TASK_STATUSES)[number];

  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: (typeof TASK_PRIORITIES)[number];

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  /** "mis tareas": filtra por el usuario autenticado (o sin responsable). */
  @IsOptional()
  @IsIn(['me'])
  assignee?: 'me';

  /** Solo tareas activas (OPEN/IN_PROGRESS) con vencimiento pasado. */
  @IsOptional()
  @IsIn(['true'])
  overdue?: 'true';

  /** Tareas activas que vencen dentro de N dias (incluye vencidas). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  dueWithinDays?: number;
}
