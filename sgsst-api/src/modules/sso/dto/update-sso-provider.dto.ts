import type { Role } from '@prisma/client';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import type { AssignableRole } from '../sso-roles';

const assignableRoles: Role[] = ['EMPLOYEE', 'SST', 'AUDITOR', 'ADMIN'];

export class UpdateSsoProviderDto {
  @IsOptional()
  @IsIn(['OIDC', 'SAML'])
  protocol?: 'OIDC' | 'SAML';

  // --- OIDC ---
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

  // --- SAML ---
  @IsOptional()
  @IsString()
  @MaxLength(65535)
  idpMetadata?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idpEntityId?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  idpSsoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(65535)
  idpCertificate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  spEntityId?: string | null;

  @IsOptional()
  @IsIn(assignableRoles)
  defaultRole?: AssignableRole;

  // Overrides de rol por grupo del IdP; objeto vacio o null para limpiar.
  @IsOptional()
  @IsObject()
  roleGroups?: Record<string, string> | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
