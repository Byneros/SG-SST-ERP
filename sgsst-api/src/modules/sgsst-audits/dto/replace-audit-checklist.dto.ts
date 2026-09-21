import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateAuditChecklistItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsString()
  section?: string;

  @IsString()
  question!: string;
}

/** Reemplaza (o crea) el checklist completo de una auditoría en una sola llamada. */
export class ReplaceAuditChecklistDto {
  @IsArray()
  items!: CreateAuditChecklistItemDto[];
}
