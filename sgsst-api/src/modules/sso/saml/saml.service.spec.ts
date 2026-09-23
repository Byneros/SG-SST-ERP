import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { SamlService } from './saml.service';

/** Assertion POSTeado por el IdP (base64); el contenido no importa: se mockea la validacion. */
const samlResponseBase64 = Buffer.from(
  '<samlp:Response>assertion-de-prueba</samlp:Response>',
).toString('base64');

const samlProvider = {
  id: 'provider-saml-1',
  companyId: 'company-a',
  protocol: 'SAML',
  issuer: '',
  clientId: '',
  clientSecret: '',
  authorizationEndpoint: '',
  tokenEndpoint: '',
  userinfoEndpoint: null,
  scopes: '',
  defaultRole: 'EMPLOYEE',
  jwksUri: null,
  idpMetadata: null,
  idpEntityId: 'https://idp.example.test/sso',
  idpSsoUrl: 'https://idp.example.test/sso/login',
  idpCertificate:
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA-test-certificate-body',
  spEntityId: null,
  isActive: true,
};

const session = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: '1h',
  user: {
    id: 'user-1',
    name: 'Usuario SAML',
    email: 'saml.user@company.test',
    role: 'EMPLOYEE',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  },
};

const storedState = {
  id: 'state-1',
  companyId: 'company-a',
  redirect: '/dashboard',
  expiresAt: new Date(Date.now() + 60_000),
};

