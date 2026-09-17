import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class UpdateCompanyLegalRequirementDto {
  @IsOptional()
  @IsBoolean()
  applies?: boolean;

  @IsOptional()
  @IsIn(['PENDING', 'COMPLIES', 'PARTIAL', 'NON_COMPLIANT', 'NOT_APPLICABLE'])
  status?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  nextReviewAt?: string;

  @IsOptional()
  @IsDateString()
  lastReviewedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
