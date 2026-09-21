import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAuditProgramDto {
  @IsString()
  name!: string;

  /** Periodo del programa, p. ej. "2026" o "2026-S1". */
  @IsString()
  period!: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsUUID()
  companyId!: string;
}
