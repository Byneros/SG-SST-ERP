import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateEvaluationItemDto {
  @IsOptional()
  @IsIn(['PENDING', 'COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'NOT_APPLICABLE'])
  status?: string;

  /** Puntaje obtenido (0..maxScore). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number | null;

  @IsOptional()
  @IsString()
  notes?: string;
}
