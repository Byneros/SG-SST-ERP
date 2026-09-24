import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateSgsstEvaluationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  standard?: string;

  @IsOptional()
  @IsIn(['I', 'II', 'III', 'IV', 'V'])
  riskClass?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsIn(['IN_PROGRESS', 'COMPLETED'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
