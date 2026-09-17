import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class LinkLegalEvidenceDto {
  @IsIn(['Document', 'Audit'])
  entity!: string;

  @IsUUID()
  entityId!: string;

  @IsOptional()
  @IsIn(['PENDING', 'COMPLIES', 'PARTIAL', 'NON_COMPLIANT', 'NOT_APPLICABLE'])
  status?: string;

  @IsOptional()
  @IsUUID()
  reviewedById?: string;

  @IsOptional()
  @IsString()
  comments?: string;
}
