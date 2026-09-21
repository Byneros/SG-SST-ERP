import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateLegalNormDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsString()
  issuingEntity?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'SUPERSEDED'])
  status?: string;

  @IsOptional()
  @IsUrl()
  url?: string;
}
