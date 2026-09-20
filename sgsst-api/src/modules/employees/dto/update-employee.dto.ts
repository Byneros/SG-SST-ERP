import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsIn(['CC', 'CE', 'TI', 'PASSPORT', 'NIT'])
  documentType?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{5,20}$/, {
    message: 'document must contain 5 to 20 letters, numbers or hyphens',
  })
  document?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  workCenter?: string;

  @IsOptional()
  @IsIn(['INDEFINITE', 'FIXED_TERM', 'SERVICE', 'APPRENTICESHIP', 'TEMPORARY'])
  contractType?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RETIRED'])
  employmentStatus?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  /** Sede del empleado; null lo desasigna. Debe ser de la misma empresa. */
  @IsOptional()
  @IsUUID()
  siteId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
