import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { parseIdpMetadata } from './saml/saml-metadata';
import { decryptSecret } from './sso-crypto';
import {
  groupsFromClaim,
  normalizeRoleGroupsInput,
  parseRoleGroups,
  resolveRoleFromGroups,
  ASSIGNABLE_SSO_ROLES,
  type RoleGroupMap,
} from './sso-roles';
import { UpdateSsoProviderDto } from './dto/update-sso-provider.dto';

export type SsoSession = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyId: string | null;
    activeCompanyId: string | null;
  };
};

export type SsoProviderRecord = {
  id: string;
  companyId: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string | null;
  scopes: string;
  // Rol por defecto del provision SSO: solo roles asignables (nunca
  // SUPER_ADMIN/DEVELOPER: roles de plataforma fuera del alcance del IdP).
  defaultRole: 'ADMIN' | 'SST' | 'EMPLOYEE' | 'AUDITOR';
  jwksUri: string | null;
  roleGroups: RoleGroupMap | null;
  isActive: boolean;
};

const STATE_TTL_MINUTES = 10;

/** Claims ampliados con grupos del IdP para overrides de rol. */
export type SsoClaims = {
  sub: string;
  email?: string;
  name?: string;
  groups?: string[];
};

function isSafeRedirect(value: string): boolean {
  // Solo rutas relativas de la propia app: evita open redirects.
  return value.startsWith('/') && !value.startsWith('//');
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private readonly jwksCache = new Map<
    string,
    ReturnType<typeof createRemoteJWKSet>
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /** Inicia el flujo: state persistido + PKCE + redirect al IdP de la empresa. */
  async beginLogin(companyId: string, redirect: string | undefined) {
    const provider = await this.findActiveByCompany(companyId);
    const stateId = randomUUID();
    const codeVerifier = randomUUID() + randomUUID();
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    await this.prisma.ssoState.create({
      data: {
        id: stateId,
        companyId: provider.companyId,
        expiresAt: new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000),
        redirect: redirect && isSafeRedirect(redirect) ? redirect : null,
      },
    });

    const url = new URL(provider.authorizationEndpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', provider.clientId);
    url.searchParams.set('redirect_uri', this.callbackUrl());
    url.searchParams.set('scope', provider.scopes);
    url.searchParams.set('state', stateId);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return { authorizationUrl: url.toString() };
  }

  /** Callback del IdP: valida state, canjea el code, resuelve/crea usuario y emite sesion propia. */
  async handleCallback(
    code: string | undefined,
    state: string | undefined,
  ): Promise<{ redirect: string; session: SsoSession }> {
    if (!code || !state) {
      throw new BadRequestException('Missing code or state');
    }
    const stored = await this.prisma.ssoState.findUnique({
      where: { id: state },
    });
    // One-shot: se consume siempre para evitar reuso del state.
    await this.prisma.ssoState.deleteMany({ where: { id: state } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired state');
    }

    const provider = await this.findActiveByCompany(stored.companyId);
    const claims = await this.exchangeCode(code, provider);
    const session = await this.resolveUserAndIssueSession(provider, claims);
    const redirect =
      stored.redirect && isSafeRedirect(stored.redirect)
        ? stored.redirect
        : '/';
    return { redirect, session };
  }

  private async exchangeCode(
    code: string,
    provider: SsoProviderRecord,
  ): Promise<SsoClaims> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      redirect_uri: this.callbackUrl(),
    });
    const response = await fetch(provider.tokenEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      this.logger.warn(
        `SSO token exchange failed for company ${provider.companyId}: ${response.status}`,
      );
      throw new BadRequestException('Token exchange failed');
    }
    const tokens = (await response.json()) as {
      id_token?: string;
      access_token?: string;
      token_type?: string;
      expires_in?: number;
    };

    if (tokens.id_token) {
      // Firma y emisor verificados contra el JWKS del IdP; audience = client_id.
      const verifyKey = this.jwksFor(provider);
      const { payload } = await jwtVerify(tokens.id_token, verifyKey, {
        issuer: provider.issuer,
        audience: provider.clientId,
      });
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      const email =
        typeof payload.email === 'string' ? payload.email : undefined;
      const name = typeof payload.name === 'string' ? payload.name : undefined;
      const groups = groupsFromClaim(payload.groups);
      if (!sub) {
        throw new BadRequestException('ID token missing subject');
      }
      return { sub, email, name, groups };
    }

    // Fallback: endpoint userinfo cuando el IdP no devuelve id_token utilizable.
    if (provider.userinfoEndpoint) {
      const userinfoResponse = await fetch(provider.userinfoEndpoint, {
        headers: { authorization: `Bearer ${tokens.access_token ?? ''}` },
      });
      if (!userinfoResponse.ok) {
        throw new BadRequestException('Userinfo request failed');
      }
      const userinfo = (await userinfoResponse.json()) as {
        sub?: string;
        email?: string;
        name?: string;
        groups?: unknown;
      };
      if (!userinfo.sub) {
        throw new BadRequestException('Userinfo missing subject');
      }
      return {
        sub: userinfo.sub,
        email: userinfo.email,
        name: userinfo.name,
        groups: groupsFromClaim(userinfo.groups),
      };
    }

    throw new BadRequestException('IdP response missing id_token');
  }

  /** Publico para reuso: SAML consume esta misma resolucion/emision de sesion. */
  async resolveUserAndIssueSession(
    provider: SsoProviderRecord,
    claims: SsoClaims,
  ): Promise<SsoSession> {
    const subject = `${provider.issuer}|${claims.sub}`;
    let user = await this.prisma.user.findUnique({
      where: { ssoSubject: subject },
    });

    if (!user && claims.email) {
      // Cuenta existente con el mismo correo: se vincula a la identidad federada.
      const byEmail = await this.prisma.user.findUnique({
        where: { email: claims.email },
      });
      if (byEmail) {
        if (!byEmail.isActive) {
          throw new ForbiddenException('User is inactive');
        }
        if (byEmail.companyId && byEmail.companyId !== provider.companyId) {
          throw new ForbiddenException('User belongs to another company');
        }
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: { ssoSubject: subject },
        });
      }
    }

    // El grupo del IdP define el rol: primer match en el mapa; fallback al
    // rol por defecto del proveedor. Aplica a JIT y a vinculacion por email.
    const { role, fromGroupMatch } = resolveRoleFromGroups(
      claims.groups,
      provider.roleGroups,
      provider.defaultRole,
    );

    if (!user) {
      if (!claims.email) {
        throw new BadRequestException('IdP did not provide an email');
      }
      // Aprovisionamiento JIT dentro de la empresa del proveedor.
      user = await this.prisma.user.create({
        data: {
          email: claims.email,
          name: claims.name ?? claims.email,
          role,
          password: await bcrypt.hash(randomUUID() + randomUUID(), 12),
          companyId: provider.companyId,
          ssoSubject: subject,
        },
      });
    } else if (fromGroupMatch && user.role !== role) {
      // Usuario existente: solo cuando el rol viene de un grupo del IdP se
      // sincroniza en cada login (promocion/degradacion). Sin match, se
      // conserva el rol actual (evita degradar roles asignados manualmente).
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException('User is inactive');
    }
    if (user.companyId && user.companyId !== provider.companyId) {
      throw new ForbiddenException('User belongs to another company');
    }
    // Integridad: todo usuario de sesion SSO debe tener nombre, empresa y rol.
    if (!user.name || !user.companyId || !user.role) {
      throw new Error('SSO user record is incomplete');
    }

    // Misma sesion que login/refresh: JWT de acceso + refresh hasheado en BD.
    return this.authService.issueSession(user, user.companyId);
  }

  /** Config para el panel admin (secreto nunca sale; indicador de presencia). */
  async findProviderByCompany(companyId: string) {
    const provider = await this.prisma.ssoProvider.findUnique({
      where: { companyId },
    });
    if (!provider) {
      return null;
    }
    return { ...provider, clientSecret: '***', configured: true };
  }

  /** Opciones de login SSO activas: solo datos publicos del IdP. */
  async listActiveLoginOptions() {
    const providers = await this.prisma.ssoProvider.findMany({
      where: {
        isActive: true,
        company: {
          isActive: true,
        },
      },
      select: {
        id: true,
        companyId: true,
        protocol: true,
        issuer: true,
        authorizationEndpoint: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return providers.map((provider) => ({
      companyId: provider.companyId,
      companyName: provider.company.name,
      protocol: provider.protocol,
    }));
  }

  async findProviderById(id: string) {
    const provider = await this.prisma.ssoProvider.findUnique({
      where: { id },
    });
    if (!provider) {
      throw new NotFoundException('SSO provider not found');
    }
    return provider;
  }

  async upsertProvider(
    companyId: string,
    dto: {
      protocol?: 'OIDC' | 'SAML';
      issuer?: string;
      clientId?: string;
      clientSecret?: string;
      authorizationEndpoint?: string;
      tokenEndpoint?: string;
      jwksUri?: string;
      userinfoEndpoint?: string;
      scopes?: string;
      idpMetadata?: string;
      idpEntityId?: string;
      idpSsoUrl?: string;
      idpCertificate?: string;
      spEntityId?: string;
      defaultRole?: 'ADMIN' | 'SST' | 'EMPLOYEE' | 'AUDITOR';
      roleGroups?: Record<string, string> | string | null;
      isActive?: boolean;
    },
    encrypt: (plain: string) => string,
  ) {
    const protocol = dto.protocol ?? 'OIDC';
    if (protocol === 'SAML') {
      // SAML requiere cert (directo o extraible de la metadata) y URL SSO.
      const fromMetadata = dto.idpMetadata
        ? parseIdpMetadata(dto.idpMetadata)
        : null;
      if (fromMetadata) {
        // Metadata completa: rellena cert/URL si el admin no los pego.
        dto.idpCertificate = dto.idpCertificate || fromMetadata.certificate;
        dto.idpSsoUrl = dto.idpSsoUrl || fromMetadata.ssoUrl;
      }
      if (!dto.idpCertificate) {
        throw new BadRequestException(
          'SAML requires idpCertificate (or idpMetadata containing one)',
        );
      }
      if (!dto.idpSsoUrl) {
        throw new BadRequestException(
          'SAML requires idpSsoUrl (or idpMetadata containing SingleSignOnService)',
        );
      }
    } else if (!dto.issuer || !dto.clientId || !dto.clientSecret) {
      throw new BadRequestException(
        'OIDC requires issuer, clientId and clientSecret',
      );
    }
    const roleGroups = normalizeRoleGroupsInput(dto.roleGroups);
    const data = {
      protocol,
      issuer: dto.issuer ?? '',
      clientId: dto.clientId ?? '',
      clientSecret: encrypt(dto.clientSecret ?? '-'),
      authorizationEndpoint: dto.authorizationEndpoint ?? '',
      tokenEndpoint: dto.tokenEndpoint ?? '',
      jwksUri: dto.jwksUri ?? null,
      userinfoEndpoint: dto.userinfoEndpoint ?? null,
      scopes: dto.scopes ?? 'openid email profile',
      idpMetadata: dto.idpMetadata ?? null,
      idpEntityId: dto.idpEntityId ?? null,
      idpSsoUrl: dto.idpSsoUrl ?? null,
      idpCertificate: dto.idpCertificate ?? null,
      spEntityId: dto.spEntityId ?? null,
      defaultRole: dto.defaultRole ?? 'EMPLOYEE',
      roleGroups: roleGroups ?? Prisma.DbNull,
      isActive: dto.isActive ?? true,
    };
    const existing = await this.prisma.ssoProvider.findUnique({
      where: { companyId },
    });
    if (existing) {
      return this.prisma.ssoProvider.update({
        where: { id: existing.id },
        data,
      });
    }
    return this.prisma.ssoProvider.create({
      data: { ...data, companyId },
    });
  }

  async updateProvider(
    id: string,
    companyId: string,
    dto: UpdateSsoProviderDto,
    encrypt: (plain: string) => string,
  ) {
    const data: Record<string, unknown> = {
      ...dto,
    };

    if (typeof data.clientSecret === 'string' && data.clientSecret.length > 0) {
      data.clientSecret = encrypt(data.clientSecret);
    } else {
      delete data.clientSecret;
    }

    if (data.isActive !== undefined) {
      data.isActive =
        data.isActive === true || (data.isActive as unknown) === 'true';
    }

    // El mapeo grupo->rol se normaliza/valida antes de persistir; objeto
    // vacio o null limpia el mapeo (DbNull = SQL NULL).
    if (data.roleGroups !== undefined) {
      const roleGroups = normalizeRoleGroupsInput(data.roleGroups);
      data.roleGroups = roleGroups ?? Prisma.DbNull;
    }

    // jwksUri/userinfoEndpoint y los campos SAML admiten null explicito para limpiar.
    return this.prisma.ssoProvider.update({
      where: { id },
      data,
    });
  }

  async deleteProvider(id: string) {
    // La FK de Company es ON DELETE SET NULL; el provider si se elimina.
    await this.prisma.ssoProvider.delete({ where: { id } });
  }

  private async findActiveByCompany(
    companyId: string,
  ): Promise<SsoProviderRecord> {
    const provider = await this.prisma.ssoProvider.findFirst({
      where: { companyId, isActive: true },
    });
    if (!provider) {
      throw new NotFoundException('SSO is not configured for this company');
    }
    let roleGroups: RoleGroupMap | null = null;
    if (provider.roleGroups) {
      roleGroups = parseRoleGroups(provider.roleGroups);
    }
    // El secreto se guarda cifrado en reposo; se descifra solo para usarlo.
    // defaultRole se restringe al subconjunto asignable: la BD pudo ser
    // poblada manualmente con un rol de plataforma y SSO no debe propagarlo.
    return {
      ...provider,
      clientSecret: decryptSecret(provider.clientSecret),
      roleGroups,
      defaultRole: (ASSIGNABLE_SSO_ROLES as readonly string[]).includes(
        provider.defaultRole,
      )
        ? (provider.defaultRole as SsoProviderRecord['defaultRole'])
        : 'EMPLOYEE',
    };
  }

  private jwksFor(provider: SsoProviderRecord) {
    if (!provider.jwksUri) {
      throw new BadRequestException('SSO provider has no jwksUri configured');
    }
    let jwks = this.jwksCache.get(provider.id);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(provider.jwksUri));
      this.jwksCache.set(provider.id, jwks);
    }
    return jwks;
  }

  private callbackUrl(): string {
    return `${env.publicBaseUrl}/api/v1/auth/sso/callback`;
  }
}
