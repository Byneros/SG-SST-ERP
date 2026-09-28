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
 * E2e de INTEGRACION del modulo contractors (S11) con PostgreSQL real.
 *
 * Que valida:
 * - CRUD de contratistas scoped por companyId (crear, listar, patch, delete).
 * - Aislamiento multi-tenant: un ADMIN de la empresa B no ve ni muta los
 *   contratistas de la empresa A (404), y manipular companyId no cruza tenant.
 * - Sub-recursos: workers y documents anidados con scoping.
 * - GET /contractors/:id/entry-authorization: decision del backend
 *   (canAuthorizeEntry) con documentos vencidos/pendientes/validos y
 *   personal sin induccion.
 */

describe('Contractors (e2e, PostgreSQL real)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const password = 'Admin12345';
  let tokenA: string;
  let tokenB: string;
  let companyAId: string;
  let companyBId: string;
  let contractorAId: string;

  async function seedTenant(nitSuffix: string) {
    const company = await prisma.company.create({
      data: {
        name: `Empresa Contratistas ${nitSuffix}`,
        nit: `CT-${randomUUID().slice(0, 13)}`,
        isActive: true,
      },
    });
    const user = await prisma.user.create({
      data: {
        name: `Admin ${nitSuffix}`,
        email: `admin-ct-${nitSuffix}@integration.test`,
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
    // Limpieza por tenant: cascade elimina workers/documents con el contractor.
    for (const companyId of [companyAId, companyBId]) {
      if (!companyId) continue;
      await prisma.contractorDocument.deleteMany({ where: { companyId } });
      await prisma.contractorWorker.deleteMany({ where: { companyId } });
      await prisma.contractor.deleteMany({ where: { companyId } });
      await prisma.auditLog.deleteMany({ where: { actorId: null } });
      await prisma.user.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
    }
    await app?.close();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('POST /contractors crea un contratista en la empresa del actor', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/contractors')
      .set(auth(tokenA))
      .send({
        name: 'Seguridad SAS',
        nit: `NIT-${randomUUID().slice(0, 8)}`,
        contact: 'Juan Perez',
        phone: '3001234567',
        arl: 'SURA',
        activity: 'Trabajo en alturas',
        status: 'ACTIVE',
        companyId: companyAId,
      })
      .expect(201);

    const contractor = body<{ id: string; companyId: string; status: string }>(
      response,
    );
    expect(contractor.id).toBeTruthy();
    // El companyId del cliente no decide el tenant: siempre el del actor.
    expect(contractor.companyId).toBe(companyAId);
    expect(contractor.status).toBe('ACTIVE');
    contractorAId = contractor.id;
  });

  it('GET /contractors lista solo los de la empresa del actor', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/contractors')
      .set(auth(tokenA))
      .expect(200);

    const list = body<{ data: Array<{ id: string }> }>(response);
    expect(list.data.some((item) => item.id === contractorAId)).toBe(true);
  });

  it('GET /contractors/:id devuelve 404 para el contratista de otra empresa', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/contractors/${contractorAId}`)
      .set(auth(tokenB))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/contractors/${contractorAId}`)
      .set(auth(tokenA))
      .expect(200);
  });

  it('PATCH con companyId manipulado no muta el contratista ajeno (400/404)', async () => {
    // UpdateContractorDto no acepta companyId (forbidNonWhitelisted -> 400).
    // Aunque se omitiera, el recurso ajeno no existe para B (404) y el
    // updateMany restrictivo nunca toca registros de otro tenant.
    await request(app.getHttpServer())
      .patch(`/api/v1/contractors/${contractorAId}`)
      .set(auth(tokenB))
      .send({ name: 'Hacked', companyId: companyBId })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/contractors/${contractorAId}`)
      .set(auth(tokenB))
      .send({ name: 'Hacked' })
      .expect(404);

    const contractor = await prisma.contractor.findUnique({
      where: { id: contractorAId },
    });
    expect(contractor?.name).toBe('Seguridad SAS');
  });

  describe('workers y documents (sub-recursos)', () => {
    it('POST /contractors/:id/workers crea personal scoped', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/contractors/${contractorAId}/workers`)
        .set(auth(tokenA))
        .send({
          document: `CC-${randomUUID().slice(0, 8)}`,
          firstName: 'Ana',
          lastName: 'Gomez',
          job: 'Operaria',
          status: 'ACTIVE',
          companyId: companyAId,
        })
        .expect(201);

      const worker = body<{ id: string; contractorId: string }>(response);
      expect(worker.contractorId).toBe(contractorAId);
    });

    it('POST /contractors/:id/documents crea documento scoped y 404 cross-tenant', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/contractors/${contractorAId}/documents`)
        .set(auth(tokenA))
        .send({
          documentType: 'ARL',
          status: 'VALID',
          companyId: companyAId,
        })
        .expect(201);

      const document = body<{ id: string }>(response);
      expect(document.id).toBeTruthy();

      // El contratista ajeno no existe para el actor B (404).
      await request(app.getHttpServer())
        .post(`/api/v1/contractors/${contractorAId}/documents`)
        .set(auth(tokenB))
        .send({
          documentType: 'HACK',
          status: 'VALID',
          companyId: companyBId,
        })
        .expect(404);
    });
  });

  describe('GET /contractors/:id/entry-authorization', () => {
    function seedWorker(inducted: boolean) {
      return prisma.contractorWorker.create({
        data: {
          document: `CC-${randomUUID().slice(0, 8)}`,
          firstName: 'Trabajador',
          lastName: inducted ? 'Inducido' : 'SinInduccion',
          status: 'ACTIVE',
          inductedAt: inducted ? new Date() : null,
          contractorId: contractorAId,
          companyId: companyAId,
        },
      });
    }

    it('bloquea el ingreso con documentos PENDING y personal sin induccion', async () => {
      await prisma.contractorDocument.create({
        data: {
          documentType: 'Afiliacion seguridad social',
          status: 'PENDING',
          contractorId: contractorAId,
          companyId: companyAId,
        },
      });
      await seedWorker(false);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/contractors/${contractorAId}/entry-authorization`)
        .set(auth(tokenA))
        .expect(200);

      const compliance = body<{
        canAuthorizeEntry: boolean;
        blockingReasons: string[];
        workersWithoutInduction: number;
      }>(response);
      expect(compliance.canAuthorizeEntry).toBe(false);
      expect(compliance.blockingReasons).toContain(
        'documentos pendientes de validacion',
      );
      expect(compliance.workersWithoutInduction).toBeGreaterThan(0);
    });

    it('bloquea el ingreso con documentos EXPIRED (estado almacenado)', async () => {
      await prisma.contractorDocument.create({
        data: {
          documentType: 'Certiculo de alturas',
          status: 'EXPIRED',
          contractorId: contractorAId,
          companyId: companyAId,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/contractors/${contractorAId}/entry-authorization`)
        .set(auth(tokenA))
        .expect(200);

      const compliance = body<{
        canAuthorizeEntry: boolean;
        blockingReasons: string[];
        expiredByDate: Array<{ documentType: string }>;
      }>(response);
      expect(compliance.canAuthorizeEntry).toBe(false);
      expect(compliance.blockingReasons).toContain(
        'documentos vencidos o rechazados',
      );
    });

    it('autoriza el ingreso con documentos VALID y todo el personal inducido', async () => {
      // Limpia documentos bloqueantes y deja solo evidencia valida.
      await prisma.contractorDocument.deleteMany({
        where: { contractorId: contractorAId },
      });
      await prisma.contractorDocument.create({
        data: {
          documentType: 'ARL',
          status: 'VALID',
          contractorId: contractorAId,
          companyId: companyAId,
        },
      });
      // Marca todo el personal como inducido.
      await prisma.contractorWorker.updateMany({
        where: { contractorId: contractorAId },
        data: { inductedAt: new Date() },
      });
      await seedWorker(true);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/contractors/${contractorAId}/entry-authorization`)
        .set(auth(tokenA))
        .expect(200);

      const compliance = body<{
        canAuthorizeEntry: boolean;
        blockingReasons: string[];
        documentsTotal: number;
      }>(response);
      expect(compliance.canAuthorizeEntry).toBe(true);
      expect(compliance.blockingReasons).toEqual([]);
      expect(compliance.documentsTotal).toBeGreaterThan(0);
    });

    it('la autorizacion de ingreso tambien esta scoped (404 cross-tenant)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/contractors/${contractorAId}/entry-authorization`)
        .set(auth(tokenB))
        .expect(404);
    });
  });

  it('DELETE /contractors/:id elimina scoped y 404 cross-tenant', async () => {
    const temp = await prisma.contractor.create({
      data: {
        name: 'Temporal',
        nit: `NIT-${randomUUID().slice(0, 8)}`,
        status: 'ACTIVE',
        companyId: companyAId,
      },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/contractors/${temp.id}`)
      .set(auth(tokenB))
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/contractors/${temp.id}`)
      .set(auth(tokenA))
      .expect(200);

    const gone = await prisma.contractor.findUnique({
      where: { id: temp.id },
    });
    expect(gone).toBeNull();
  });
});

/** Body de una respuesta supertest, tipado para evitar `any` inseguro. */
function body<T>(response: { body: unknown }): T {
  return response.body as T;
}
