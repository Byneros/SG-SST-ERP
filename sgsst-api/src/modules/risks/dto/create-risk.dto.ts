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
}
