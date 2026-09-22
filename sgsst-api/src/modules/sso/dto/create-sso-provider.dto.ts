import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

const assignableRoles: Role[] = ['EMPLOYEE', 'SST', 'AUDITOR', 'ADMIN'];

export class CreateSsoProviderDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsUrl({ require_tld: false })
  issuer!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  clientId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  clientSecret!: string;

  @IsUrl({ require_tld: false })
  authorizationEndpoint!: string;

  @IsUrl({ require_tld: false })
  tokenEndpoint!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  jwksUri?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  userinfoEndpoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  scopes?: string;

  @IsOptional()
  @IsIn(assignableRoles)
  defaultRole?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
