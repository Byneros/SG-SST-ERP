import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateRiskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  level?: string;

  /** Sede del riesgo; null lo desasigna. Debe ser de la misma empresa. */
  @IsOptional()
  @IsUUID()
  siteId?: string | null;
}
