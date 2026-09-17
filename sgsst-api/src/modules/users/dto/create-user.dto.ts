import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(['SUPER_ADMIN', 'ADMIN', 'SST', 'EMPLOYEE', 'AUDITOR'])
  role!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}
