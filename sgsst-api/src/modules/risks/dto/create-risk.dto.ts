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

  /** Cargo asociado (profesiograma S10.1): habilita la derivacion de
   * requisitos medicos y cohortes de vigilancia desde la matriz (#25/#28). */
  @IsOptional()
  @IsString()
  position?: string;
}