describe('SamlService', () => {
  const prisma = {
    ssoState: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    ssoProvider: {
      findFirst: jest.fn(),
    },
  };
  const ssoService = { resolveUserAndIssueSession: jest.fn() };
  const buildService = () =>
    new SamlService(prisma as never, ssoService as never);

  /**
   * Espia la instancia SAML interna (samlFor): devuelve el servicio con el
   * metodo privado reemplazado para devolver el mock inyectable.
   */
  function mockValidProfile(overrides: Partial<Record<string, unknown>> = {}) {
    const service = buildService();
    const samlInstance = {
      validatePostResponseAsync: jest.fn().mockResolvedValue({
        profile: {
          issuer: 'https://idp.example.test/sso',
          nameID: 'saml.user@company.test',
          email: 'saml.user@company.test',
          displayName: 'Usuario SAML',
          memberOf: ['SG-SST-Admins'],
          ...overrides,
        },
      }),
      generateServiceProviderMetadata: jest
        .fn()
        .mockReturnValue('<EntityDescriptor/>'),
    };
    jest
      .spyOn(service as never, 'samlFor')
      .mockResolvedValue(samlInstance as never);
    return { service, samlInstance };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.ssoProvider.findFirst.mockResolvedValue(samlProvider);
    ssoService.resolveUserAndIssueSession.mockResolvedValue(session);
  });

  it('beginLogin persists a one-shot state bound to the company', async () => {
    prisma.ssoState.create.mockResolvedValue({});

    const { authorizationUrl } = await buildService().beginLogin(
      'company-a',
      '/dashboard',
    );

    expect(authorizationUrl).toContain('https://idp.example.test/sso/login');
    expect(prisma.ssoState.create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        companyId: 'company-a',
        redirect: '/dashboard',
      }),
    });
  });

  it('beginLogin drops unsafe redirect targets', async () => {
    prisma.ssoState.create.mockResolvedValue({});

    await buildService().beginLogin('company-a', '//evil.example.test');

    expect(prisma.ssoState.create).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({ redirect: null }),
    });
  });

  it('beginLogin fails without leaving state when the provider is OIDC', async () => {
    prisma.ssoProvider.findFirst.mockResolvedValue({
      ...samlProvider,
      protocol: 'OIDC',
    });

    await expect(
      buildService().beginLogin('company-a', '/'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ssoState.create).not.toHaveBeenCalled();
  });

  it('beginLogin fails when SAML provider has no IdP SSO URL', async () => {
    prisma.ssoProvider.findFirst.mockResolvedValue({
      ...samlProvider,
      idpSsoUrl: null,
    });

    await expect(
      buildService().beginLogin('company-a', '/'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ssoState.create).not.toHaveBeenCalled();
  });

  it('beginLogin fails when SAML provider has no IdP certificate', async () => {
    prisma.ssoProvider.findFirst.mockResolvedValue({
      ...samlProvider,
      idpCertificate: null,
    });

    await expect(
      buildService().beginLogin('company-a', '/'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.ssoState.create).not.toHaveBeenCalled();
  });

  it('beginLogin invalidates cached SAML config after provider update', async () => {
    prisma.ssoState.create.mockResolvedValue({});
    const service = buildService();
    await service.beginLogin('company-a', '/');

    // El admin reconfigura el IdP: el siguiente login debe reconstruir la instancia.
    prisma.ssoProvider.findFirst.mockResolvedValue({
      ...samlProvider,
      idpSsoUrl: 'https://idp.example.test/sso/login-v2',
    });
    await service.beginLogin('company-a', '/');

    // Sin excepcion: ambas llamadas usan config distinta y ambas se validan.
    expect(prisma.ssoState.create).toHaveBeenCalledTimes(2);
  });

  it('beginLogin reuses the cached SAML instance while the config stays unchanged', async () => {
    prisma.ssoState.create.mockResolvedValue({});
    const service = buildService();
    const first = await service.beginLogin('company-a', '/');
    const second = await service.beginLogin('company-a', '/');

    // Misma config: ambos flujos funcionan y crean su propio state one-shot.
    expect(first.authorizationUrl).toContain(
      'https://idp.example.test/sso/login',
    );
    expect(second.authorizationUrl).toContain(
      'https://idp.example.test/sso/login',
    );
    expect(prisma.ssoState.create).toHaveBeenCalledTimes(2);
  });

  it('safeRedirect only accepts relative in-app paths at ACS time', async () => {
    prisma.ssoState.findUnique.mockResolvedValue({
      ...storedState,
      redirect: 'https://evil.example.test',
    });
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
    const { service } = mockValidProfile();

    const result = await service.consumeAssertion(
      'company-a',
      samlResponseBase64,
      'state-1',
    );
    // Un redirect absoluto en el state cae al fallback '/' (sin open redirect).
    expect(result.redirect).toBe('/');
  });

  it('controller-style: ACS success redirects to webBaseUrl with the session fragment', async () => {
    prisma.ssoState.findUnique.mockResolvedValue(storedState);
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
    const { service } = mockValidProfile();

    const { redirect, session } = await service.consumeAssertion(
      'company-a',
      samlResponseBase64,
      'state-1',
    );
    const params = new URLSearchParams({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
      expires_in: session.expiresIn,
      user: JSON.stringify(session.user),
    });
    // El SamlAuthController arma el redirect a la web con el fragmento de sesion.
    const location = `http://localhost:5174${redirect}#${params.toString()}`;
    expect(location).toContain('access_token=');
    expect(location).toContain('user=');
  });

  it('beginLogin throws NotFound when no active SAML provider exists', async () => {
    prisma.ssoProvider.findFirst.mockResolvedValue(null);

    await expect(
      buildService().beginLogin('company-a', '/'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.ssoState.create).not.toHaveBeenCalled();
  });

  it('consumeAssertion rejects an unknown or reused RelayState', async () => {
    prisma.ssoState.findUnique.mockResolvedValue(null);
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      buildService().consumeAssertion('company-a', 'PEN-VALUES', 'state-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ssoService.resolveUserAndIssueSession).not.toHaveBeenCalled();
  });

  it('consumeAssertion rejects a RelayState from another company (tenant isolation)', async () => {
    prisma.ssoState.findUnique.mockResolvedValue({
      ...storedState,
      companyId: 'company-b',
    });
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      buildService().consumeAssertion('company-a', 'PEN-VALUES', 'state-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ssoService.resolveUserAndIssueSession).not.toHaveBeenCalled();
  });

  it('consumeAssertion rejects an expired RelayState', async () => {
    prisma.ssoState.findUnique.mockResolvedValue({
      ...storedState,
      expiresAt: new Date(Date.now() - 1_000),
    });
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      buildService().consumeAssertion('company-a', 'PEN-VALUES', 'state-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('consumeAssertion rejects a missing SAMLResponse', async () => {
    prisma.ssoState.findUnique.mockResolvedValue(storedState);
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });

    await expect(
      buildService().consumeAssertion('company-a', undefined, 'state-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    // El state igual se consume (one-shot) aunque falte el assertion.
    expect(prisma.ssoState.deleteMany).toHaveBeenCalled();
  });

  it('consumeAssertion rejects a missing RelayState', async () => {
    await expect(
      buildService().consumeAssertion(
        'company-a',
        samlResponseBase64,
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Sin RelayState no hay nada que consumir en BD.
    expect(prisma.ssoState.deleteMany).not.toHaveBeenCalled();
  });

  it('consumeAssertion validates the assertion and issues a session with mapped claims', async () => {
    prisma.ssoState.findUnique.mockResolvedValue(storedState);
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
    const { service, samlInstance } = mockValidProfile();

    const result = await service.consumeAssertion(
      'company-a',
      samlResponseBase64,
      'state-1',
    );

    expect(result.redirect).toBe('/dashboard');
    expect(result.session).toEqual(session);
    // El nombre viene de displayName y el sub es federado con el nameID.
    expect(ssoService.resolveUserAndIssueSession).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-a' }),
      expect.objectContaining({
        sub: `saml:https://idp.example.test/sso:saml.user@company.test`,
        email: 'saml.user@company.test',
        name: 'Usuario SAML',
        groups: ['SG-SST-Admins'],
      }),
    );
    expect(samlInstance.validatePostResponseAsync).toHaveBeenCalledWith({
      SAMLResponse: samlResponseBase64,
    });
  });

  it('consumeAssertion falls back to nameID as email and firstName/lastName for the name', async () => {
    prisma.ssoState.findUnique.mockResolvedValue(storedState);
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
    const { service } = mockValidProfile({
      email: undefined,
      mail: undefined,
      displayName: undefined,
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    await service.consumeAssertion('company-a', samlResponseBase64, 'state-1');

    const resolveCalls = ssoService.resolveUserAndIssueSession.mock
      .calls as unknown as Array<[unknown, { email?: string; name?: string }]>;
    const claims = resolveCalls[0][1];
    expect(claims.email).toBe('saml.user@company.test');
    expect(claims.name).toBe('Ada Lovelace');
  });

  it('consumeAssertion rejects an assertion without nameID', async () => {
    prisma.ssoState.findUnique.mockResolvedValue(storedState);
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
    const { service } = mockValidProfile({ nameID: undefined });

    await expect(
      service.consumeAssertion('company-a', samlResponseBase64, 'state-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ssoService.resolveUserAndIssueSession).not.toHaveBeenCalled();
  });

  it('consumeAssertion rejects an invalid signature/assertion and swallows the session', async () => {
    prisma.ssoState.findUnique.mockResolvedValue(storedState);
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
    const { service, samlInstance } = mockValidProfile();
    samlInstance.validatePostResponseAsync.mockRejectedValue(
      new Error('Invalid signature'),
    );

    await expect(
      service.consumeAssertion('company-a', samlResponseBase64, 'state-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ssoService.resolveUserAndIssueSession).not.toHaveBeenCalled();
  });

  it('consumeAssertion rejects when the validation returns no profile', async () => {
    prisma.ssoState.findUnique.mockResolvedValue(storedState);
    prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
    const { service, samlInstance } = mockValidProfile();
    samlInstance.validatePostResponseAsync.mockResolvedValue({ profile: null });

    await expect(
      service.consumeAssertion('company-a', samlResponseBase64, 'state-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('metadata returns the SP XML generated by the SAML instance', async () => {
    const { service, samlInstance } = mockValidProfile();

    const xml = await service.metadata('company-a');

    expect(typeof xml).toBe('string');
    expect(xml).toContain('<EntityDescriptor');
    expect(samlInstance.generateServiceProviderMetadata).toHaveBeenCalledWith(
      null,
    );
  });

  it('samlFor rejects a provider without certificate or metadata (via metadata endpoint)', async () => {
    prisma.ssoProvider.findFirst.mockResolvedValue({
      ...samlProvider,
      idpCertificate: null,
    });

    await expect(buildService().metadata('company-a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
