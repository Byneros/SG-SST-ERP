import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateAnnualWorkPlanDto {
  /** Anio del plan (p. ej. 2026). Unico por empresa. */
  @IsInt()
  @Min(2000)
  year!: number;

  @IsOptional()
  @IsIn(['DRAFT', 'APPROVED', 'IN_PROGRESS', 'CLOSED'])
  status?: 'DRAFT' | 'APPROVED' | 'IN_PROGRESS' | 'CLOSED';

  @IsOptional()
  @IsString()
  notes?: string;

  /** Usuario que aprueba el plan (opcional al crear). */
  @IsOptional()
  @IsUUID()
  approvedById?: string | null;

  @IsOptional()
  @IsDateString()
  approvedAt?: string | null;

  @IsUUID()
  companyId!: string;
}
