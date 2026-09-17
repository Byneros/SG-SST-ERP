import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(['PENDING', 'IN_PROGRESS', 'RESOLVED'])
  status?: string;
}
