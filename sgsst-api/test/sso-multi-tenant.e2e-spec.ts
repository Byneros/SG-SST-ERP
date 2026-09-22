import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PrismaService } from '../src/database/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { TotpService } from '../src/modules/auth/totp.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { encryptSecret } from '../src/modules/sso/sso-crypto';
import { SamlAuthController } from '../src/modules/sso/saml/saml-auth.controller';
import { SamlService } from '../src/modules/sso/saml/saml.service';
import { SsoAuthController } from '../src/modules/sso/sso-auth.controller';
import { SsoController } from '../src/modules/sso/sso.controller';
import { SsoService } from '../src/modules/sso/sso.service';

/**
 * Suite e2e de aislamiento SSO en el harness multi-tenant.
 *
 * Escenario: dos empresas (A y B), cada una con su proveedor SSO OIDC propio
 * (IdP mock sobre `fetch`, misma tecnica que el spec unitario de SsoService).
 * Verifica:
 *  - state one-shot: no reuso, expiracion, y redirect unsafe descartado
 *  - cada state se consume contra el provider de su empresa (multi-tenant)
 *  - JIT: el usuario se crea dentro de la empresa del provider, no en la otra
 *  - vinculacion por email aislada (correo de B no se vincula con provider de A)
 *  - usuarios inactivos rechazados
 *  - RBAC del panel admin (EMPLOYEE 403; ADMIN de A no ve el provider de B)
 *  - SAML: RelayState de otra empresa rechazado (aislamiento cross-tenant)
 */

const jwtSecret = 'test-secret';

function body<T>(response: { body: unknown }): T {
  return response.body as T;
}

// ---------------------------------------------------------------------------
// Store en memoria
// ---------------------------------------------------------------------------

type SsoProviderRow = {
  id: string;
  companyId: string;
  protocol: 'OIDC' | 'SAML';
  issuer: string;
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string | null;
  scopes: string;
  defaultRole: 'EMPLOYEE' | 'SST' | 'AUDITOR' | 'ADMIN';
  jwksUri: string | null;
  roleGroups: Record<string, string> | null;
  isActive: boolean;
  // Campos SAML (presentes cuando protocol = SAML).
  idpEntityId?: string | null;
  idpSsoUrl?: string | null;
  idpCertificate?: string | null;
  idpMetadata?: string | null;
  spEntityId?: string | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  companyId: string;
  refreshTokenHash: string | null;
  isActive: boolean;
  ssoSubject: string | null;
};

class MemoryStore {
  companies: Array<{
    id: string;
    name: string;
    nit: string;
    isActive: boolean;
  }> = [];
  users: UserRow[] = [];
  ssoProviders: SsoProviderRow[] = [];
  ssoStates: Array<{
    id: string;
    companyId: string;
    redirect: string | null;
    expiresAt: Date;
  }> = [];
}

/**
 * Repositorio de usuarios en memoria: suficiente para login por password
 * (admins del harness) y para la emision de sesiones SSO (refresh hash,
 * busquedas por ssoSubject/email). Misma superficie que UsersRepository.
 */
class MemoryUsersRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(
    companyId?: string,
    query: { page?: number; pageSize?: number } = {},
  ) {
    const rows = this.store.users
      .filter((u) => u.companyId === companyId)
      .map((u) => this.safeUser(u));
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    return Promise.resolve({
      data: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        page,
        pageSize,
        total: rows.length,
        totalPages: Math.ceil(rows.length / pageSize),
      },
    });
  }

  count() {
    return Promise.resolve(this.store.users.length);
  }

  findById(id: string) {
    const user = this.store.users.find((u) => u.id === id);
    return Promise.resolve(user ? this.safeUser(user) : null);
  }

  findByIdScoped(id: string, companyId: string) {
    const user = this.store.users.find(
      (u) => u.id === id && u.companyId === companyId,
    );
    return Promise.resolve(user ? this.safeUser(user) : null);
  }

  findAuthById(id: string) {
    return Promise.resolve(this.store.users.find((u) => u.id === id) ?? null);
  }

  findByEmail(email: string) {
    return Promise.resolve(
      this.store.users.find((u) => u.email === email) ?? null,
    );
  }

  create(
    dto: { name: string; email: string; role: string; companyId?: string },
    passwordHash: string,
  ) {
    const user: UserRow = {
      id: randomUUID(),
      name: dto.name,
      email: dto.email,
      password: passwordHash,
      role: dto.role,
      companyId: dto.companyId ?? null,
      refreshTokenHash: null,
      isActive: true,
      ssoSubject: null,
    };
    this.store.users.unshift(user);
    return Promise.resolve(this.safeUser(user));
  }

  update(
    id: string,
    dto: {
      name?: string;
      email?: string;
      role?: string;
      companyId?: string | null;
      isActive?: boolean;
    },
  ) {
    const user = this.store.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    Object.assign(user, dto, {
      updatedAt: new Date(),
    });
    return Promise.resolve(this.safeUser(user));
  }

  updateScoped(
    id: string,
    companyId: string,
    dto: {
      name?: string;
      email?: string;
      role?: string;
      companyId?: string | null;
      isActive?: boolean;
    },
  ) {
    const user = this.store.users.find(
      (u) => u.id === id && u.companyId === companyId,
    );
    if (!user) return { count: 0 };
    void this.update(id, dto);
    return { count: 1 };
  }

  remove(id: string) {
    return this.update(id, { isActive: false });
  }

  async removeScoped(id: string, companyId: string) {
    const user = this.store.users.find(
      (u) => u.id === id && u.companyId === companyId,
    );
    if (!user) return { count: 0 };
    await this.update(id, { isActive: false });
    return { count: 1 };
  }

  updateRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    const user = this.store.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    user.refreshTokenHash = refreshTokenHash;
    return Promise.resolve(this.safeUser(user));
  }

  updatePassword(id: string, passwordHash: string) {
    const user = this.store.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    user.password = passwordHash;
    user.refreshTokenHash = null;
    return Promise.resolve(this.safeUser(user));
  }

  updatePasswordResetToken() {
    return Promise.resolve(null);
  }

  private safeUser(user: UserRow) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}

// ---------------------------------------------------------------------------
// IdP mock (OIDC): subjetos por empresa; token/userinfo mockeados via fetch
// ---------------------------------------------------------------------------

const idpA = {
  issuer: 'https://idp-a.example.test',
  tokenEndpoint: 'https://idp-a.example.test/token',
  userinfoEndpoint: 'https://idp-a.example.test/userinfo',
  subjects: new Map<
    string,
    { email: string; name: string; groups?: string[] }
  >(),
};

