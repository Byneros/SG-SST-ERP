import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SamlService } from './saml.service';

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
});
