import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class LegalRequirementMappingDto {
  @IsString()
  moduleKey!: string;

  @IsOptional()
  @IsString()
  entityName?: string;

  @IsOptional()
  @IsString()
  evidenceType?: string;

  @IsOptional()
  @IsString()
  kpiKey?: string;

  @IsOptional()
  @IsString()
  reportKey?: string;
}

class LegalEvidenceRequirementDto {
  @IsString()
  evidenceName!: string;

  @IsString()
  evidenceType!: string;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;

  @IsOptional()
  @IsIn([
    'ONCE',
    'ANNUAL',
    'SEMIANNUAL',
    'QUARTERLY',
    'MONTHLY',
    'EVENT_BASED',
    'CONTINUOUS',
  ])
  frequency?: string;
}

export class CreateLegalRequirementDto {
  @IsUUID()
  normId!: string;

  @IsOptional()
  @IsString()
  article?: string;

  @IsOptional()
  @IsString()
  numeral?: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  obligationType?: string;

  @IsOptional()
  @IsIn([
    'ONCE',
    'ANNUAL',
    'SEMIANNUAL',
    'QUARTERLY',
    'MONTHLY',
    'EVENT_BASED',
    'CONTINUOUS',
  ])
  frequency?: string;

  @IsOptional()
  @IsString()
  appliesTo?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  riskLevel?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegalRequirementMappingDto)
  mappings?: LegalRequirementMappingDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LegalEvidenceRequirementDto)
  evidenceRequirements?: LegalEvidenceRequirementDto[];
}
