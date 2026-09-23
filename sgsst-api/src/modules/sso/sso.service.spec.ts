import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
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
  roleGroups: null,
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
      const stateId = url.searchParams.get('state');
      expect(stateId).toBeTruthy();
      expect(prisma.ssoState.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          id: stateId,
          companyId: 'company-a',
          redirect: '/dashboard',
        }),
      });
    });

    it('drops unsafe redirect targets', async () => {
      prisma.ssoState.create.mockResolvedValue({});

      await buildService().beginLogin('company-a', '//evil.example.test');

      expect(prisma.ssoState.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

    it('rejects a callback without code or state', async () => {
      await expect(
        buildService().handleCallback(undefined, 'state-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        buildService().handleCallback('auth-code', undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Sin state no hay nada que consumir ni proveedor que consultar.
      expect(prisma.ssoState.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects an inactive user found by email during linking', async () => {
      prisma.ssoState.findUnique.mockResolvedValue({
        id: 'state-1',
        companyId: 'company-a',
        redirect: '/',
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // por ssoSubject
        .mockResolvedValueOnce({
          id: 'user-inactivo-link',
          email: 'user@company.test',
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

    it('rejects JIT provisioning when the IdP gives no email', async () => {
      prisma.ssoState.findUnique.mockResolvedValue({
        id: 'state-1',
        companyId: 'company-a',
        redirect: '/',
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.findUnique.mockResolvedValue(null);
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
        .mockResolvedValueOnce(jsonResponse({ sub: 'sub-sin-email' }));

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a user whose ssoSubject identity belongs to another company', async () => {
      prisma.ssoState.findUnique.mockResolvedValue({
        id: 'state-1',
        companyId: 'company-a',
        redirect: '/',
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
      // El usuario existe por ssoSubject pero su companyId es de otra empresa.
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-cross',
        ssoSubject: `${provider.issuer}|sub-1`,
        email: 'user@company.test',
        name: 'Cross',
        role: 'EMPLOYEE',
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

  describe('role group overrides', () => {
    const stored = {
      id: 'state-1',
      companyId: 'company-a',
      redirect: '/',
      expiresAt: new Date(Date.now() + 60_000),
    };

    it('provisions a JIT user with the role mapped from its IdP group', async () => {
      prisma.ssoState.findUnique.mockResolvedValue(stored);
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
      prisma.ssoProvider.findFirst.mockResolvedValue({
        ...provider,
        roleGroups: { 'SG-SST-Admins': 'ADMIN' },
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-5',
        name: 'Admin JIT',
        email: 'admin@company.test',
        role: 'ADMIN',
        companyId: 'company-a',
        isActive: true,
      });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
        .mockResolvedValueOnce(
          jsonResponse({
            sub: 'sub-5',
            email: 'admin@company.test',
            groups: ['SG-SST-Admins'],
          }),
        );

      await buildService().handleCallback('auth-code', 'state-1');

      expect(prisma.user.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          email: 'admin@company.test',
          role: 'ADMIN',
        }),
      });
    });

    it('promotes an existing user when its group maps to another role', async () => {
      prisma.ssoState.findUnique.mockResolvedValue(stored);
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
      prisma.ssoProvider.findFirst.mockResolvedValue({
        ...provider,
        roleGroups: { Contratistas: 'EMPLOYEE' },
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-6',
        ssoSubject: 'https://idp.example.test|sub-6',
        email: 'jefe@company.test',
        name: 'Jefe',
        role: 'SST',
        isActive: true,
        companyId: 'company-a',
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-6',
        name: 'Jefe',
        email: 'jefe@company.test',
        role: 'EMPLOYEE',
        companyId: 'company-a',
        isActive: true,
      });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
        .mockResolvedValueOnce(
          jsonResponse({
            sub: 'sub-6',
            email: 'jefe@company.test',
            groups: ['Contratistas'],
          }),
        );

      await buildService().handleCallback('auth-code', 'state-1');

      // Degradacion consciente: el grupo del IdP manda sobre el rol local.
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-6' },
        data: { role: 'EMPLOYEE' },
      });
    });

    it('keeps the existing role when no group matches the map', async () => {
      prisma.ssoState.findUnique.mockResolvedValue(stored);
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
      prisma.ssoProvider.findFirst.mockResolvedValue({
        ...provider,
        roleGroups: { 'SG-SST-Admins': 'ADMIN' },
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-7',
        ssoSubject: 'https://idp.example.test|sub-7',
        email: 'sst@company.test',
        name: 'SST Local',
        role: 'SST',
        isActive: true,
        companyId: 'company-a',
      });
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
        .mockResolvedValueOnce(
          jsonResponse({
            sub: 'sub-7',
            email: 'sst@company.test',
            groups: ['Grupo-Sin-Mapeo'],
          }),
        );

      await buildService().handleCallback('auth-code', 'state-1');

      // Sin match no se toca el rol local (evita degradaciones accidentales).
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('provider administration (upsert/update/find/delete)', () => {
    const encrypt = (plain: string) => `encrypted(${plain})`;

    it('upsertProvider stores an OIDC provider with an encrypted secret', async () => {
      prisma.ssoProvider.findUnique.mockResolvedValue(null);
      prisma.ssoProvider.create.mockImplementation((args: unknown) =>
        Promise.resolve(args),
      );

      const result = await buildService().upsertProvider(
        'company-a',
        {
          protocol: 'OIDC',
          issuer: 'https://idp.example.test',
          clientId: 'client-id',
          clientSecret: 'raw-secret',
          authorizationEndpoint: 'https://idp.example.test/authorize',
          tokenEndpoint: 'https://idp.example.test/token',
          defaultRole: 'SST',
        },
        encrypt,
      );

      const data = (result as { data: Record<string, unknown> }).data;
      expect(data.clientSecret).toBe('encrypted(raw-secret)');
      expect(data.scopes).toBe('openid email profile');
      expect(data.defaultRole).toBe('SST');
      expect(prisma.ssoProvider.create).toHaveBeenCalled();
    });

    it('upsertProvider updates when a provider already exists', async () => {
      prisma.ssoProvider.findUnique.mockResolvedValue({ id: 'provider-1' });
      prisma.ssoProvider.update.mockResolvedValue({ id: 'provider-1' });

      await buildService().upsertProvider(
        'company-a',
        {
          protocol: 'OIDC',
          issuer: 'https://idp.example.test',
          clientId: 'client-id',
          clientSecret: 'raw-secret',
        },
        encrypt,
      );

      expect(prisma.ssoProvider.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'provider-1' } }),
      );
      expect(prisma.ssoProvider.create).not.toHaveBeenCalled();
    });

    it('upsertProvider rejects OIDC without issuer/clientId/clientSecret', async () => {
      await expect(
        buildService().upsertProvider('company-a', {}, encrypt),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('upsertProvider rejects SAML without certificate or metadata', async () => {
      await expect(
        buildService().upsertProvider(
          'company-a',
          { protocol: 'SAML', idpSsoUrl: 'https://idp/sso/login' },
          encrypt,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('upsertProvider rejects SAML without SSO URL', async () => {
      await expect(
        buildService().upsertProvider(
          'company-a',
          { protocol: 'SAML', idpCertificate: 'ABCDEF' },
          encrypt,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('upsertProvider fills certificate and SSO URL from IdP metadata', async () => {
      prisma.ssoProvider.findUnique.mockResolvedValue(null);
      prisma.ssoProvider.create.mockImplementation((args: unknown) =>
        Promise.resolve(args),
      );

      const result = await buildService().upsertProvider(
        'company-a',
        {
          protocol: 'SAML',
          idpMetadata:
            '<X509Certificate>META-CERT</X509Certificate><SingleSignOnService Location="https://idp/sso/post"/>',
        },
        encrypt,
      );

      const data = (result as { data: Record<string, unknown> }).data;
      expect(data.idpCertificate).toBe('META-CERT');
      expect(data.idpSsoUrl).toBe('https://idp/sso/post');
    });

    it('upsertProvider persists a valid roleGroups mapping', async () => {
      prisma.ssoProvider.findUnique.mockResolvedValue(null);
      prisma.ssoProvider.create.mockImplementation((args: unknown) =>
        Promise.resolve(args),
      );

      const result = await buildService().upsertProvider(
        'company-a',
        {
          protocol: 'OIDC',
          issuer: 'https://idp.example.test',
          clientId: 'c',
          clientSecret: 's',
          roleGroups: { Devs: 'SST' },
        },
        encrypt,
      );

      expect(
        (result as { data: Record<string, unknown> }).data.roleGroups,
      ).toEqual({ Devs: 'SST' });
    });

    it('updateProvider encrypts a new secret and normalizes roleGroups', async () => {
      prisma.ssoProvider.update.mockResolvedValue({ id: 'provider-1' });

      await buildService().updateProvider(
        'provider-1',
        'company-a',
        {
          clientSecret: 'new-raw-secret',
          roleGroups: { 'SG-SST-Admins': 'ADMIN' },
          isActive: 'true' as unknown as boolean,
        },
        encrypt,
      );

      const updateCalls = prisma.ssoProvider.update.mock
        .calls as unknown as Array<Array<{ data: Record<string, unknown> }>>;
      expect(updateCalls[0][0].data.clientSecret).toBe(
        'encrypted(new-raw-secret)',
      );
      expect(updateCalls[0][0].data.roleGroups).toEqual({
        'SG-SST-Admins': 'ADMIN',
      });
      expect(updateCalls[0][0].data.isActive).toBe(true);
    });

    it('updateProvider clears roleGroups when null is sent and keeps the secret when empty', async () => {
      prisma.ssoProvider.update.mockResolvedValue({ id: 'provider-1' });

      await buildService().updateProvider(
        'provider-1',
        'company-a',
        {
          clientSecret: '',
          roleGroups: null,
        },
        encrypt,
      );

      const updateCalls = prisma.ssoProvider.update.mock
        .calls as unknown as Array<Array<{ data: Record<string, unknown> }>>;
      // Secreto vacio = sin cambio; null en roleGroups = limpiar el mapeo
      // (el servicio usa el sentinel DbNull de Prisma para SQL NULL).
      expect(updateCalls[0][0].data.clientSecret).toBeUndefined();
      expect(updateCalls[0][0].data.roleGroups).toBe(Prisma.DbNull);
    });

    it('findProviderByCompany masks the client secret and flags configured', async () => {
      prisma.ssoProvider.findUnique.mockResolvedValue({
        id: 'provider-1',
        clientSecret: encrypt('real-secret'),
      });

      const result = await buildService().findProviderByCompany('company-a');

      expect(result).toMatchObject({ id: 'provider-1', configured: true });
      expect((result as { clientSecret: string }).clientSecret).toBe('***');
    });

    it('findProviderByCompany returns null when not configured', async () => {
      prisma.ssoProvider.findUnique.mockResolvedValue(null);
      expect(
        await buildService().findProviderByCompany('company-a'),
      ).toBeNull();
    });

    it('findProviderById throws NotFound for an unknown provider', async () => {
      prisma.ssoProvider.findUnique.mockResolvedValue(null);
      await expect(
        buildService().findProviderById('nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('findProviderById returns the provider when it exists', async () => {
      const existing = { id: 'provider-1', companyId: 'company-a' };
      prisma.ssoProvider.findUnique.mockResolvedValue(existing);

      const result = await buildService().findProviderById('provider-1');

      expect(result).toEqual(existing);
      expect(prisma.ssoProvider.findUnique).toHaveBeenCalledWith({
        where: { id: 'provider-1' },
      });
    });

    it('deleteProvider removes the row', async () => {
      prisma.ssoProvider.delete.mockResolvedValue({ id: 'provider-1' });

      await buildService().deleteProvider('provider-1');

      expect(prisma.ssoProvider.delete).toHaveBeenCalledWith({
        where: { id: 'provider-1' },
      });
    });

    it('listActiveLoginOptions returns only public data of active providers', async () => {
      prisma.ssoProvider.findMany = jest.fn().mockResolvedValue([
        {
          id: 'p1',
          companyId: 'company-a',
          protocol: 'OIDC',
          issuer: 'https://idp-a',
          authorizationEndpoint: 'https://idp-a/authorize',
          company: { id: 'company-a', name: 'Empresa A' },
        },
        {
          id: 'p2',
          companyId: 'company-b',
          protocol: 'SAML',
          issuer: '',
          authorizationEndpoint: '',
          company: { id: 'company-b', name: 'Empresa B' },
        },
      ]);

      const options = await buildService().listActiveLoginOptions();

      expect(options).toEqual([
        { companyId: 'company-a', companyName: 'Empresa A', protocol: 'OIDC' },
        { companyId: 'company-b', companyName: 'Empresa B', protocol: 'SAML' },
      ]);
    });
  });

  describe('id_token exchange', () => {
    const jwksUri = 'https://idp.example.test/.well-known/jwks.json';
    const storedState = {
      id: 'state-1',
      companyId: 'company-a',
      redirect: '/',
      expiresAt: new Date(Date.now() + 60_000),
    };

    function mockState() {
      prisma.ssoState.findUnique.mockResolvedValue(storedState);
      prisma.ssoState.deleteMany.mockResolvedValue({ count: 1 });
    }

    it('rejects when the token endpoint fails', async () => {
      mockState();
      fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects when the userinfo endpoint fails', async () => {
      mockState();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
        .mockResolvedValueOnce(new Response('boom', { status: 500 }));

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when userinfo has no subject', async () => {
      mockState();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at' }))
        .mockResolvedValueOnce(jsonResponse({ email: 'x@company.test' }));

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the IdP returns neither id_token nor a userinfo endpoint', async () => {
      mockState();
      prisma.ssoProvider.findFirst.mockResolvedValue({
        ...provider,
        userinfoEndpoint: null,
      });
      fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'at' }));

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an id_token when no jwksUri is configured', async () => {
      mockState();
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ id_token: 'cualquier.jwt.valor' }),
      );

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('verifies the id_token signature against the JWKS and issues the session', async () => {
      mockState();
      prisma.ssoProvider.findFirst.mockResolvedValue({
        ...provider,
        jwksUri,
      });
      const keypair = await generateKeyPair('ES256');
      const publicJwk = await exportJWK(keypair.publicKey);
      const token = await new SignJWT({
        sub: 'sub-jwt',
        email: 'jwt@company.test',
        name: 'Usuario JWT',
        groups: ['Devs'],
      })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuer(provider.issuer)
        .setAudience(provider.clientId)
        .sign(keypair.privateKey);

      fetchMock.mockImplementation((url: string | URL) => {
        if (String(url) === provider.tokenEndpoint) {
          return Promise.resolve(jsonResponse({ id_token: token }));
        }
        if (String(url) === jwksUri) {
          return Promise.resolve(jsonResponse({ keys: [publicJwk] }));
        }
        return Promise.resolve(new Response('unexpected', { status: 500 }));
      });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-jwt',
        name: 'Usuario JWT',
        email: 'jwt@company.test',
        role: 'EMPLOYEE',
        companyId: 'company-a',
        isActive: true,
      });

      await buildService().handleCallback('auth-code', 'state-1');

      // Los claims salen del id_token verificado por firma (no de userinfo).
      expect(prisma.user.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          email: 'jwt@company.test',
          ssoSubject: `${provider.issuer}|sub-jwt`,
        }),
      });
      expect(fetchMock).not.toHaveBeenCalledWith(
        provider.userinfoEndpoint,
        expect.anything(),
      );
    });

    it('rejects an id_token without a subject (signature verified)', async () => {
      mockState();
      prisma.ssoProvider.findFirst.mockResolvedValue({
        ...provider,
        jwksUri,
      });
      const keypair = await generateKeyPair('ES256');
      const publicJwk = await exportJWK(keypair.publicKey);
      const token = await new SignJWT({ sub: '' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuer(provider.issuer)
        .setAudience(provider.clientId)
        .sign(keypair.privateKey);

      fetchMock.mockImplementation((url: string | URL) => {
        if (String(url) === provider.tokenEndpoint) {
          return Promise.resolve(jsonResponse({ id_token: token }));
        }
        if (String(url) === jwksUri) {
          return Promise.resolve(jsonResponse({ keys: [publicJwk] }));
        }
        return Promise.resolve(new Response('unexpected', { status: 500 }));
      });

      await expect(
        buildService().handleCallback('auth-code', 'state-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('rejects a session for an incomplete user record (integrity)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-incomplete',
        ssoSubject: `${provider.issuer}|sub-1`,
        email: 'incompleto@company.test',
        name: '',
        role: 'EMPLOYEE',
        isActive: true,
        companyId: 'company-a',
      });

      await expect(
        buildService().resolveUserAndIssueSession(provider, {
          sub: 'sub-1',
          email: 'incompleto@company.test',
        }),
      ).rejects.toThrow('SSO user record is incomplete');
      expect(authService.issueSession).not.toHaveBeenCalled();
    });
  });
});
