import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  // DEVELOPER excluido: nadie puede promover a DEVELOPER via API.
  @IsIn(['SUPER_ADMIN', 'ADMIN', 'SST', 'EMPLOYEE', 'AUDITOR'])
  role?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
