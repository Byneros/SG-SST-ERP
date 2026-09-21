import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { PrismaService } from '../src/database/prisma.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { TotpService } from '../src/modules/auth/totp.service';
import { AuditController } from '../src/modules/audit/audit.controller';
import { AuditService } from '../src/modules/audit/audit.service';
import { CompaniesController } from '../src/modules/companies/companies.controller';
import { CompaniesRepository } from '../src/modules/companies/companies.repository';
import { CompaniesService } from '../src/modules/companies/companies.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersRepository } from '../src/modules/users/users.repository';
import { UsersService } from '../src/modules/users/users.service';

const jwtSecret = 'test-secret';

/** Body de una respuesta supertest, tipado para evitar `any` inseguro. */
function body<T>(response: { body: unknown }): T {
  return response.body as T;
}

type MemoryUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  companyId?: string;
  refreshTokenHash?: string | null;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type MemoryCompany = {
  id: string;
  name: string;
  nit: string;
  arl?: string;
  riskClass?: string;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

class MemoryStore {
  users: MemoryUser[] = [];
  companies: MemoryCompany[] = [];
  auditLogs: Array<Record<string, unknown>> = [];
  auditSeq = 1;
}

class MemoryUsersRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(companyId?: string, query = { page: 1, pageSize: 10, search: '' }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.toLowerCase();
    const data = this.store.users
      .filter((user) => !companyId || user.companyId === companyId)
      .filter((user) =>
        search
          ? `${user.name} ${user.email}`.toLowerCase().includes(search)
          : true,
      )
      .map((user) => this.safeUser(user));
    return Promise.resolve({
      data: data.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        page,
        pageSize,
        total: data.length,
        totalPages: Math.ceil(data.length / pageSize),
      },
    });
  }

  count() {
    return Promise.resolve(this.store.users.length);
  }

  findById(id: string) {
    const user = this.store.users.find((item) => item.id === id);
    return Promise.resolve(user ? this.safeUser(user) : null);
  }

  findAuthById(id: string) {
    return Promise.resolve(
      this.store.users.find((item) => item.id === id) ?? null,
    );
  }

  findByEmail(email: string) {
    return Promise.resolve(
      this.store.users.find((item) => item.email === email) ?? null,
    );
  }

  create(
    dto: { name: string; email: string; role: string; companyId?: string },
    password: string,
  ) {
    const now = new Date();
    const user: MemoryUser = {
      id: randomUUID(),
      name: dto.name,
      email: dto.email,
      password,
      role: dto.role,
      companyId: dto.companyId,
      isActive: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
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
      companyId?: string;
      isActive?: boolean;
    },
  ) {
    const user = this.store.users.find((item) => item.id === id);
    if (!user) {
      throw new Error('User not found');
    }
    Object.assign(user, {
      name: dto.name ?? user.name,
      email: dto.email ?? user.email,
      role: dto.role ?? user.role,
      companyId: dto.companyId ?? user.companyId,
      isActive: dto.isActive ?? user.isActive,
      deletedAt:
        dto.isActive === undefined
          ? user.deletedAt
          : dto.isActive
            ? null
            : new Date(),
      updatedAt: new Date(),
    });
    return Promise.resolve(this.safeUser(user));
  }

  remove(id: string) {
    return this.update(id, { isActive: false });
  }

  updateRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    const user = this.store.users.find((item) => item.id === id);
    if (!user) {
      throw new Error('User not found');
    }
    user.refreshTokenHash = refreshTokenHash;
    return Promise.resolve(this.safeUser(user));
  }

  updatePassword(id: string, passwordHash: string) {
    const user = this.store.users.find((item) => item.id === id);
    if (!user) {
      throw new Error('User not found');
    }
    user.password = passwordHash;
    user.refreshTokenHash = null;
    return Promise.resolve(this.safeUser(user));
  }

  updatePasswordResetToken() {
    return Promise.resolve(null);
  }

  private safeUser(user: MemoryUser) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

class MemoryCompaniesRepository {
  constructor(private readonly store: MemoryStore) {}

  findAll(query = { page: 1, pageSize: 10, search: '' }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.toLowerCase();
    const data = this.store.companies.filter((company) =>
      search
        ? `${company.name} ${company.nit}`.toLowerCase().includes(search)
        : true,
    );
    return Promise.resolve({
      data: data.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        page,
        pageSize,
        total: data.length,
        totalPages: Math.ceil(data.length / pageSize),
      },
    });
  }

  findById(id: string) {
    return Promise.resolve(
      this.store.companies.find((item) => item.id === id) ?? null,
    );
  }

  findByNit(nit: string) {
    return Promise.resolve(
      this.store.companies.find((item) => item.nit === nit) ?? null,
    );
  }

  create(dto: { name: string; nit: string; arl?: string; riskClass?: string }) {
    const now = new Date();
    const company: MemoryCompany = {
      id: randomUUID(),
      name: dto.name,
      nit: dto.nit,
      arl: dto.arl,
      riskClass: dto.riskClass ?? 'CLASS_I',
      isActive: true,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.store.companies.unshift(company);
    return Promise.resolve(company);
  }

  update(id: string, dto: { name?: string; nit?: string; isActive?: boolean }) {
    const company = this.store.companies.find((item) => item.id === id);
    if (!company) {
      throw new Error('Company not found');
    }
    Object.assign(company, {
      ...dto,
      deletedAt:
        dto.isActive === undefined
          ? company.deletedAt
          : dto.isActive
            ? null
            : new Date(),
      updatedAt: new Date(),
    });
    return Promise.resolve(company);
  }

  remove(id: string) {
    return this.update(id, { isActive: false });
  }
}

