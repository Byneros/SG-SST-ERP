import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(['PENDING', 'IN_PROGRESS', 'RESOLVED'])
  status?: string;

  /** Sede del incidente; null lo desasigna. Debe ser de la misma empresa. */
  @IsOptional()
  @IsUUID()
  siteId?: string | null;
}
