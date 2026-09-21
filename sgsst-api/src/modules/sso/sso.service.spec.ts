import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { encryptSecret } from './sso-crypto';
import { SsoService } from './sso.service';

const session = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  tokenType: 'Bearer',
  expiresIn: '1h',
  user: {
    id: 'user-1',
    name: 'Usuario SSO',
    email: 'user@company.test',
    role: 'EMPLOYEE',
    companyId: 'company-a',
    activeCompanyId: 'company-a',
  },
};

const provider = {
  id: 'provider-1',
  companyId: 'company-a',
  issuer: 'https://idp.example.test',
  clientId: 'client-id',
  clientSecret: encryptSecret('client-secret'),
  authorizationEndpoint: 'https://idp.example.test/authorize',
  tokenEndpoint: 'https://idp.example.test/token',
  userinfoEndpoint: 'https://idp.example.test/userinfo',
  scopes: 'openid email profile',
  defaultRole: 'EMPLOYEE' as const,
  jwksUri: null,
  isActive: true,
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('SsoService', () => {
  const prisma = {
    ssoState: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    ssoProvider: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };
  const authService = { issueSession: jest.fn() };
  const fetchMock = jest.fn();

  const buildService = () =>
    new SsoService(prisma as never, authService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = fetchMock;
    prisma.ssoProvider.findFirst.mockResolvedValue(provider);
    authService.issueSession.mockResolvedValue(session);
  });

  describe('beginLogin', () => {
    it('persists a one-shot state and returns the authorization URL with PKCE', async () => {
      prisma.ssoState.create.mockResolvedValue({});

      const { authorizationUrl } = await buildService().beginLogin(
        'company-a',
        '/dashboard',
      );

      const url = new URL(authorizationUrl);
      expect(url.origin + url.pathname).toBe(provider.authorizationEndpoint);
      expect(url.searchParams.get('client_id')).toBe('client-id');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(prisma.ssoState.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'company-a',
          redirect: '/dashboard',
        }),
      });
      const stateId = prisma.ssoState.create.mock.calls[0][0].data.id;
      expect(url.searchParams.get('state')).toBe(stateId);
    });

    it('drops unsafe redirect targets', async () => {
      prisma.ssoState.create.mockResolvedValue({});

      await buildService().beginLogin('company-a', '//evil.example.test');

      expect(prisma.ssoState.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ redirect: null }),
      });
    });
  });

  describe('handleCallback', () => {
    const stored = {
      id: 'state-1',
      companyId: 'company-a',
      redirect: '/dashboard',
      expiresAt: new Date(Date.now() + 60_000),
    };

    it('exchanges the code via userinfo, links the existing user and issues a session', async () => {
      prisma.ssoState.findUnique.mockResolvedValue(stored);
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // por ssoSubject
        .mockResolvedValueOnce({
          id: 'user-1',
          email: 'user@company.test',
          isActive: true,
          companyId: 'company-a',
        });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        name: 'Usuario SSO',
        email: 'user@company.test',
        role: 'EMPLOYEE',
        companyId: 'company-a',
        isActive: true,
      });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
        .mockResolvedValueOnce(
          jsonResponse({
            sub: 'sub-1',
            email: 'user@company.test',
            name: 'Usuario SSO',
          }),
        );

      const result = await buildService().handleCallback(
        'auth-code',
        'state-1',
      );

      expect(result.redirect).toBe('/dashboard');
      expect(result.session).toEqual(session);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { ssoSubject: 'https://idp.example.test|sub-1' },
      });
      expect(authService.issueSession).toHaveBeenCalled();
    });

    it('rejects a reused or unknown state', async () => {
      prisma.ssoState.findUnique.mockResolvedValue(null);
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an expired state', async () => {
      prisma.ssoState.findUnique.mockResolvedValue({
        ...stored,
        expiresAt: new Date(Date.now() - 1_000),
      });
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('provisions a JIT user inside the provider company when no account matches', async () => {
      prisma.ssoState.findUnique.mockResolvedValue(stored);
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-2',
        name: 'Nuevo',
        email: 'nuevo@company.test',
        role: 'EMPLOYEE',
        companyId: 'company-a',
        isActive: true,
      });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
        .mockResolvedValueOnce(
          jsonResponse({
            sub: 'sub-2',
            email: 'nuevo@company.test',
            name: 'Nuevo',
          }),
        );

      await buildService().handleCallback('auth-code', 'state-1');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'nuevo@company.test',
          role: 'EMPLOYEE',
          companyId: 'company-a',
          ssoSubject: 'https://idp.example.test|sub-2',
        }),
      });
    });

    it('blocks linking when the email account belongs to another company', async () => {
      prisma.ssoState.findUnique.mockResolvedValue(stored);
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'user-3',
        email: 'user@company.test',
        isActive: true,
        companyId: 'company-b',
      });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
        .mockResolvedValueOnce(
          jsonResponse({ sub: 'sub-1', email: 'user@company.test' }),
        );

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(authService.issueSession).not.toHaveBeenCalled();
    });

    it('blocks inactive users', async () => {
      prisma.ssoState.findUnique.mockResolvedValue(stored);
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-4',
        ssoSubject: 'https://idp.example.test|sub-1',
        email: 'user@company.test',
        name: 'Usuario Inactivo',
        role: 'EMPLOYEE',
        isActive: false,
        companyId: 'company-a',
      });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
        .mockResolvedValueOnce(
          jsonResponse({ sub: 'sub-1', email: 'user@company.test' }),
        );

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(authService.issueSession).not.toHaveBeenCalled();
    });
  });
});