class MemoryAuditService {
  constructor(private readonly store: MemoryStore) {}

  log(input: {
    user?: { sub: string };
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
  }) {
    const actor = this.store.users.find((user) => user.id === input.user?.sub);
    const log = {
      id: `audit-${this.store.auditSeq++}`,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before,
      after: input.after,
      actorId: input.user?.sub,
      actor: actor
        ? {
            id: actor.id,
            name: actor.name,
            email: actor.email,
            role: actor.role,
          }
        : null,
      createdAt: new Date(),
    };
    this.store.auditLogs.unshift(log);
    return Promise.resolve(log);
  }

  findAll(query = { page: 1, pageSize: 10, search: '' }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.toLowerCase();
    const data = this.store.auditLogs.filter((log) =>
      search
        ? [log.action, log.entity, log.entityId]
            .map((part) => String(part))
            .join(' ')
            .toLowerCase()
            .includes(search)
        : true,
    );
    return Promise.resolve({
      data: data.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        page,
        pageSize,
        total: data.length,
        totalPages: Math.ceil(data.length / pageSize),
      },
    });
  }
}

describe('security and permissions (e2e)', () => {
  let app: INestApplication<App>;
  let store: MemoryStore;

  beforeEach(async () => {
    store = new MemoryStore();
    store.users.push({
      id: randomUUID(),
      name: 'Admin',
      email: 'admin@sgsst.com',
      password: await bcrypt.hash('Admin12345', 12),
      role: 'ADMIN',
      isActive: true,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: jwtSecret,
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [
        AuthController,
        CompaniesController,
        UsersController,
        AuditController,
      ],
      providers: [
        AuthService,
        CompaniesService,
        UsersService,
        JwtAuthGuard,
        RolesGuard,
        {
          provide: UsersRepository,
          useValue: new MemoryUsersRepository(store),
        },
        {
          provide: CompaniesRepository,
          useValue: new MemoryCompaniesRepository(store),
        },
        { provide: AuditService, useValue: new MemoryAuditService(store) },
        {
          provide: PrismaService,
          useValue: {
            company: {
              findFirst: jest.fn(),
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
  });

  afterEach(async () => {
    await app?.close();
  });

  async function login(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);
    return body<{ accessToken: string }>(response).accessToken;
  }

  it('runs login, permissions, soft delete and audit log flow over HTTP', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/companies')
      .send({ name: 'Sin Token S.A.S.', nit: '900000000-1' })
      .expect(401);

    const adminToken = await login('admin@sgsst.com', 'Admin12345');

    const companyResponse = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Empresa Demo S.A.S.',
        nit: '900123456-7',
        arl: 'SURA',
        riskClass: 'CLASS_IV',
      })
      .expect(201);

    const companyId = body<{ id: string }>(companyResponse).id;
    const admin = store.users.find((user) => user.email === 'admin@sgsst.com');
    if (!admin) {
      throw new Error('Test administrator was not created');
    }
    admin.companyId = companyId;
    const scopedAdminToken = await login('admin@sgsst.com', 'Admin12345');

    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${scopedAdminToken}`)
      .send({
        name: 'Coordinador SST',
        email: 'sst@sgsst.com',
        password: 'Admin12345',
        role: 'SST',
        companyId,
      })
      .expect(201);

    const sstToken = await login('sst@sgsst.com', 'Admin12345');

    await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${sstToken}`)
      .send({ name: 'No Permitida S.A.S.', nit: '900222222-2' })
      .expect(403);

    const deletedResponse = await request(app.getHttpServer())
      .delete(`/api/v1/companies/${companyId}`)
      .set('Authorization', `Bearer ${scopedAdminToken}`)
      .expect(200);

    const deleted = body<{ isActive: boolean; deletedAt: unknown }>(
      deletedResponse,
    );
    expect(deleted.isActive).toBe(false);
    expect(deleted.deletedAt).toBeTruthy();

    await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${sstToken}`)
      .expect(403);

    const auditResponse = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?page=1&pageSize=10')
      .set('Authorization', `Bearer ${scopedAdminToken}`)
      .expect(200);

    expect(body<{ data: unknown }>(auditResponse).data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'CREATE',
          entity: 'Company',
          entityId: companyId,
        }),
        expect.objectContaining({
          action: 'DEACTIVATE',
          entity: 'Company',
          entityId: companyId,
        }),
        expect.objectContaining({ action: 'CREATE', entity: 'User' }),
      ]),
    );
  });
});
