import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateIndicatorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  formulaDefinition?: string;

  @IsOptional()
  @IsIn(['LOWER_IS_BETTER', 'HIGHER_IS_BETTER'])
  direction?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  /** Cambia la sede del indicador (UUID) o lo desasigna (null). */
  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsBoolean()
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