const idpB = {
  issuer: 'https://idp-b.example.test',
  tokenEndpoint: 'https://idp-b.example.test/token',
  userinfoEndpoint: 'https://idp-b.example.test/userinfo',
  subjects: new Map<
    string,
    { email: string; name: string; groups?: string[] }
  >(),
};

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const fetchMock = jest.fn();

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SSO multi-tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let store: MemoryStore;
  let jwtService: JwtService;

  let companyA: { companyId: string; token: string; provider: SsoProviderRow };
  let companyB: { companyId: string; token: string; provider: SsoProviderRow };

  const password = 'Admin12345';

  beforeAll(async () => {
    globalThis.fetch = fetchMock;
    store = new MemoryStore();

    // Empresas
    for (const [name, nit] of [
      ['Empresa A S.A.S.', '900000001-1'],
      ['Empresa B S.A.S.', '900000002-2'],
    ] as const) {
      store.companies.push({ id: randomUUID(), name, nit, isActive: true });
    }
    const [companyARecord, companyBRecord] = store.companies;

    // Admin por empresa
    const passwordHash = await bcrypt.hash(password, 4);
    for (const [email, company] of [
      ['admin-a@test.com', companyARecord],
      ['admin-b@test.com', companyBRecord],
    ] as const) {
      store.users.push({
        id: randomUUID(),
        name: `Admin ${company.name}`,
        email,
        password: passwordHash,
        role: 'ADMIN',
        companyId: company.id,
        refreshTokenHash: null,
        isActive: true,
        ssoSubject: null,
      });
    }

    // Provider SSO OIDC por empresa (secreto cifrado, igual que en produccion).
    for (const [company, idp] of [
      [companyARecord, idpA],
      [companyBRecord, idpB],
    ] as const) {
      store.ssoProviders.push({
        id: randomUUID(),
        companyId: company.id,
        protocol: 'OIDC',
        issuer: idp.issuer,
        clientId: `client-${company.id}`,
        // El servicio descifra el secreto al usarlo: se persiste cifrado
        // igual que en produccion (misma rutina sso-crypto).
        clientSecret: encryptSecret(`secret-${company.id}`),
        authorizationEndpoint: `${idp.issuer}/authorize`,
        tokenEndpoint: idp.tokenEndpoint,
        userinfoEndpoint: idp.userinfoEndpoint,
        scopes: 'openid email profile',
        defaultRole: 'EMPLOYEE',
        jwksUri: null,
        roleGroups: null,
        isActive: true,
      });
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [
        AuthController,
        SsoAuthController,
        SsoController,
        SamlAuthController,
      ],
      providers: [
        AuthService,
        SsoService,
        SamlService,
        JwtAuthGuard,
        RolesGuard,
        {
          provide: UsersRepository,
          useValue: new MemoryUsersRepository(store),
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PrismaService,
          useValue: {
            company: { findFirst: jest.fn() },
            ssoProvider: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            ssoState: {
              create: jest.fn(),
              findUnique: jest.fn(),
              deleteMany: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: TotpService,
          useValue: {
            generateSecret: jest.fn(),
            verify: jest.fn(),
            otpauthUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Reconfigurar el mock de Prisma para delegar en el store en memoria.
    const prisma: {
      ssoProvider: Record<string, jest.Mock>;
      ssoState: Record<string, jest.Mock>;
      user: Record<string, jest.Mock>;
    } = moduleFixture.get(PrismaService);

    prisma.ssoProvider.findFirst.mockImplementation(
      (args: {
        where: { companyId: string; isActive?: boolean; protocol?: string };
      }) =>
        Promise.resolve(
          store.ssoProviders.find(
            (p) =>
              p.companyId === args.where.companyId &&
              (args.where.isActive === undefined || p.isActive),
          ) ?? null,
        ),
    );
    prisma.ssoProvider.findUnique.mockImplementation(
      (args: { where: { companyId?: string; id?: string } }) =>
        Promise.resolve(
          store.ssoProviders.find(
            (p) =>
              (args.where.companyId !== undefined &&
                p.companyId === args.where.companyId) ||
              (args.where.id !== undefined && p.id === args.where.id),
          ) ?? null,
        ),
    );
    prisma.ssoState.create.mockImplementation(
      (args: {
        data: {
          id: string;
          companyId: string;
          redirect: string | null;
          expiresAt: Date;
        };
      }) => {
        store.ssoStates.push(args.data);
        return Promise.resolve(args.data);
      },
    );
    prisma.ssoState.findUnique.mockImplementation(
      (args: { where: { id: string } }) =>
        Promise.resolve(
          store.ssoStates.find((s) => s.id === args.where.id) ?? null,
        ),
    );
    prisma.ssoState.deleteMany.mockImplementation(
      (args: { where: { id: string } }) => {
        const index = store.ssoStates.findIndex((s) => s.id === args.where.id);
        if (index >= 0) store.ssoStates.splice(index, 1);
        return Promise.resolve({ count: index >= 0 ? 1 : 0 });
      },
    );
    prisma.user.findUnique.mockImplementation(
      (args: {
        where: { ssoSubject?: string; email?: string; id?: string };
      }) => {
        let user: UserRow | undefined;
        if (args.where.ssoSubject !== undefined) {
          user = store.users.find(
            (u) => u.ssoSubject === args.where.ssoSubject,
          );
        } else if (args.where.email !== undefined) {
          user = store.users.find((u) => u.email === args.where.email);
        } else if (args.where.id !== undefined) {
          user = store.users.find((u) => u.id === args.where.id);
        }
        return Promise.resolve(user ?? null);
      },
    );
    prisma.user.update.mockImplementation(
      (args: {
        where: { id: string };
        data: Partial<Pick<UserRow, 'ssoSubject' | 'role'>>;
      }) => {
        const user = store.users.find((u) => u.id === args.where.id);
        if (!user) return Promise.reject(new Error('User not found'));
        Object.assign(user, args.data);
        return Promise.resolve(user);
      },
    );
    prisma.user.create.mockImplementation(
      (args: { data: Partial<UserRow> }) => {
        // El Prisma real genera id/createdAt: el mock replica ese contrato.
        const user: UserRow = {
          id: randomUUID(),
          name: args.data.name ?? '',
          email: args.data.email ?? '',
          password: args.data.password ?? '',
          role: args.data.role ?? 'EMPLOYEE',
          companyId: args.data.companyId ?? null,
          refreshTokenHash: null,
          isActive: true,
          ssoSubject: args.data.ssoSubject ?? null,
        };
        store.users.unshift(user);
        return Promise.resolve(user);
      },
    );

    jwtService = moduleFixture.get(JwtService);

    // Login real de los admins (ejercita AuthController + AuthService).
    async function loginAdmin(email: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(201);
      return body<{ accessToken: string }>(response).accessToken;
    }

    companyA = {
      companyId: companyARecord.id,
      token: await loginAdmin('admin-a@test.com'),
      provider: store.ssoProviders.find(
        (p) => p.companyId === companyARecord.id,
      )!,
    };
    companyB = {
      companyId: companyBRecord.id,
      token: await loginAdmin('admin-b@test.com'),
      provider: store.ssoProviders.find(
        (p) => p.companyId === companyBRecord.id,
      )!,
    };
  });

  afterAll(async () => {
    await app?.close();
  });

  function tokenFor(tenant: { token: string }) {
    return `Bearer ${tenant.token}`;
  }

  /** Pide la authorization URL de un tenant (paso 1 del flujo OIDC). */
  function authorize(tenant: { companyId: string }) {
    return request(app.getHttpServer())
      .get('/api/v1/auth/sso/authorize')
      .query({ companyId: tenant.companyId, redirect: '/dashboard' });
  }

  /** Extrae el state de la authorization URL. */
  function stateOf(authorizationUrl: string): string {
    return new URL(authorizationUrl).searchParams.get('state') ?? '';
  }

  /** Registra un sujeto en el IdP mock de una empresa. */
  function givenIdpSubject(
    idp: typeof idpA | typeof idpB,
    sub: string,
    profile: { email: string; name: string; groups?: string[] },
  ) {
    idp.subjects.set(sub, profile);
  }

  /** Simula el canje del codigo: userinfo del IdP mock del provider. */
  function mockTokenExchangeFor(provider: SsoProviderRow, sub: string) {
    const idp = provider.issuer === idpA.issuer ? idpA : idpB;
    const profile = idp.subjects.get(sub);
    fetchMock.mockImplementation((url: string | URL) => {
      if (String(url) === provider.tokenEndpoint) {
        return jsonResponse({ access_token: `at-${sub}` });
      }
      if (String(url) === provider.userinfoEndpoint) {
        if (!profile) {
          return new Response(JSON.stringify({ error: 'not_found' }), {
            status: 404,
          });
        }
        return jsonResponse({ sub, ...profile });
      }
      return new Response('unexpected url', { status: 500 });
    });
  }

  // -------------------------------------------------------------------------
  // Flujo OIDC completo por empresa
  // -------------------------------------------------------------------------

  it('completes the OIDC flow for Company A and lands the JIT user in Company A only', async () => {
    givenIdpSubject(idpA, 'sub-a1', {
      email: 'nuevo-a@empresa-a.test',
      name: 'Nuevo A',
    });
    mockTokenExchangeFor(companyA.provider, 'sub-a1');

    const authorizeResponse = await authorize(companyA).expect(200);
    const authorizationUrl = body<{ authorizationUrl: string }>(
      authorizeResponse,
    ).authorizationUrl;
    // La URL apunta al IdP de A, no al de B.
    expect(authorizationUrl.startsWith(`${idpA.issuer}/authorize`)).toBe(true);

    const callback = await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback')
      .query({ code: 'auth-code', state: stateOf(authorizationUrl) })
      .expect(302);

    // El JIT crea el usuario dentro de la empresa A.
    const ssoUser = store.users.find(
      (u) => u.email === 'nuevo-a@empresa-a.test',
    );
    expect(ssoUser).toBeDefined();
    expect(ssoUser?.companyId).toBe(companyA.companyId);
    expect(ssoUser?.role).toBe('EMPLOYEE');

    // La sesion emitida corresponde a la empresa A.
    const location = String(callback.headers.location);
    expect(location).toContain(`companyId%22%3A%22${companyA.companyId}`);
  });

  it('completes the OIDC flow for Company B with its own IdP and provider', async () => {
    givenIdpSubject(idpB, 'sub-b1', {
      email: 'nuevo-b@empresa-b.test',
      name: 'Nuevo B',
    });
    mockTokenExchangeFor(companyB.provider, 'sub-b1');

    const authorizeResponse = await authorize(companyB).expect(200);
    const authorizationUrl = body<{ authorizationUrl: string }>(
      authorizeResponse,
    ).authorizationUrl;
    expect(authorizationUrl.startsWith(`${idpB.issuer}/authorize`)).toBe(true);

    await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback')
      .query({ code: 'auth-code', state: stateOf(authorizationUrl) })
      .expect(302);

    const ssoUser = store.users.find(
      (u) => u.email === 'nuevo-b@empresa-b.test',
    );
    expect(ssoUser?.companyId).toBe(companyB.companyId);
    // Ningun usuario de B aterrizo en A ni viceversa.
    expect(
      store.users.find((u) => u.email === 'nuevo-b@empresa-b.test')?.companyId,
    ).not.toBe(companyA.companyId);
  });

  it('rejects a reused state (one-shot)', async () => {
    givenIdpSubject(idpA, 'sub-a2', {
      email: 'reuso@empresa-a.test',
      name: 'Reuso',
    });
    mockTokenExchangeFor(companyA.provider, 'sub-a2');

    const authorizeResponse = await authorize(companyA).expect(200);
    const state = stateOf(
      body<{ authorizationUrl: string }>(authorizeResponse).authorizationUrl,
    );

    await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback')
      .query({ code: 'auth-code', state })
      .expect(302);

    // Segundo uso del mismo state: rechazado sin llamar al IdP.
    fetchMock.mockClear();
    await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback')
      .query({ code: 'auth-code', state })
      .expect(302);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an expired state', async () => {
    const authorizeResponse = await authorize(companyA).expect(200);
    const state = stateOf(
      body<{ authorizationUrl: string }>(authorizeResponse).authorizationUrl,
    );
    // Forzar expiracion en el store.
    const stored = store.ssoStates.find((s) => s.id === state);
    if (stored) stored.expiresAt = new Date(Date.now() - 1_000);

    // Si el flujo prosiguiera, el IdP entregaria este perfil (probaria el
    // alta JIT): la asercion negativa demuestra que no se llego a crear.
    givenIdpSubject(idpA, 'sub-expired', {
      email: 'expirado@empresa-a.test',
      name: 'Expirado',
    });
    mockTokenExchangeFor(companyA.provider, 'sub-expired');

    await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback')
      .query({ code: 'auth-code', state })
      .expect(302);
    // El state expirado no deja usuario creado.
    expect(store.users.some((u) => u.email === 'expirado@empresa-a.test')).toBe(
      false,
    );
  });

  it('does not consume the state of Company B when completing the flow of Company A (tenant isolation)', async () => {
    // Flujo iniciado para A.
    const authorizeA = await authorize(companyA).expect(200);
    const stateA = stateOf(
      body<{ authorizationUrl: string }>(authorizeA).authorizationUrl,
    );

    // Flujo iniciado para B.
    const authorizeB = await authorize(companyB).expect(200);
    const stateB = stateOf(
      body<{ authorizationUrl: string }>(authorizeB).authorizationUrl,
    );

    // El state de B pertenece a B: su provider es el de B (se verifica indirectamente:
    // completar el flujo de B usa el IdP de B).
    givenIdpSubject(idpB, 'sub-b2', {
      email: 'cross@empresa-b.test',
      name: 'Cross B',
    });
    mockTokenExchangeFor(companyB.provider, 'sub-b2');

    await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback')
      .query({ code: 'auth-code', state: stateB })
      .expect(302);

    // El usuario aterrizo en B (provider de B), no en A.
    const user = store.users.find((u) => u.email === 'cross@empresa-b.test');
    expect(user?.companyId).toBe(companyB.companyId);

    // El state de A sigue vivo (no fue consumido por el flujo de B).
    expect(store.ssoStates.some((s) => s.id === stateA)).toBe(true);

    // Limpieza: consumir el state de A para no afectar otros tests.
    mockTokenExchangeFor(companyA.provider, 'sub-a1');
    await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback')
      .query({ code: 'auth-code', state: stateA })
      .expect(302);
  });

  it('rejects linking an email that belongs to another company (tenant isolation)', async () => {
    // Cuenta existente en B.
    const bUser: UserRow = {
      id: randomUUID(),
      name: 'Empleado B',
      email: 'empleado@empresa-b.test',
      password: 'irrelevant',
      role: 'SST',
      companyId: companyB.companyId,
      refreshTokenHash: null,
      isActive: true,
      ssoSubject: null,
    };
    store.users.unshift(bUser);

    // El IdP de A autentica a alguien con el correo de la cuenta de B.
    givenIdpSubject(idpA, 'sub-a3', {
      email: bUser.email,
      name: 'Empleado B',
    });
    mockTokenExchangeFor(companyA.provider, 'sub-a3');

    await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback')
      .query({
        code: 'auth-code',
        state: stateOf(
          body<{ authorizationUrl: string }>(
            await authorize(companyA).expect(200),
          ).authorizationUrl,
        ),
      })
      .expect(302);

    // La cuenta de B NO fue vinculada al IdP de A y conserva su empresa/rol.
    expect(bUser.ssoSubject).toBeNull();
    expect(bUser.companyId).toBe(companyB.companyId);
    expect(bUser.role).toBe('SST');
  });

  it('rejects an inactive user at SSO login', async () => {
    const inactive: UserRow = {
      id: randomUUID(),
      name: 'Inactivo A',
      email: 'inactivo@empresa-a.test',
      password: 'irrelevant',
      role: 'EMPLOYEE',
      companyId: companyA.companyId,
      refreshTokenHash: null,
      isActive: false,
      ssoSubject: null,
    };
    store.users.unshift(inactive);

    givenIdpSubject(idpA, 'sub-a4', {
      email: inactive.email,
      name: 'Inactivo A',
    });
    mockTokenExchangeFor(companyA.provider, 'sub-a4');

    await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback')
      .query({
        code: 'auth-code',
        state: stateOf(
          body<{ authorizationUrl: string }>(
            await authorize(companyA).expect(200),
          ).authorizationUrl,
        ),
      })
      .expect(302);

    // El usuario sigue inactivo y sin identidad federada.
    expect(inactive.isActive).toBe(false);
    expect(inactive.ssoSubject).toBeNull();
  });

  it('discards an unsafe redirect target at authorize time', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/sso/authorize')
      .query({ companyId: companyA.companyId, redirect: '//evil.example.test' })
      .expect(200)
      .then((response) => {
        const state = stateOf(
          body<{ authorizationUrl: string }>(response).authorizationUrl,
        );
        const stored = store.ssoStates.find((s) => s.id === state);
        expect(stored?.redirect ?? null).toBeNull();
      });
  });

  // -------------------------------------------------------------------------
  // RBAC del panel de administracion de providers
  // -------------------------------------------------------------------------

  it('requires ADMIN to read provider configuration (EMPLOYEE blocked)', async () => {
    const employee: UserRow = {
      id: randomUUID(),
      name: 'Empleado Panel',
      email: 'panel@empresa-a.test',
      password: 'irrelevant',
      role: 'EMPLOYEE',
      companyId: companyA.companyId,
      refreshTokenHash: null,
      isActive: true,
      ssoSubject: null,
    };
    store.users.unshift(employee);

    const employeeToken = await jwtService.signAsync({
      sub: employee.id,
      email: employee.email,
      role: employee.role,
      companyId: employee.companyId,
      activeCompanyId: null,
      type: 'access',
    });

    await request(app.getHttpServer())
      .get('/api/v1/sso/providers')
      .query({ companyId: companyA.companyId })
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(403);
  });

  it('denies Company A admin access to Company B provider configuration', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sso/providers')
      .query({ companyId: companyB.companyId })
      .set('Authorization', tokenFor(companyA))
      .expect(403);

    const providerBId = companyB.provider.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/sso/providers/${providerBId}`)
      .set('Authorization', tokenFor(companyA))
      .send({ isActive: false })
      .expect(403);
  });

  it('allows Company A admin to read its own provider configuration without leaking the secret', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/sso/providers')
      .query({ companyId: companyA.companyId })
      .set('Authorization', tokenFor(companyA))
      .expect(200)
      .then((response) => {
        const provider = body<{ clientSecret: string; configured: boolean }>(
          response,
        );
        expect(provider.configured).toBe(true);
        expect(provider.clientSecret).toBe('***');
      });
  });

  // -------------------------------------------------------------------------
  // SAML: aislamiento del RelayState cross-tenant
  // -------------------------------------------------------------------------

  it('rejects a SAML RelayState issued for another company (tenant isolation)', async () => {
    // Se registra el provider SAML de B (config valida: si el RelayState
    // coincidiera, el flujo prosiguiera; el rechazo debe venir del aislamiento).
    const samlProviderB: SsoProviderRow = {
      ...companyB.provider,
      id: randomUUID(),
      protocol: 'SAML',
      issuer: '',
      clientId: '',
      clientSecret: '',
      authorizationEndpoint: '',
      tokenEndpoint: '',
      userinfoEndpoint: null,
      scopes: '',
      jwksUri: null,
      idpEntityId: 'https://idp-b.example.test/sso',
      idpSsoUrl: 'https://idp-b.example.test/sso/login',
      idpCertificate:
        'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA-e2e-test-certificate',
      spEntityId: null,
      isActive: true,
    };
    // Reemplazar el provider OIDC de B por SAML para este test (un activo por
    // empresa). Al finalizar se restaura.
    store.ssoProviders = store.ssoProviders.filter(
      (p) => p.companyId !== companyB.companyId,
    );
    store.ssoProviders.push(samlProviderB);

    // RelayState emitido por el authorize de A (empresa A, provider OIDC).
    const authorizeA = await authorize(companyA).expect(200);
    const stateFromA = stateOf(
      body<{ authorizationUrl: string }>(authorizeA).authorizationUrl,
    );

    // El ACS de B recibe ese RelayState: rechazo (no filtra ni emite sesion).
    await request(app.getHttpServer())
      .post(`/api/v1/auth/sso/saml/${companyB.companyId}/acs`)
      .type('form')
      .send({ SAMLResponse: 'PEN-VALUES', RelayState: stateFromA })
      .expect(302)
      .then((response) => {
        // El ACS redirige a la web con error, nunca con sesion.
        expect(String(response.headers.location)).toContain('sso=error');
      });

    // Semantica one-shot: el RelayState se consume incluso en el intento
    // cross-tenant (no queda reutilizable), y la sesion nunca se emitio.
    expect(store.ssoStates.some((s) => s.id === stateFromA)).toBe(false);

    // Restaurar el provider OIDC de B.
    store.ssoProviders = store.ssoProviders.filter(
      (p) => p.companyId !== companyB.companyId,
    );
    store.ssoProviders.push(companyB.provider);
  });
});
