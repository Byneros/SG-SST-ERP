import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

/**
 * E2e de INTEGRACION del rol DEVELOPER (panel tecnico de plataforma).
 *
 * Que valida:
 * - El usuario DEVELOPER creado por seed inicia sesion con el auth existente.
 * - Accede a los endpoints /developer/* con su token.
 * - Los roles de empresa (ADMIN/SST/EMPLOYEE) reciben 403 en /developer/*.
 * - SUPER_ADMIN tambien es 403 (no hay bypass: acceso exclusivo DEVELOPER).
 * - Sin token responde 401.
 * - La creacion por seed es idempotente (no duplica por email).
 * - Los endpoints de usuarios siguen rechazando DEVELOPER como rol asignable.
 */

describe('Developer role (e2e, PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const developerEmail = `developer-${randomUUID().slice(0, 8)}@integration.test`;
  const developerPassword = 'DeveloperPass#2026';
  let developerToken: string;
  let adminToken: string;
  let companyId: string;
  let developerId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    // Tenant normal para verificar el 403 de roles de empresa.
    const company = await prisma.company.create({
      data: {
        name: 'Empresa NoDeveloper',
        nit: `ND-${randomUUID().slice(0, 13)}`,
        isActive: true,
      },
    });
    companyId = company.id;
    const admin = await prisma.user.create({
      data: {
        name: 'Admin NoDeveloper',
        email: `admin-${randomUUID().slice(0, 8)}@integration.test`,
        password: await bcrypt.hash('Admin12345', 4),
        role: 'ADMIN',
        companyId: company.id,
        isActive: true,
      },
    });
    adminToken = await jwtService.signAsync({
      sub: admin.id,
      email: admin.email,
      role: 'ADMIN',
      companyId: company.id,
      activeCompanyId: null,
      type: 'access',
    });

    // Usuario DEVELOPER equivalente al que crea el seed (hash bcrypt 12).
    const developer = await prisma.user.create({
      data: {
        name: 'Desarrollador SG-SST',
        email: developerEmail,
        password: await bcrypt.hash(developerPassword, 12),
        role: 'DEVELOPER',
        companyId: null,
        isActive: true,
      },
    });
    developerId = developer.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: developerId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.auditLog.deleteMany({ where: { actorId: null } });
    await app?.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('el DEVELOPER inicia sesion con el sistema de auth existente', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: developerEmail, password: developerPassword })
      .expect(201);

    const session = response.body as {
      accessToken: string;
      user: { role: string; companyId: string | null };
    };
    expect(session.user.role).toBe('DEVELOPER');
    // Rol de plataforma: sin empresa asignada.
    expect(session.user.companyId).toBeNull();
    developerToken = session.accessToken;
  });

  it('accede al panel: /developer/overview, modules, queues, diagnostics', async () => {
    const overview = await request(app.getHttpServer())
      .get('/api/v1/developer/overview')
      .set(auth(developerToken))
      .expect(200);
    const overviewBody = overview.body as {
      dependencies: { database: string; redis: string };
    };
    expect(overviewBody.dependencies.database).toBe('ok');

    await request(app.getHttpServer())
      .get('/api/v1/developer/modules')
      .set(auth(developerToken))
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/developer/queues')
      .set(auth(developerToken))
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/developer/diagnostics')
      .set(auth(developerToken))
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/developer/audit')
      .set(auth(developerToken))
      .expect(200);

    // Endpoint de errores tecnicos: el buffer existe y responde con forma valida.
    const errors = await request(app.getHttpServer())
      .get('/api/v1/developer/errors')
      .set(auth(developerToken))
      .expect(200);
    const errorsBody = errors.body as {
      data: Array<{ level: string; message: string; timestamp: string }>;
      total: number;
    };
    expect(Array.isArray(errorsBody.data)).toBe(true);
    expect(typeof errorsBody.total).toBe('number');
    // Todo evento retenido debe venir enmascarado (sinBearer crudo).
    for (const event of errorsBody.data) {
      expect(event.message).not.toMatch(/Bearer\s+[A-Za-z0-9._~+/=-]{20,}/);
    }
  });

  it('los roles de empresa reciben 403 en /developer/*', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/developer/overview')
      .set(auth(adminToken))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/developer/errors')
      .set(auth(adminToken))
      .expect(403);
  });

  it('SUPER_ADMIN tambien recibe 403 (sin bypass: rol exclusivo)', async () => {
    const superAdminToken = await jwtService.signAsync({
      sub: developerId,
      email: developerEmail,
      role: 'SUPER_ADMIN',
      companyId: null,
      activeCompanyId: null,
      type: 'access',
    });
    await request(app.getHttpServer())
      .get('/api/v1/developer/overview')
      .set(auth(superAdminToken))
      .expect(403);
  });

  it('rechaza solicitudes sin token (401)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/developer/overview')
      .expect(401);
  });

  it('la API de usuarios rechaza crear/promover DEVELOPER (400/403)', async () => {
    // El DTO excluye DEVELOPER -> forbidNonWhitelisted responde 400.
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({
        name: 'Intento de escalation',
        email: `x-${randomUUID().slice(0, 6)}@test.com`,
        password: 'Password123',
        role: 'DEVELOPER',
        companyId,
      })
      .expect(400);
  });

  it('el DEVELOPER no puede usar endpoints de negocio de tenants (403)', async () => {
    // resolveCompanyScope: sin companyId activo, cualquier recurso tenant -> 403.
    await request(app.getHttpServer())
      .get('/api/v1/employees')
      .set(auth(developerToken))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/companies')
      .set(auth(developerToken))
      .expect(403);
  });

  it('crear el DEVELOPER dos veces no duplica (idempotente por email)', async () => {
    const developerPasswordHash = await bcrypt.hash(developerPassword, 12);
    // Mismo upsert que prisma/seed.ts usa con DEVELOPER_EMAIL/DEVELOPER_PASSWORD.
    await prisma.user.upsert({
      where: { email: developerEmail },
      update: { name: 'Desarrollador SG-SST', role: 'DEVELOPER' },
      create: {
        name: 'Desarrollador SG-SST',
        email: developerEmail,
        password: developerPasswordHash,
        role: 'DEVELOPER',
        companyId: null,
      },
    });

    const count = await prisma.user.count({ where: { email: developerEmail } });
    expect(count).toBe(1);
  });
});
