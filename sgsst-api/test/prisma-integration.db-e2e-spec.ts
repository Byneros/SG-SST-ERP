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
 * E2E de INTEGRACION con PostgreSQL real (a diferencia de las suites que usan
 * repositorios en memoria). Requiere una base de datos migrada; ver
 * `npm run test:e2e:db` y el job `api-integration-db` de CI.
 *
 * Que valida:
 * - Las queries Prisma reales de companies/sites/employees/risks aplican el
 *   scoping por companyId (findByIdScoped / updateMany con where por tenant).
 * - Un usuario de la empresa A no ve ni puede mutar recursos de la empresa B
 *   a traves de HTTP (404), y manipular companyId del cliente no evita el
 *   aislamiento (403).
 * - El modulo ai-assistant consulta solo datos de la empresa del actor.
 *
 * NOTA de aislamiento: esta suite crea empresas con NIT unico (randomUUID) y
 * limpia sus datos al final; no debe apuntar a una base con datos reales.
 */

// La DATABASE_URL se inyecta por el runner (test:e2e:db / CI) ANTES de cargar
// Nest; el PrismaService lee env.databaseUrl al instanciar el modulo.

describe('Prisma integration (e2e, PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const password = 'Admin12345';
  let tokenA: string;
  let tokenB: string;
  let companyAId: string;
  let companyBId: string;
  let siteAId: string;
  let employeeAId: string;

  async function seedTenant(nitSuffix: string) {
    const company = await prisma.company.create({
      data: {
        name: `Empresa Integracion ${nitSuffix}`,
        nit: `IT-${randomUUID().slice(0, 13)}`,
        isActive: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        name: `Admin ${nitSuffix}`,
        email: `admin-${nitSuffix}@integration.test`,
        password: await bcrypt.hash(password, 4),
        role: 'ADMIN',
        companyId: company.id,
        isActive: true,
      },
    });
    return { company, user };
  }

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

    // La app ya conecto via PrismaService (onModuleInit). Migraciones las
    // aplica el runner del job (prisma migrate deploy) antes de Jest.
    const tenantA = await seedTenant('A');
    const tenantB = await seedTenant('B');
    companyAId = tenantA.company.id;
    companyBId = tenantB.company.id;

    const siteA = await prisma.site.create({
      data: {
        name: 'Sede Principal A',
        code: `SEDE-A-${randomUUID().slice(0, 6)}`,
        companyId: companyAId,
        isActive: true,
      },
    });
    siteAId = siteA.id;

    const employeeA = await prisma.employee.create({
      data: {
        firstName: 'Integracion',
        lastName: 'A',
        document: `IT-${randomUUID().slice(0, 13)}`,
        position: 'Operario',
        companyId: companyAId,
        siteId: siteAId,
        isActive: true,
      },
    });
    employeeAId = employeeA.id;

    await prisma.risk.create({
      data: {
        title: 'Riesgo mecanico A',
        level: 'MEDIUM',
        companyId: companyAId,
        siteId: siteAId,
      },
    });

    tokenA = await jwtService.signAsync({
      sub: tenantA.user.id,
      email: tenantA.user.email,
      role: 'ADMIN',
      companyId: companyAId,
      activeCompanyId: null,
      type: 'access',
    });
    tokenB = await jwtService.signAsync({
      sub: tenantB.user.id,
      email: tenantB.user.email,
      role: 'ADMIN',
      companyId: companyBId,
      activeCompanyId: null,
      type: 'access',
    });
  });

  afterAll(async () => {
    // Limpieza por tenant (orden por dependencias FK).
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.risk.deleteMany({ where: { companyId } });
      await prisma.employee.deleteMany({ where: { companyId } });
      await prisma.site.deleteMany({ where: { companyId } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.auditLog.deleteMany({ where: { actorId: null } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    }
    await app?.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('las queries Prisma scoped no encuentran recursos de otra empresa', async () => {
    const foundScoped = await prisma.site.findFirst({
      where: { id: siteAId, companyId: companyBId },
    });
    expect(foundScoped).toBeNull();

    const owned = await prisma.site.findFirst({
      where: { id: siteAId, companyId: companyAId },
    });
    expect(owned).not.toBeNull();
  });

  it('GET /employees/:id devuelve 404 para el recurso de otra empresa', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeAId}`)
      .set(auth(tokenB))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeAId}`)
      .set(auth(tokenA))
      .expect(200);
  });

  it('PATCH con companyId manipulado no muta la otra empresa (404: el recurso ajeno no existe para el actor)', async () => {
    // EmployeesService.update valida el scope del recurso ANTES del dto:
    // un empleado de otra empresa no existe para B (404), y el update
    // restrictivo (updateMany where companyId) nunca toca registros ajenos.
    await request(app.getHttpServer())
      .patch(`/api/v1/employees/${employeeAId}`)
      .set(auth(tokenB))
      .send({ position: 'Hacked', companyId: companyBId })
      .expect(404);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeAId },
    });
    expect(employee?.position).toBe('Operario');
  });

  it('crear site con companyId ajeno queda en la empresa del actor (403, nunca cruza tenant)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set(auth(tokenB))
      .send({
        name: 'Sede Intrusa',
        companyId: companyAId,
      })
      .expect(403);

    const intruder = await prisma.site.findFirst({
      where: { name: 'Sede Intrusa' },
    });
    expect(intruder).toBeNull();
  });

  it('ai-assistant @datos: audita la consulta y falla acotado sin proveedor', async () => {
    // Sin proveedor de IA configurado el endpoint responde 503 acotado,
    // pero la herramienta ya se ejecuto contra el tenant del actor y quedo
    // registrada en AuditLog. La respuesta 201 (con proveedor) tambien es valida.
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai-assistant/ask')
      .set(auth(tokenA))
      .send({ message: '@datos resumen de riesgos' });
    expect([201, 503]).toContain(response.status);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'AI_ASSISTANT_DATA_QUERY',
        actor: { companyId: companyAId },
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit?.entityId).toBe('risks_summary');
  });

  it('ai-assistant @datos: EMPLOYEE queda fuera de las herramientas de datos (403)', async () => {
    const employeeUser = await prisma.user.create({
      data: {
        name: 'Empleado Integracion',
        email: `empleado-${randomUUID().slice(0, 8)}@integration.test`,
        password: await bcrypt.hash(password, 4),
        role: 'EMPLOYEE',
        companyId: companyAId,
        isActive: true,
      },
    });
    const employeeToken = await jwtService.signAsync({
      sub: employeeUser.id,
      email: employeeUser.email,
      role: 'EMPLOYEE',
      companyId: companyAId,
      activeCompanyId: null,
      type: 'access',
    });

    await request(app.getHttpServer())
      .post('/api/v1/ai-assistant/ask')
      .set(auth(employeeToken))
      .send({ message: '@datos resumen de riesgos' })
      .expect(403);
  });

  it('ai-assistant capabilities refleja el estado de configuracion', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/ai-assistant/capabilities')
      .set(auth(tokenA))
      .expect(200);
    const body = response.body as { enabled: boolean; dataTools: string[] };
    expect(Array.isArray(body.dataTools)).toBe(true);
    expect(body.dataTools).toContain('risks_summary');
  });
});
