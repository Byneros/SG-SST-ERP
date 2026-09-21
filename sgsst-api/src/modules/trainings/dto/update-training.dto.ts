import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateTrainingDto {
  @IsOptional()
  @IsString()
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
}
