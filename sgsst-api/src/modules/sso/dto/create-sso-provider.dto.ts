import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
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

  // OIDC (por defecto) | SAML. Una fila solo usa los campos de su protocolo.
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
  jwksUri?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  userinfoEndpoint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  scopes?: string;

  // --- SAML ---
  @IsOptional()
  @IsString()
  @MaxLength(65535)
  idpMetadata?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idpEntityId?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  idpSsoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(65535)
  idpCertificate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  spEntityId?: string;

  @IsOptional()
  @IsIn(assignableRoles)
  defaultRole?: Role;

  // Overrides de rol por grupo del IdP: { "grupo": "SST", ... }. Objeto JSON
  // o string JSON; vacio/null = sin mapeo (todos con defaultRole).
  @IsOptional()
  @IsObject()
  roleGroups?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
