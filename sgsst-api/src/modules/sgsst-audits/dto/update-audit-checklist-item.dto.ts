import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAuditChecklistItemDto {
  @IsOptional()
  @IsIn(['CUMPLE', 'NO_CUMPLE', 'PARCIAL', 'NO_APLICA', 'PENDIENTE'])
  answer?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  responsible?: string;
}
