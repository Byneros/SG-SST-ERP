import { Role } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const assignableRoles: Role[] = ['EMPLOYEE', 'SST', 'AUDITOR', 'ADMIN'];

export class UpdateSsoProviderDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  issuer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  clientSecret?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  authorizationEndpoint?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  tokenEndpoint?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  jwksUri?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  userinfoEndpoint?: string | null;

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
