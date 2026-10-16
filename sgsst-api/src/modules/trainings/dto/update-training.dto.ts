import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class UpdateTrainingDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  /** Sede de la capacitacion; null la desasigna. Debe ser de la misma empresa. */
  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  /** Instructor/facilitador de la capacitación (#58). */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  instructor?: string | null;

  /** Meses de vigencia del certificado; deriva el vencimiento por asistente. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  validityMonths?: number | null;
}
