import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTrainingDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  /** Sede donde se realiza la capacitacion (opcional, de la misma empresa). */
  @IsOptional()
  @IsUUID()
  siteId?: string;
}
