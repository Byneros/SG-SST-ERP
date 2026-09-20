import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRiskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  level!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  /** Sede donde aplica el riesgo (opcional, de la misma empresa). */
  @IsOptional()
  @IsUUID()
  siteId?: string;
}
