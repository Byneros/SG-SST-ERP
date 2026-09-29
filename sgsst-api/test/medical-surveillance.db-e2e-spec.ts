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
 * S10.4 (Issue #28) + #25.2 (Issue #25): vigilancia epidemiologica y
 * derivacion de requisitos medicos, contra PostgreSQL real.
 *
 * Que valida:
 * - Programa PVE y cohorte derivada de la matriz de riesgos (por cargo del
 *   riesgo), con poblacion expuesta real (empleados).
 * - El refresh de la cohorte no la duplica (upsert por programa+riesgo).
 * - Aislamiento multiempresa: listados y cohorte scoped; 404 cross-tenant.
 * - RBAC: EMPLOYEE excluido del modulo (404 del guard).
 * - Reporte `surveillance` (CSV/PDF) con los datos sembrados.
 * - #25.2: perfil con riskId y derivacion de requisitos INGRESO+PERIODICO.
 */

function body<T>(response: request.Response): T {
  return response.body as T;
}

describe('Medical surveillance (e2e, PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const password = 'Admin12345';
  let tokenA: string;
  let tokenB: string;
  let empToken: string;
  let companyAId: string;
  let companyBId: string;
  const actorIds: string[] = [];

  async function seedTenant(suffix: string) {
    const company = await prisma.company.create({
      data: {
        name: `Empresa Vigilancia ${suffix}`,
        nit: `PV-${randomUUID().slice(0, 13)}`,
        isActive: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        name: `Admin ${suffix}`,
        email: `admin-pve-${suffix}@integration.test`,
        password: await bcrypt.hash(password, 4),
        role: 'ADMIN',
        companyId: company.id,
        isActive: true,
      },
    });
    actorIds.push(user.id);
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

    const tenantA = await seedTenant('A');
    const tenantB = await seedTenant('B');
    companyAId = tenantA.company.id;
    companyBId = tenantB.company.id;

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
    // Limpieza por tenant (hijos antes que padres).
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.medicalSurveillanceCohort.deleteMany({
        where: { companyId },
      });
      await prisma.medicalSurveillanceProgram.deleteMany({
        where: { companyId },
      });
      await prisma.medicalExamRequirement.deleteMany({
        where: { profile: { companyId } },
      });
      await prisma.medicalProfile.deleteMany({ where: { companyId } });
      await prisma.medicalExam.deleteMany({ where: { companyId } });
      await prisma.risk.deleteMany({ where: { companyId } });
      await prisma.employee.deleteMany({ where: { companyId } });
      await prisma.auditLog.deleteMany({
        where: { actorId: { in: actorIds } },
      });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    }
    await app?.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  let programId: string;
  let riskId: string;

  it('POST /medical/surveillance-programs crea el programa PVE', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/medical/surveillance-programs')
      .set(auth(tokenA))
      .send({
        name: 'PVE biomecanico',
        riskType: 'BIOMECANICO',
        objective: 'Vigilar expuestos a manejo de cargas',
        companyId: companyAId,
      })
      .expect(201);

    expect(body<{ id: string }>(response).id).toBeTruthy();
    programId = body<{ id: string }>(response).id;
  });

  it('POST /risks crea el riesgo del cargo y empleados expuestos', async () => {
    const risk = await request(app.getHttpServer())
      .post('/api/v1/risks')
      .set(auth(tokenA))
      .send({
        title: 'Manejo manual de cargas',
        level: 'HIGH',
        position: 'Operario PVE',
        companyId: companyAId,
      })
      .expect(201);
    riskId = body<{ id: string }>(risk).id;
    expect(body<{ position: string | null }>(risk).position).toBe(
      'Operario PVE',
    );

    for (const suffix of ['1', '2']) {
      await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set(auth(tokenA))
        .send({
          firstName: 'Expuesto',
          lastName: `PVE-${suffix}`,
          document: `PVEA-${randomUUID().slice(0, 8)}`,
          position: 'Operario PVE',
          companyId: companyAId,
        })
        .expect(201);
    }
    // Un empleado de otro cargo no entra a la cohorte.
    await request(app.getHttpServer())
      .post('/api/v1/employees')
      .set(auth(tokenA))
      .send({
        firstName: 'No expuesto',
        lastName: 'PVE',
        document: `PVEB-${randomUUID().slice(0, 8)}`,
        position: 'Administrativo',
        companyId: companyAId,
      })
      .expect(201);
  });

  it('POST .../cohorts/derive deriva la cohorte con solo los expuestos por cargo', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/medical/surveillance-programs/${programId}/cohorts/derive`)
      .set(auth(tokenA))
      .send({ riskId, companyId: companyAId })
      .expect(201);

    const result = body<{
      cohortId: string;
      workersCount: number;
      reviewed: boolean;
      risk: { position: string | null };
    }>(response);
    expect(result.cohortId).toBeTruthy();
    expect(result.workersCount).toBe(2);
    expect(result.reviewed).toBe(false);
    expect(result.risk.position).toBe('Operario PVE');
  });

  it('refrescar la cohorte no la duplica (upsert por programa+riesgo)', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/medical/surveillance-programs/${programId}/cohorts/derive`)
      .set(auth(tokenA))
      .send({ riskId, companyId: companyAId })
      .expect(201);

    const result = body<{ reviewed: boolean; workersCount: number }>(response);
    expect(result.reviewed).toBe(true);

    const cohorts = await prisma.medicalSurveillanceCohort.findMany({
      where: { programId, riskId },
    });
    expect(cohorts).toHaveLength(1);
  });

  it('GET /medical/surveillance-programs lista scoped con cohortes y conteo', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/medical/surveillance-programs')
      .set(auth(tokenA))
      .expect(200);

    const rows = body<
      {
        id: string;
        companyId: string;
        cohorts: { _count: { workers: number } }[];
      }[]
    >(response);
    const mine = rows.filter((row) => row.id === programId);
    expect(mine).toHaveLength(1);
    expect(mine[0].cohorts[0]._count.workers).toBe(2);
    // Aislamiento: no ve programas de B.
    expect(rows.every((row) => row.companyId === companyAId)).toBe(true);
  });

  it('aislamiento: el token de B no puede derivar cohorte sobre el riesgo de A (404)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/medical/surveillance-programs/${programId}/cohorts/derive`)
      .set(auth(tokenB))
      .send({ riskId, companyId: companyBId })
      .expect(404);
  });

  it('RBAC: EMPLOYEE excluido del modulo (403 del guard @Roles)', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Employee PVE',
        email: `emp-pve-${randomUUID().slice(0, 8)}@integration.test`,
        password: await bcrypt.hash(password, 4),
        role: 'EMPLOYEE',
        companyId: companyAId,
        isActive: true,
      },
    });
    actorIds.push(user.id);
    empToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: 'EMPLOYEE',
      companyId: companyAId,
      activeCompanyId: null,
      type: 'access',
    });

    // El RolesGuard responde 403 antes del assertMedicalRole del servicio
    // (404); el acceso queda denegado igualmente.
    await request(app.getHttpServer())
      .get('/api/v1/medical/surveillance-programs')
      .set(auth(empToken))
      .expect(403);
  });

  it('#25.2: perfil con riskId y derivacion de requisitos desde el riesgo', async () => {
    const profile = await request(app.getHttpServer())
      .post('/api/v1/medical/profiles')
      .set(auth(tokenA))
      .send({
        position: 'Operario PVE',
        description: 'Profesiograma derivado',
        riskId,
        companyId: companyAId,
      })
      .expect(201);
    const profileId = body<{ id: string }>(profile).id;

    const derived = await request(app.getHttpServer())
      .post(`/api/v1/medical/profiles/${profileId}/derive-requirements`)
      .set(auth(tokenA))
      .send({ companyId: companyAId })
      .expect(201);

    const result = body<{
      worstRiskLevel: string;
      created: { examType: string; periodicityMonths: number }[];
    }>(derived);
    expect(result.worstRiskLevel).toBe('HIGH');
    expect(result.created.map((r) => r.examType)).toEqual([
      'INGRESO',
      'PERIODICO',
    ]);
    expect(
      result.created.find((r) => r.examType === 'PERIODICO')?.periodicityMonths,
    ).toBe(12);
  });

  it('el reporte surveillance exporta CSV y PDF con los datos sembrados', async () => {
    const csv = await request(app.getHttpServer())
      .get('/api/v1/reports/surveillance.csv')
      .set(auth(tokenA))
      .expect(200);
    expect(csv.text).toContain('PVE biomecanico');
    expect(csv.text).toContain('Manejo manual de cargas');

    await request(app.getHttpServer())
      .get('/api/v1/reports/surveillance.pdf')
      .set(auth(tokenA))
      .expect(200);
  });
});
