import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateSgsstAuditDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'CLOSED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  auditorName?: string;

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsUUID()
  companyId!: string;
}
