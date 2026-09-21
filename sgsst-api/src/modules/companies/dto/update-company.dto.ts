import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{7,10}-\d$/, {
    message:
      'nit must use Colombian format without dots, for example 900123456-7',
  })
  nit?: string;

  @IsOptional()
  @IsString()
  arl?: string;

  @IsOptional()
  @IsIn(['CLASS_I', 'CLASS_II', 'CLASS_III', 'CLASS_IV', 'CLASS_V'])
  riskClass?: string;

  @IsOptional()
  @IsString()
  economicActivity?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  reportExportExpirationDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  reportExportRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  reportFailureRateAlertPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  reportStorageAlertBytes?: number;

  @IsOptional()
  @IsBoolean()
  whatsappAlertsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message:
      'whatsappAlertPhone must use international format, for example 573001112233',
  })
  whatsappAlertPhone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
