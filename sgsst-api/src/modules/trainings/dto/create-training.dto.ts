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
}
