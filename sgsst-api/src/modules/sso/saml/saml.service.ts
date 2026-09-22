import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SAML, ValidateInResponseTo } from '@node-saml/node-saml';
import type { Profile as SamlProfile } from '@node-saml/node-saml';
import { createHash } from 'node:crypto';
import { env } from '../../../config/env';
import { PrismaService } from '../../../database/prisma.service';
import {
  SsoService,
  type SsoProviderRecord,
  type SsoSession,
} from '../sso.service';
import { normalizeIdpCertificate } from './saml-metadata';
import {
  groupsFromSamlProfile,
  parseRoleGroups,
  type RoleGroupMap,
} from '../sso-roles';

type SsoProviderRole = SsoProviderRecord['defaultRole'];

/** Registro de proveedor con campos SAML ya descifrados cuando aplican. */
export type SamlProviderRecord = {
  id: string;
  companyId: string;
  protocol: string;
  issuer: string;
  idpEntityId: string | null;
  idpSsoUrl: string | null;
  idpCertificate: string | null;
  idpMetadata: string | null;
  spEntityId: string | null;
  defaultRole: string;
  roleGroups: RoleGroupMap | null;
  isActive: boolean;
};

const STATE_TTL_MINUTES = 10;

/** Fingerprint de la config SAML: invalida la cache al reconfigurar el IdP. */
function configFingerprint(provider: SamlProviderRecord): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        provider.idpEntityId,
        provider.idpSsoUrl,
        provider.idpCertificate,
        provider.idpMetadata,
        provider.spEntityId,
      ]),
    )
    .digest('hex');
}

