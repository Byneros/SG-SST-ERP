import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsIn(['CC', 'CE', 'TI', 'PASSPORT', 'NIT'])
  documentType?: string;

  @IsString()
  @Matches(/^[A-Za-z0-9-]{5,20}$/, {
    message: 'document must contain 5 to 20 letters, numbers or hyphens',
  })
  document!: string;

  @IsString()
  position!: string;

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

  @IsUUID()
  companyId!: string;

  /** Sede donde el empleado presta sus funciones (opcional, de la misma empresa). */
  @IsOptional()
  @IsUUID()
  siteId?: string;
}
