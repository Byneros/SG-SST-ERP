import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn([
    'POLICY',
    'PROCEDURE',
    'CERTIFICATE',
    'TRAINING_EVIDENCE',
    'INCIDENT_EVIDENCE',
    'AUDIT_EVIDENCE',
    'MEDICAL',
    'OTHER',
  ])
  category?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'EXPIRED', 'ARCHIVED'])
  status?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  /** Sede del documento; null la desasigna. Debe ser de la misma empresa. */
  @IsOptional()
  @IsUUID()
  siteId?: string | null;
}