@Injectable()
export class SamlService {
  private readonly logger = new Logger(SamlService.name);
  /** Cache por empresa + fingerprint de config (invalidada al reconfigurar). */
  private readonly samlCache = new Map<
    string,
    { fingerprint: string; saml: SAML }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ssoService: SsoService,
  ) {}

  /** URL de metadata del IdP para federar el SP en la consola del IdP. */
  async metadata(companyId: string): Promise<string> {
    const saml = await this.samlFor(companyId);
    return saml.generateServiceProviderMetadata(null);
  }

  /** Genera la URL de login del IdP con RelayState = id del state one-shot. */
  async beginLogin(companyId: string, redirect: string | undefined) {
    // Validar protocolo/config ANTES de persistir el state (no deja basura si falla).
    const saml = await this.samlFor(companyId);
    const provider = await this.findActiveByCompany(companyId);
    const stateId = crypto.randomUUID();
    await this.prisma.ssoState.create({
      data: {
        id: stateId,
        companyId: provider.companyId,
        expiresAt: new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000),
        redirect: this.safeRedirect(redirect),
      },
    });
    const host = new URL(env.publicBaseUrl).host;
    const authorizeUrl = await saml.getAuthorizeUrlAsync(stateId, host, {
      samlFallback: 'login-request',
    });
    return { authorizationUrl: authorizeUrl };
  }

  /**
   * Assertion Consumer Service: valida la respuesta SAML (firma, audiencia,
   * timestamps), resuelve/crea el usuario y emite la misma sesion que OIDC.
   */
  async consumeAssertion(
    companyId: string,
    samlResponse: string | undefined,
    relayState: string | undefined,
  ): Promise<{ redirect: string; session: SsoSession }> {
    if (!samlResponse) {
      // El state igual se consume (one-shot) aunque falte el assertion.
      if (relayState) {
        await this.prisma.ssoState.deleteMany({ where: { id: relayState } });
      }
      throw new BadRequestException('Missing SAMLResponse');
    }
    // State one-shot: se consume siempre para evitar reuso del RelayState.
    const stored = relayState
      ? await this.prisma.ssoState.findUnique({ where: { id: relayState } })
      : null;
    if (relayState) {
      await this.prisma.ssoState.deleteMany({ where: { id: relayState } });
    }
    if (!stored || stored.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired RelayState');
    }
    if (stored.companyId !== companyId) {
      // La respuesta de un IdP no puede consumir el state de otra empresa.
      throw new BadRequestException('RelayState does not match IdP');
    }

    const provider = await this.findActiveByCompany(companyId);
    const saml = await this.samlFor(companyId);
    let profile: SamlProfile;
    try {
      const result = await saml.validatePostResponseAsync({
        SAMLResponse: samlResponse,
      });
      if (!result.profile) {
        throw new BadRequestException('SAML response has no profile');
      }
      profile = result.profile;
    } catch (error) {
      this.logger.warn(
        `SAML validation failed for company ${companyId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException('Invalid SAML response');
    }

    const claims = this.claimsFromProfile(provider, profile);
    const session = await this.ssoService.resolveUserAndIssueSession(
      {
        ...provider,
        issuer: provider.idpEntityId ?? provider.issuer,
        clientId: '',
        defaultRole: provider.defaultRole as SsoProviderRole,
        clientSecret: '',
        authorizationEndpoint: '',
        tokenEndpoint: '',
        scopes: '',
        jwksUri: null,
        userinfoEndpoint: null,
      },
      claims,
    );
    const redirect = this.safeRedirect(stored.redirect) ?? '/';
    return { redirect, session };
  }

  /** Mapea nameID/email/atributos del assertion a los claims que resuelve SsoService. */
  private claimsFromProfile(
    provider: SamlProviderRecord,
    profile: SamlProfile,
  ): { sub: string; email?: string; name?: string; groups?: string[] } {
    const subject = provider.idpEntityId || profile.issuer;
    const nameID = profile.nameID;
    if (!nameID) {
      throw new BadRequestException('SAML assertion missing nameID');
    }
    const email =
      profile.email ??
      profile.mail ??
      profile['urn:oid:0.9.2342.19200300.100.1.3'] ??
      (nameID.includes('@') ? nameID : undefined);
    const name =
      (typeof profile.displayName === 'string' && profile.displayName) ||
      (typeof profile.firstName === 'string' &&
        [
          profile.firstName,
          typeof profile.lastName === 'string' ? profile.lastName : '',
        ]
          .filter(Boolean)
          .join(' ')) ||
      undefined;
    return {
      // sub federado: entidad IdP + nameID (unico por usuario del IdP).
      sub: `saml:${subject}:${nameID}`,
      email: typeof email === 'string' ? email : undefined,
      name,
      // Grupos del assertion (memberOf/claims): habilita overrides de rol.
      groups: groupsFromSamlProfile(profile),
    };
  }

  /** Instancia SAML por empresa (cacheada); configuracion SP/IdP determinista. */
  private async samlFor(companyId: string): Promise<SAML> {
    const provider = await this.findActiveByCompany(companyId);
    if (provider.protocol !== 'SAML') {
      throw new BadRequestException(
        'SSO provider for this company is not SAML',
      );
    }
    const fingerprint = configFingerprint(provider);
    const cached = this.samlCache.get(companyId);
    if (cached && cached.fingerprint === fingerprint) return cached.saml;

    const idpCert = provider.idpCertificate;
    const entryPoint = provider.idpSsoUrl;
    if (!idpCert) {
      throw new BadRequestException(
        'SAML provider missing IdP certificate (configure direct cert or metadata)',
      );
    }
    if (!entryPoint) {
      throw new BadRequestException('SAML provider missing IdP SSO URL');
    }
    const saml = new SAML({
      // entityID del SP: estable y unico por empresa.
      issuer: provider.spEntityId ?? this.spEntityIdFor(provider),
      callbackUrl: this.acsUrlFor(provider),
      entryPoint,
      idpCert: normalizeIdpCertificate(idpCert),
      idpIssuer: provider.idpEntityId ?? undefined,
      audience: provider.spEntityId ?? this.spEntityIdFor(provider),
      wantAssertionsSigned: true,
      wantAuthnResponseSigned: false,
      signatureAlgorithm: 'sha256',
      validateInResponseTo: ValidateInResponseTo.ifPresent,
      requestIdExpirationPeriodMs: STATE_TTL_MINUTES * 60 * 1000 * 6,
      acceptedClockSkewMs: 5_000,
    });
    this.samlCache.set(companyId, { fingerprint, saml });
    return saml;
  }

  /** entityID del SP por empresa, deterministico y estable. */
  private spEntityIdFor(provider: SamlProviderRecord): string {
    return (
      provider.spEntityId ??
      `${env.publicBaseUrl}/api/v1/auth/sso/saml/${provider.companyId}/metadata`
    );
  }

  /** ACS publica por empresa; el IdP hace POST aqui con el assertion. */
  private acsUrlFor(provider: SamlProviderRecord): string {
    return `${env.publicBaseUrl}/api/v1/auth/sso/saml/${provider.companyId}/acs`;
  }

  private safeRedirect(value: string | null | undefined): string | null {
    if (!value) return null;
    // Solo rutas relativas de la propia app: evita open redirects.
    return value.startsWith('/') && !value.startsWith('//') ? value : null;
  }

  private async findActiveByCompany(
    companyId: string,
  ): Promise<SamlProviderRecord> {
    const provider = await this.prisma.ssoProvider.findFirst({
      where: { companyId, isActive: true, protocol: 'SAML' },
    });
    if (!provider) {
      throw new NotFoundException('SAML is not configured for this company');
    }
    // El mapeo grupo->rol se parsea/valida al leer (corrupto = 400 claro).
    return { ...provider, roleGroups: parseRoleGroups(provider.roleGroups) };
  }
}
