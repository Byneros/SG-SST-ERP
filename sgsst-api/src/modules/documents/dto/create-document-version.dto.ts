import { IsOptional, IsString } from 'class-validator';

export class CreateDocumentVersionDto {
  @IsString()
  fileUrl!: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
