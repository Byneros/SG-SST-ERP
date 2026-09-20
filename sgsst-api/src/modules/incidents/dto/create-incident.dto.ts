import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateIncidentDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  /** Sede donde ocurrio el incidente (opcional, de la misma empresa). */
  @IsOptional()
  @IsUUID()
  siteId?: string;
}
