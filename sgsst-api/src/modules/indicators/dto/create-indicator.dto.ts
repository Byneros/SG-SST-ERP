import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateIndicatorDto {
  @IsString()
  name!: string;

  /** Código único dentro de la empresa, p. ej. "IF-01" (indice de accidentalidad). */
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  /** Definición de la fórmula, p. ej. "(accidentes / empleados) * 100". */
  @IsOptional()
  @IsString()
  formulaDefinition?: string;

  /** LOWER_IS_BETTER (p. ej. accidentalidad) o HIGHER_IS_BETTER (p. ej. cumplimiento). */
  @IsOptional()
  @IsIn(['LOWER_IS_BETTER', 'HIGHER_IS_BETTER'])
  direction?: string;

  /** Último valor conocido del indicador. */
  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsUUID()
  companyId!: string;
}
