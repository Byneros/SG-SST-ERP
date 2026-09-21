import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateSgsstEvaluationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  standard?: string;

  /** Clase de riesgo de la empresa: I, II, III, IV o V. */
  @IsIn(['I', 'II', 'III', 'IV', 'V'])
  riskClass!: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Crea la evaluación con items iniciales (numeral, sección, pregunta, puntaje máximo). */
  @IsOptional()
  @IsArray()
  items?: {
    numeral?: string;
    section?: string;
    question: string;
    maxScore?: number;
  }[];

  @IsUUID()
  companyId!: string;
}
