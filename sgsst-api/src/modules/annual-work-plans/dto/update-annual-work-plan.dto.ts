import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateAnnualWorkPlanDto {
  @IsOptional()
  @IsInt()
  @Min(2000)
  year?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'APPROVED', 'IN_PROGRESS', 'CLOSED'])
  status?: 'DRAFT' | 'APPROVED' | 'IN_PROGRESS' | 'CLOSED';

  @IsOptional()
  @IsString()
  notes?: string;

  /** Aprobador del plan; null lo desasigna. */
  @IsOptional()
  @IsUUID()
  approvedById?: string | null;

  @IsOptional()
  @IsDateString()
  approvedAt?: string | null;
}
